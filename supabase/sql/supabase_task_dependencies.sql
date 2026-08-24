-- =============================================================================
-- Together Forge - Task dependencies ("Blocked by" / Locked until complete)
-- Run AFTER: supabase_tasks_schema.sql, supabase_task_hierarchy.sql,
--            supabase_task_anti_abuse.sql, supabase_task_limit_bypass.sql
-- Safe to re-run (idempotent where possible)
-- =============================================================================
-- Rules:
--   * task_dependencies: task_id is blocked by blocks_on_task_id
--   * Locked while any blocker has status <> 'Completed' (accepted/shipped)
--   * tasks.dependency_override = true → staff unlock without clearing deps
--   * Locked tasks cannot be claimed (server + client)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Staff override flag on tasks
-- ---------------------------------------------------------------------------
alter table if exists tasks
  add column if not exists dependency_override boolean not null default false;

comment on column tasks.dependency_override is
  'When true, ignore incomplete blockers so the task can be claimed (staff override).';

-- ---------------------------------------------------------------------------
-- 2. Junction: blocked-by edges (same project only)
-- ---------------------------------------------------------------------------
create table if not exists task_dependencies (
  task_id uuid not null references tasks(id) on delete cascade,
  blocks_on_task_id uuid not null references tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (task_id, blocks_on_task_id),
  constraint task_dependencies_no_self check (task_id <> blocks_on_task_id)
);

create index if not exists idx_task_dependencies_blocker
  on task_dependencies (blocks_on_task_id);

create index if not exists idx_task_dependencies_task
  on task_dependencies (task_id);

comment on table task_dependencies is
  'task_id cannot be claimed until every blocks_on_task_id is Completed (or override).';

-- Same-project + basic integrity
create or replace function public.task_dependencies_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_project uuid;
  v_blocker_project uuid;
begin
  if new.task_id = new.blocks_on_task_id then
    raise exception 'A task cannot block itself';
  end if;

  select project_id into v_task_project from tasks where id = new.task_id;
  if not found then
    raise exception 'Dependent task not found';
  end if;

  select project_id into v_blocker_project from tasks where id = new.blocks_on_task_id;
  if not found then
    raise exception 'Blocking task not found';
  end if;

  if v_task_project is distinct from v_blocker_project then
    raise exception 'Dependencies must be within the same project';
  end if;

  -- Direct reverse edge = immediate cycle
  if exists (
    select 1 from task_dependencies
    where task_id = new.blocks_on_task_id
      and blocks_on_task_id = new.task_id
  ) then
    raise exception 'Circular dependency: these tasks already block each other';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_task_dependencies_validate on task_dependencies;
create trigger trg_task_dependencies_validate
  before insert or update on task_dependencies
  for each row execute function public.task_dependencies_validate();

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table task_dependencies enable row level security;

drop policy if exists "Public can read task_dependencies" on task_dependencies;
create policy "Public can read task_dependencies" on task_dependencies
  for select using (true);

drop policy if exists "Staff can insert task_dependencies" on task_dependencies;
create policy "Staff can insert task_dependencies" on task_dependencies
  for insert with check (public.is_project_staff());

drop policy if exists "Staff can update task_dependencies" on task_dependencies;
create policy "Staff can update task_dependencies" on task_dependencies
  for update using (public.is_project_staff());

drop policy if exists "Staff can delete task_dependencies" on task_dependencies;
create policy "Staff can delete task_dependencies" on task_dependencies
  for delete using (public.is_project_staff());

-- ---------------------------------------------------------------------------
-- 4. Lock helpers
-- ---------------------------------------------------------------------------
/**
 * Incomplete blockers for a task (status not Completed).
 * Empty when dependency_override is true or no edges.
 */
