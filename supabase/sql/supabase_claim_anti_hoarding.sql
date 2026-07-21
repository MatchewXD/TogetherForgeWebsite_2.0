-- Together Forge: claim anti-hoarding / Sybil defenses
-- Run in Supabase SQL Editor after supabase_tasks_schema.sql (+ claim_limit).
-- Safe to re-run.
--
-- Rules:
--   1. Hard cap: max 5 active claims (2 for new users with < 3 completions)
--   2. Auto-release: no last_activity_at progress for 14 days → Returned
--   3. Cooldown: 30 minutes between new claims
--   4. Public read of claims (who + how long) already via SELECT policy
--   5. claim_join_requests: others request to help; owner or staff approve

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table task_claims
  add column if not exists last_claim_at timestamptz;

-- Mirror claimed_at for clarity (optional)
update task_claims
set last_claim_at = claimed_at
where last_claim_at is null and claimed_at is not null;

-- ---------------------------------------------------------------------------
-- Join requests
-- ---------------------------------------------------------------------------
create table if not exists claim_join_requests (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references task_claims(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

create unique index if not exists idx_claim_join_one_pending
  on claim_join_requests (claim_id, requester_id)
  where status = 'pending';

create index if not exists idx_claim_join_task on claim_join_requests (task_id);
create index if not exists idx_claim_join_requester on claim_join_requests (requester_id);

alter table claim_join_requests enable row level security;

drop policy if exists "Public can read join requests" on claim_join_requests;
create policy "Public can read join requests"
  on claim_join_requests for select using (true);

drop policy if exists "Users can request to join" on claim_join_requests;
create policy "Users can request to join"
  on claim_join_requests for insert
  to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists "Requester can cancel own request" on claim_join_requests;
create policy "Requester can cancel own request"
  on claim_join_requests for update
  to authenticated
  using (auth.uid() = requester_id)
  with check (auth.uid() = requester_id);

drop policy if exists "Owner or staff can resolve join requests" on claim_join_requests;
create policy "Owner or staff can resolve join requests"
  on claim_join_requests for update
  to authenticated
  using (
    public.is_project_staff()
    or exists (
      select 1 from task_claims tc
      where tc.id = claim_join_requests.claim_id
        and tc.user_id = auth.uid()
        and tc.status = 'Active'
    )
  );

-- ---------------------------------------------------------------------------
-- Reputation: claim limit based on completed claims
-- ---------------------------------------------------------------------------
create or replace function public.user_claim_limit(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (
      select count(*) from task_claims
      where user_id = p_user_id and status = 'Completed'
    ) >= 3 then 5
    else 2
  end;
$$;

grant execute on function public.user_claim_limit(uuid) to authenticated, anon;

create or replace function public.user_completed_claim_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from task_claims
  where user_id = p_user_id and status = 'Completed';
$$;

grant execute on function public.user_completed_claim_count(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Auto-release stale claims (14 days without activity)
-- ---------------------------------------------------------------------------
create or replace function public.return_stale_claims(p_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
  v_task tasks%rowtype;
begin
  for r in
    select *
    from task_claims
    where status = 'Active'
      and coalesce(last_activity_at, claimed_at, now()) < (now() - make_interval(days => greatest(p_days, 1)))
  loop
    update task_claims
    set status = 'Returned',
        notes = trim(both from coalesce(notes, '') || E'\n[auto-released: no progress for ' || p_days || ' days]')
    where id = r.id;

    select * into v_task from tasks where id = r.task_id;
    if found and v_task.status = 'InProgress' then
      -- Only reopen if no other active claim
      if not exists (
        select 1 from task_claims
        where task_id = r.task_id and status = 'Active' and id <> r.id
      ) then
        update tasks set status = 'ToDo' where id = r.task_id;
      end if;
    end if;

    insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
    values (
      v_task.project_id,
      r.user_id,
      'auto_released',
      'task',
      r.task_id,
      v_task.title,
      jsonb_build_object('claim_id', r.id, 'days', p_days)
    );

    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function public.return_stale_claims(integer) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- claim_task: limit + reputation + cooldown + stale cleanup first
-- ---------------------------------------------------------------------------
create or replace function public.claim_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_active_count integer;
  v_limit integer;
  v_last_claim timestamptz;
  v_cooldown interval := interval '30 minutes';
begin
  if v_uid is null then
    raise exception 'You must be signed in to claim a task';
  end if;

  -- Housekeeping: release stale claims for everyone (cheap if none)
  perform public.return_stale_claims(14);

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status = 'Completed' then
    raise exception 'This task is already completed';
  end if;

  if exists (
    select 1 from task_claims
    where task_id = p_task_id and status = 'Active'
  ) then
    raise exception 'This task is already claimed';
  end if;

  -- Cooldown: 30 minutes since last successful claim
  select max(claimed_at) into v_last_claim
  from task_claims
  where user_id = v_uid
    and claimed_at is not null;

  if v_last_claim is not null and v_last_claim > (now() - v_cooldown) then
    raise exception 'Claim cooldown: wait % minutes after your last claim before taking another task.',
      ceil(extract(epoch from (v_last_claim + v_cooldown - now())) / 60.0);
  end if;

  v_limit := public.user_claim_limit(v_uid);

  select count(*)::integer into v_active_count
  from task_claims
  where user_id = v_uid and status = 'Active';

  if v_active_count >= v_limit then
    raise exception 'Claim limit reached (% active / % max). Complete or return a task first. New volunteers start at 2 slots; 3+ completions unlock 5.',
      v_active_count, v_limit;
  end if;

  insert into task_claims (
    task_id, user_id, status, progress_percent, last_activity_at, claimed_at, last_claim_at
  )
  values (p_task_id, v_uid, 'Active', 0, now(), now(), now())
  returning * into v_claim;

  update tasks
  set status = 'InProgress'
  where id = p_task_id;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'claimed',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object('claim_id', v_claim.id)
  );

  return jsonb_build_object(
    'claim', to_jsonb(v_claim),
    'task_id', p_task_id,
    'status', 'InProgress',
    'active_claims', v_active_count + 1,
    'claim_limit', v_limit
  );
end;
$$;

grant execute on function public.claim_task(uuid) to authenticated;

-- Touch last_activity_at on progress updates if function exists
create or replace function public.update_task_progress(
  p_task_id uuid,
  p_progress_percent integer default null,
  p_subtasks jsonb default null,
  p_notes text default null,
  p_helpers jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_claim task_claims%rowtype;
  v_task tasks%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_claim
  from task_claims
  where task_id = p_task_id and user_id = v_uid and status = 'Active'
  for update;

  if not found then
    raise exception 'You do not hold an active claim on this task';
  end if;

  update task_claims set
    progress_percent = coalesce(p_progress_percent, progress_percent),
    notes = coalesce(p_notes, notes),
    helpers = coalesce(p_helpers, helpers),
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  if p_subtasks is not null then
    update tasks set subtasks = p_subtasks where id = p_task_id;
  end if;

  select * into v_task from tasks where id = p_task_id;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'progress',
    'task',
    p_task_id,
    v_task.title,
    jsonb_build_object(
      'claim_id', v_claim.id,
      'progress_percent', v_claim.progress_percent
    )
  );

  return jsonb_build_object('claim', to_jsonb(v_claim), 'task_id', p_task_id);
end;
$$;

grant execute on function public.update_task_progress(uuid, integer, jsonb, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Join request RPCs
-- ---------------------------------------------------------------------------
create or replace function public.request_join_claim(p_task_id uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_claim task_claims%rowtype;
  v_req claim_join_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in to request joining a claim';
  end if;

  select * into v_claim
  from task_claims
  where task_id = p_task_id and status = 'Active'
  limit 1;

  if not found then
    raise exception 'No active claim on this task';
  end if;

  if v_claim.user_id = v_uid then
    raise exception 'You already own this claim';
  end if;

  -- One pending request per claim (no duplicates)
  select * into v_req
  from claim_join_requests
  where claim_id = v_claim.id and requester_id = v_uid and status = 'pending'
  limit 1;

  if found then
    raise exception 'You already have a pending join request on this task';
  end if;

  -- Already approved helper on this claim
  if exists (
    select 1 from claim_join_requests
    where claim_id = v_claim.id
      and requester_id = v_uid
      and status = 'approved'
  ) then
    raise exception 'You are already helping on this task';
  end if;

  -- Also block if username already in helpers jsonb
  if exists (
    select 1 from profiles p
    where p.id = v_uid
      and p.username is not null
      and v_claim.helpers is not null
      and (
        v_claim.helpers @> to_jsonb(p.username)
        or v_claim.helpers @> jsonb_build_array(jsonb_build_object('username', p.username))
      )
  ) then
    raise exception 'You are already helping on this task';
  end if;

  insert into claim_join_requests (claim_id, task_id, requester_id, message, status)
  values (v_claim.id, p_task_id, v_uid, nullif(trim(coalesce(p_message, '')), ''), 'pending')
  returning * into v_req;

  return jsonb_build_object('request', to_jsonb(v_req), 'already_pending', false);
end;
$$;

grant execute on function public.request_join_claim(uuid, text) to authenticated;

create or replace function public.resolve_join_request(p_request_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req claim_join_requests%rowtype;
  v_claim task_claims%rowtype;
  v_helpers jsonb;
  v_profile profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_req from claim_join_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Request is already %', v_req.status;
  end if;

  select * into v_claim from task_claims where id = v_req.claim_id for update;
  if not found or v_claim.status <> 'Active' then
    raise exception 'Claim is no longer active';
  end if;

  -- Strict owner check (IS DISTINCT FROM avoids NULL bypass)
  if v_claim.user_id is distinct from v_uid
     and not coalesce(public.is_project_staff(), false) then
    raise exception 'Only the claim owner or staff can resolve this request';
  end if;

  update claim_join_requests set
    status = case when p_approve then 'approved' else 'rejected' end,
    resolved_at = now(),
    resolved_by = v_uid
  where id = p_request_id
  returning * into v_req;

  if p_approve then
    select * into v_profile from profiles where id = v_req.requester_id;
    v_helpers := case
      when v_claim.helpers is null then '[]'::jsonb
      when jsonb_typeof(v_claim.helpers) = 'array' then v_claim.helpers
      else '[]'::jsonb
    end;
    -- Append helper once (string or {username} entries)
    if v_profile.username is not null
       and not exists (
         select 1
         from jsonb_array_elements(v_helpers) elem
         where elem #>> '{}' = v_profile.username
            or elem->>'username' = v_profile.username
       )
    then
      v_helpers := v_helpers || jsonb_build_array(
        jsonb_build_object(
          'username', v_profile.username,
          'user_id', v_req.requester_id
        )
      );
    end if;

    update task_claims
    set helpers = v_helpers,
        last_activity_at = now()
    where id = v_claim.id
    returning * into v_claim;
  end if;

  return jsonb_build_object('request', to_jsonb(v_req), 'claim', to_jsonb(v_claim));
end;
$$;

grant execute on function public.resolve_join_request(uuid, boolean) to authenticated;

-- Client helper: claim quota snapshot
create or replace function public.get_my_claim_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_active integer;
  v_completed integer;
  v_limit integer;
  v_last timestamptz;
  v_cooldown_ends timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('signed_in', false);
  end if;

  select count(*)::integer into v_active
  from task_claims where user_id = v_uid and status = 'Active';

  select count(*)::integer into v_completed
  from task_claims where user_id = v_uid and status = 'Completed';

  v_limit := public.user_claim_limit(v_uid);

  select max(claimed_at) into v_last
  from task_claims where user_id = v_uid;

  if v_last is not null then
    v_cooldown_ends := v_last + interval '30 minutes';
  end if;

  return jsonb_build_object(
    'signed_in', true,
    'active_claims', v_active,
    'completed_claims', v_completed,
    'claim_limit', v_limit,
    'cooldown_ends_at', v_cooldown_ends,
    'can_claim_now', (
      v_active < v_limit
      and (v_cooldown_ends is null or v_cooldown_ends <= now())
    )
  );
end;
$$;

grant execute on function public.get_my_claim_quota() to authenticated, anon;

comment on table claim_join_requests is
  'Users request to join an active claim; owner or staff approve → added as helper.';
comment on function public.claim_task is
  'Claim with reputation limit (2 or 5), 30m cooldown, and 14-day stale release.';
