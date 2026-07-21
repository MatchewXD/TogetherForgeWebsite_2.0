-- =============================================================================
-- Together Forge — Claim rules for hierarchical tasks
-- Run AFTER: supabase_tasks_schema.sql, supabase_claim_anti_hoarding.sql,
--            supabase_task_hierarchy.sql
-- Safe to re-run
-- =============================================================================
-- Rules:
--   * Epics (depth 0) cannot be claimed
--   * Tasks with children cannot be claimed (progress = % children completed)
--   * Volunteers claim Medium (depth 1) or Small (depth 2) leaf tasks only
--   * Manual progress/checklist only on claimed leaf tasks
-- =============================================================================

-- Reuse nesting depth from hierarchy migration when present
create or replace function public.task_nesting_depth(p_task_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid := p_task_id;
  v_parent uuid;
  v_depth integer := 0;
begin
  if p_task_id is null then
    return 0;
  end if;

  loop
    select parent_task_id into v_parent from tasks where id = v_id;
    if not found then
      return v_depth;
    end if;
    if v_parent is null then
      return v_depth;
    end if;
    v_depth := v_depth + 1;
    if v_depth > 10 then
      return v_depth;
    end if;
    v_id := v_parent;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_task: anti-hoarding rules + hierarchy claimability
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
  v_depth integer;
  v_child_count integer;
begin
  if v_uid is null then
    raise exception 'You must be signed in to claim a task';
  end if;

  -- Housekeeping: release stale claims for everyone (cheap if none)
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
    raise exception 'This task is already completed';
  end if;

  if exists (
    select 1 from task_claims
    where task_id = p_task_id and status = 'Active'
  ) then
    raise exception 'This task is already claimed';
  end if;

  -- Hierarchy: Epic (depth 0) never claimable
  v_depth := public.task_nesting_depth(p_task_id);
  if v_depth = 0 then
    raise exception 'Epics cannot be claimed. Claim a Medium or Small task under this epic.';
  end if;

  -- Parent with children: progress rolls up; claim the leaf work instead
  select count(*)::integer into v_child_count
  from tasks
  where parent_task_id = p_task_id;

  if v_child_count > 0 then
    raise exception 'This task has sub-tasks and cannot be claimed. Claim a child task instead.';
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

  -- Claim limit (falls back if helper missing)
  begin
    v_limit := public.user_claim_limit(v_uid);
  exception when undefined_function then
    v_limit := 5;
  end;

  select count(*)::integer into v_active_count
  from task_claims
  where user_id = v_uid and status = 'Active';

  if v_active_count >= v_limit then
    raise exception 'Claim limit reached (% active / % max). Complete or return a task first. New volunteers start at 2 slots; 3+ completions unlock 5.',
      v_active_count, v_limit;
  end if;

  insert into task_claims (
    task_id, user_id, status, progress_percent, last_activity_at, claimed_at
  )
  values (p_task_id, v_uid, 'Active', 0, now(), now())
  returning * into v_claim;

  -- Optional last_claim_at column (anti-hoarding)
  begin
    update task_claims set last_claim_at = now() where id = v_claim.id;
  exception when undefined_column then
    null;
  end;

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

-- ---------------------------------------------------------------------------
-- Progress: only active claim holder; only leaf tasks (no children)
-- ---------------------------------------------------------------------------
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
  v_child_count integer;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_task from tasks where id = p_task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  select count(*)::integer into v_child_count
  from tasks
  where parent_task_id = p_task_id;

  if v_child_count > 0 then
    raise exception 'Progress on this task is calculated from completed sub-tasks. Update or complete a child task instead.';
  end if;

  select * into v_claim
  from task_claims
  where task_id = p_task_id and user_id = v_uid and status = 'Active'
  for update;

  if not found then
    raise exception 'You do not hold an active claim on this task. Claim it before saving progress or checklist items.';
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

comment on function public.claim_task is
  'Claim Medium/Small leaf tasks only. Epics and parents with children are blocked.';
