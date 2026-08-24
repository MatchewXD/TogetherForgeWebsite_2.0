-- =============================================================================
-- Staff Only tasks
-- Volunteers can see Staff Only work on the board (transparency) but cannot
-- claim or join it. Staff / founders claim, work, and complete as usual.
--
-- Run AFTER supabase_task_dependencies.sql (and join-request patches).
-- Safe to re-run.
-- =============================================================================

alter table if exists public.tasks
  add column if not exists staff_only boolean not null default false;

comment on column public.tasks.staff_only is
  'When true, volunteers can view the task but only staff (moderator, admin, project_lead, founder) can claim or join it.';

-- ---------------------------------------------------------------------------
-- Keep non-staff from flipping the flag via the claimant UPDATE policy
-- ---------------------------------------------------------------------------
create or replace function public.protect_task_staff_only_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.staff_only, false) and not public.is_project_staff() then
      raise exception 'STAFF_ONLY: Only staff can create Staff Only tasks.';
    end if;
    return new;
  end if;

  if coalesce(new.staff_only, false) is distinct from coalesce(old.staff_only, false)
     and not public.is_project_staff() then
    raise exception 'STAFF_ONLY: Only staff can change the Staff Only flag.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_task_staff_only on public.tasks;
create trigger trg_protect_task_staff_only
  before insert or update of staff_only on public.tasks
  for each row
  execute function public.protect_task_staff_only_flag();

-- ---------------------------------------------------------------------------
-- Block volunteer claim inserts (survives later claim_task replacements)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_staff_only_on_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tasks t
    where t.id = new.task_id
      and coalesce(t.staff_only, false)
  ) and not public.is_project_staff() then
    raise exception 'STAFF_ONLY: This task is Staff Only and cannot be claimed by volunteers.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_staff_only_on_claim on public.task_claims;
create trigger trg_enforce_staff_only_on_claim
  before insert on public.task_claims
  for each row
  execute function public.enforce_staff_only_on_claim();

-- ---------------------------------------------------------------------------
-- claim_task — latest dependency-lock rules + Staff Only gate
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

  if coalesce(v_task.staff_only, false) and not public.is_project_staff() then
    raise exception 'STAFF_ONLY: This task is Staff Only and cannot be claimed by volunteers.';
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
      'rate_limit_bypass', v_bypass,
      'staff_only', coalesce(v_task.staff_only, false)
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

comment on function public.claim_task is
  'Claim Medium/Small leaf tasks only. Staff Only tasks can be claimed by staff/founders, not volunteers.';

-- ---------------------------------------------------------------------------
-- request_join_claim — volunteers cannot join Staff Only work
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

  if exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and coalesce(t.staff_only, false)
  ) and not public.is_project_staff() then
    raise exception 'STAFF_ONLY: This task is Staff Only. Volunteers cannot join it.';
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

  -- One pending request per claim
  select * into v_req
  from claim_join_requests
  where claim_id = v_claim.id and requester_id = v_uid and status = 'pending'
  limit 1;

  if found then
    raise exception 'You already have a pending join request on this task';
  end if;

  -- Already approved helper
  if exists (
    select 1 from claim_join_requests
    where claim_id = v_claim.id
      and requester_id = v_uid
      and status = 'approved'
  ) then
    raise exception 'You are already helping on this task';
  end if;

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
