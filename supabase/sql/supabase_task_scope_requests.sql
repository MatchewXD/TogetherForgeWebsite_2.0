-- Together Forge: task scope help ("this is bigger than expected")
-- Run after supabase_tasks_schema.sql (+ hierarchy + review workflow).
-- Safe to re-run.
--
-- Claimants can flag a claimed task as larger than expected, leave a note,
-- and Project Leads / moderators resolve by breaking down, promoting, or adjusting.
-- Scope discovery is expected and non-punitive.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.task_scope_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  claim_id uuid not null references public.task_claims(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  note text not null,
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'cancelled')),
  -- staff outcome: breakdown | promoted | adjusted | kept | other
  resolution text
    check (
      resolution is null
      or resolution in ('breakdown', 'promoted', 'adjusted', 'kept', 'other')
    ),
  staff_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

comment on table public.task_scope_requests is
  'Claimant-reported scope discovery: task larger than expected. Staff break down / re-scope.';

-- One open request per claim at a time
create unique index if not exists idx_task_scope_one_pending_claim
  on public.task_scope_requests (claim_id)
  where status = 'pending';

create index if not exists idx_task_scope_project_pending
  on public.task_scope_requests (project_id, status, created_at desc);

create index if not exists idx_task_scope_task
  on public.task_scope_requests (task_id);

alter table public.task_scope_requests enable row level security;

-- Table grants (RLS still applies). Missing GRANTs look like
-- "permission denied" and the dashboard reports the table as missing.
grant usage on schema public to anon, authenticated, service_role;
grant select on table public.task_scope_requests to anon, authenticated, service_role;
grant insert, update on table public.task_scope_requests to authenticated, service_role;

drop policy if exists "Public can read scope requests" on public.task_scope_requests;
create policy "Public can read scope requests"
  on public.task_scope_requests for select
  using (true);

drop policy if exists "Claimants can create scope requests" on public.task_scope_requests;
create policy "Claimants can create scope requests"
  on public.task_scope_requests for insert
  to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists "Requester can cancel own scope request" on public.task_scope_requests;
create policy "Requester can cancel own scope request"
  on public.task_scope_requests for update
  to authenticated
  using (auth.uid() = requester_id)
  with check (auth.uid() = requester_id);

drop policy if exists "Staff can resolve scope requests" on public.task_scope_requests;
create policy "Staff can resolve scope requests"
  on public.task_scope_requests for update
  to authenticated
  using (public.is_project_staff());

-- ---------------------------------------------------------------------------
-- Claimant: request help when scope is bigger than expected
-- ---------------------------------------------------------------------------
create or replace function public.request_task_scope_help(
  p_task_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_claim public.task_claims%rowtype;
  v_task public.tasks%rowtype;
  v_note text := trim(coalesce(p_note, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to request scope help';
  end if;
  if char_length(v_note) < 10 then
    raise exception 'Add a short note (at least 10 characters) about what is larger than expected';
  end if;
  if char_length(v_note) > 2000 then
    raise exception 'Note is too long (max 2000 characters)';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim
  from public.task_claims
  where task_id = p_task_id
    and user_id = v_uid
    and status = 'Active'
  order by claimed_at desc
  limit 1
  for update;

  if not found then
    raise exception 'You need an active claim on this task to request a breakdown';
  end if;

  if exists (
    select 1 from public.task_scope_requests
    where claim_id = v_claim.id and status = 'pending'
  ) then
    raise exception 'You already have an open scope request on this claim';
  end if;

  insert into public.task_scope_requests (
    project_id, task_id, claim_id, requester_id, note, status
  ) values (
    v_task.project_id, p_task_id, v_claim.id, v_uid, v_note, 'pending'
  )
  returning id into v_id;

  -- Touch claim activity so anti-hoarding does not treat as idle
  update public.task_claims
  set last_activity_at = now()
  where id = v_claim.id;

  insert into public.activity_log (
    project_id, user_id, action, target_type, target_id, target_title, metadata
  ) values (
    v_task.project_id,
    v_uid,
    'scope_help',
    'task',
    p_task_id,
    v_task.title,
    jsonb_build_object(
      'request_id', v_id,
      'note', left(v_note, 280),
      'message', 'Flagged work as larger than expected (scope help)'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', v_id,
    'status', 'pending'
  );
end;
$$;

grant execute on function public.request_task_scope_help(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Staff: resolve (after breakdown / promote / adjust / keep)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_task_scope_request(
  p_request_id uuid,
  p_resolution text,
  p_staff_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.task_scope_requests%rowtype;
  v_task public.tasks%rowtype;
  v_resolution text := lower(trim(coalesce(p_resolution, '')));
  v_staff_note text := nullif(trim(coalesce(p_staff_note, '')), '');
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  if not public.is_project_staff() then
    raise exception 'Only Project Leads and moderators can resolve scope requests';
  end if;
  if v_resolution not in ('breakdown', 'promoted', 'adjusted', 'kept', 'other') then
    raise exception 'Pick a resolution: breakdown, promoted, adjusted, kept, or other';
  end if;

  select * into v_req
  from public.task_scope_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Scope request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This scope request is already closed';
  end if;

  select * into v_task from public.tasks where id = v_req.task_id;

  update public.task_scope_requests set
    status = 'resolved',
    resolution = v_resolution,
    staff_note = v_staff_note,
    resolved_at = now(),
    resolved_by = v_uid
  where id = p_request_id;

  insert into public.activity_log (
    project_id, user_id, action, target_type, target_id, target_title, metadata
  ) values (
    v_req.project_id,
    v_uid,
    'scope_help_resolved',
    'task',
    v_req.task_id,
    coalesce(v_task.title, 'a task'),
    jsonb_build_object(
      'request_id', p_request_id,
      'resolution', v_resolution,
      'staff_note', left(coalesce(v_staff_note, ''), 280),
      'requester_id', v_req.requester_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'resolution', v_resolution
  );
end;
$$;

grant execute on function public.resolve_task_scope_request(uuid, text, text) to authenticated;

-- Claimant can cancel their own pending request
create or replace function public.cancel_task_scope_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.task_scope_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_req
  from public.task_scope_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Scope request not found';
  end if;
  if v_req.requester_id <> v_uid and not public.is_project_staff() then
    raise exception 'Only the requester or staff can cancel this';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  update public.task_scope_requests set
    status = 'cancelled',
    resolved_at = now(),
    resolved_by = v_uid
  where id = p_request_id;

  return jsonb_build_object('ok', true, 'status', 'cancelled');
end;
$$;

grant execute on function public.cancel_task_scope_request(uuid) to authenticated;

notify pgrst, 'reload schema';