create or replace function public.task_incomplete_blockers(p_task_id uuid)
returns table (
  id uuid,
  title text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.title, b.status
  from task_dependencies d
  join tasks b on b.id = d.blocks_on_task_id
  join tasks t on t.id = d.task_id
  where d.task_id = p_task_id
    and coalesce(t.dependency_override, false) = false
    and b.status is distinct from 'Completed';
$$;

create or replace function public.task_is_dependency_locked(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.task_incomplete_blockers(p_task_id)
  );
$$;

grant execute on function public.task_incomplete_blockers(uuid) to anon, authenticated;
grant execute on function public.task_is_dependency_locked(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Staff: replace dependency set + optional override
-- ---------------------------------------------------------------------------
create or replace function public.set_task_dependencies(
  p_task_id uuid,
  p_blocker_ids uuid[] default '{}',
  p_override boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_ids uuid[] := coalesce(p_blocker_ids, '{}');
  v_id uuid;
  v_inserted int := 0;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_project_staff() then
    raise exception 'Only project leads and admins can set task dependencies';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if p_override is not null then
    update tasks
    set dependency_override = p_override
    where id = p_task_id;
  end if;

  delete from task_dependencies where task_id = p_task_id;

  foreach v_id in array v_ids
  loop
    if v_id is null or v_id = p_task_id then
      continue;
    end if;
    if not exists (
      select 1 from tasks
      where id = v_id and project_id = v_task.project_id
    ) then
      raise exception 'Blocking task % is not in this project', v_id;
    end if;
    insert into task_dependencies (task_id, blocks_on_task_id, created_by)
    values (p_task_id, v_id, v_uid)
    on conflict do nothing;
    v_inserted := v_inserted + 1;
  end loop;

  insert into activity_log (
    project_id, user_id, action, target_type, target_id, target_title, metadata
  )
  values (
    v_task.project_id,
    v_uid,
    'dependencies_updated',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'blocker_ids', to_jsonb(v_ids),
      'override', coalesce(p_override, v_task.dependency_override)
    )
  );

  return jsonb_build_object(
    'task_id', p_task_id,
    'blocker_count', v_inserted,
    'dependency_override', (
      select dependency_override from tasks where id = p_task_id
    ),
    'is_locked', public.task_is_dependency_locked(p_task_id)
  );
end;
$$;

grant execute on function public.set_task_dependencies(uuid, uuid[], boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. claim_task — latest limit-bypass rules + dependency lock gate
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
  v_active int := 0;
  v_completed int := 0;
  v_limit int := 2;
  v_last timestamptz;
  v_depth int := 0;
  v_child_count int := 0;
  v_bypass boolean := false;
  v_blocker_titles text;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  begin
    v_bypass := public.user_bypasses_task_limits(v_uid);
  exception when undefined_function then
    v_bypass := false;
  end;

  begin
    if not public.user_meets_identity_gate(v_uid) then
      raise exception 'IDENTITY_GATE: Verify your email and link Discord, Google, or GitHub before claiming tasks.';
    end if;
  exception when undefined_function then
    null;
  end;

  begin
    if public.user_is_claim_restricted(v_uid) then
      raise exception 'CLAIM_RESTRICTED: Your claim privileges are temporarily limited due to prior review issues. Contact a Project Lead via Discord to appeal.';
    end if;
  exception when undefined_function then
    null;
  end;

  begin
    perform public.return_stale_claims(14);
  exception when others then
    null;
  end;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status = 'Completed' then
    raise exception 'Task is already completed';
  end if;

  if v_task.status = 'InReview' then
    raise exception 'Task is waiting for review and cannot be claimed';
  end if;

  -- Dependency lock (Blocked by incomplete tasks)
  if public.task_is_dependency_locked(p_task_id) then
    select string_agg(title, ', ' order by title)
    into v_blocker_titles
    from public.task_incomplete_blockers(p_task_id);

    raise exception 'TASK_LOCKED: Locked – waiting on: %',
      coalesce(nullif(v_blocker_titles, ''), 'blocking tasks');
  end if;

  begin
    v_depth := public.task_nesting_depth(p_task_id);
  exception when undefined_function then
    v_depth := case when v_task.parent_task_id is null then 0 else 1 end;
  end;

  if v_depth = 0 then
    raise exception 'Epics cannot be claimed. Claim a Medium or Small task under this epic.';
  end if;

  select count(*)::integer into v_child_count
  from tasks
  where parent_task_id = p_task_id;

  if v_child_count > 0 then
    raise exception 'This task has sub-tasks and cannot be claimed. Claim a leaf task instead.';
  end if;

  if exists (
    select 1 from task_claims
    where task_id = p_task_id and status in ('Active', 'PendingReview')
  ) then
    raise exception 'Task already has an active claim';
  end if;

  select count(*) into v_active
  from task_claims
  where user_id = v_uid and status in ('Active', 'PendingReview');

  begin
    v_completed := public.user_accepted_task_count(v_uid);
  exception when undefined_function then
    v_completed := 0;
  end;

  begin
    v_limit := public.user_claim_limit(v_uid);
  exception when undefined_function then
    v_limit := 5;
  end;

  if v_active >= v_limit then
    raise exception 'Claim limit reached (% / %). New accounts start with 2 slots; limits rise after accepted reviews (2+ → 3, 5+ → 5).',
      v_active, v_limit;
  end if;

  if not v_bypass then
    select max(claimed_at) into v_last
    from task_claims
    where user_id = v_uid and claimed_at is not null;

    if v_last is not null and v_last > now() - interval '30 minutes' then
      raise exception 'Please wait before claiming another task (30 minute cooldown).';
    end if;
  end if;

  insert into task_claims (
    task_id, user_id, status, progress_percent, last_activity_at, claimed_at
  )
  values (p_task_id, v_uid, 'Active', 0, now(), now())
  returning * into v_claim;

  update tasks set status = 'InProgress' where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'claimed',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'claim_id', v_claim.id,
      'accepted_count', v_completed,
      'claim_limit', v_limit,
      'rate_limit_bypass', v_bypass
    )
  );

  return jsonb_build_object(
    'claim', to_jsonb(v_claim),
    'task', to_jsonb(v_task),
    'active_claims', v_active + 1,
    'claim_limit', v_limit
  );
end;
$$;

grant execute on function public.claim_task(uuid) to authenticated;

-- Staff Only claim/join gates live in supabase_task_staff_only.sql (run after this file).
