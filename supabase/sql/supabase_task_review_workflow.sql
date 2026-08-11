-- =============================================================================
-- Task review workflow (prevent self-complete abuse)
-- Run in Supabase SQL Editor after supabase_tasks_schema.sql
-- Safe to re-run (idempotent where possible)
-- =============================================================================
-- Flow:
--   Claim → work → Submit for review (evidence required)
--   → Project Lead / moderator Accepts (Completed + credit)
--   → or Rejects (back to Active for claimant with feedback)
-- Claimants cannot unilaterally complete tasks.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Schema: claim statuses + submission / review fields
-- ---------------------------------------------------------------------------
alter table public.task_claims
  add column if not exists submission_evidence text,
  add column if not exists submitted_at timestamptz,
  add column if not exists review_feedback text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

-- Drop old status checks and allow PendingReview
alter table public.task_claims drop constraint if exists task_claims_status_check;
alter table public.task_claims
  add constraint task_claims_status_check
  check (status in ('Active', 'PendingReview', 'Completed', 'Returned'));

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('ToDo', 'InProgress', 'InReview', 'Completed'));

-- Active + pending review: one open claim per task (not free to re-claim)
drop index if exists public.idx_one_active_claim_per_task;
create unique index if not exists idx_one_open_claim_per_task
  on public.task_claims (task_id)
  where status in ('Active', 'PendingReview');

-- ---------------------------------------------------------------------------
-- 2. complete_task: STAFF ONLY (no self-complete)
-- ---------------------------------------------------------------------------
create or replace function public.complete_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not v_is_staff then
    raise exception 'Only a Project Lead or moderator can mark a task completed. Submit your work for review instead.';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status in ('Active', 'PendingReview')
  for update;

  if found then
    update task_claims set
      status = 'Completed',
      progress_percent = 100,
      last_activity_at = now(),
      reviewed_at = coalesce(reviewed_at, now()),
      reviewed_by = coalesce(reviewed_by, v_uid)
    where id = v_claim.id
    returning * into v_claim;
  end if;

  update tasks set
    status = 'Completed',
    completed_at = now(),
    subtasks = (
      select coalesce(jsonb_agg(
        case
          when jsonb_typeof(elem) = 'object'
            then elem || jsonb_build_object('done', true)
          else elem
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(coalesce(v_task.subtasks, '[]'::jsonb)) elem
    )
  where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'completed',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object('claim_id', v_claim.id, 'staff_complete', true)
  );

  return jsonb_build_object('task', to_jsonb(v_task), 'claim', to_jsonb(v_claim));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Claimant: submit for review (evidence required, min hold time)
-- ---------------------------------------------------------------------------
create or replace function public.submit_task_for_review(
  p_task_id uuid,
  p_evidence text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_evidence text := trim(coalesce(p_evidence, ''));
  v_min_hold interval := interval '2 minutes';
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if length(v_evidence) < 15 then
    raise exception 'Add a short evidence note (at least 15 characters): what you did, plus a link, PR, or file reference if you have one.';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status = 'Completed' then
    raise exception 'Task is already completed';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'Active' and user_id = v_uid
  for update;

  if not found then
    raise exception 'Only the active claimant can submit this task for review';
  end if;

  if v_claim.claimed_at is not null and v_claim.claimed_at > now() - v_min_hold then
    raise exception 'Please work on the task a bit longer before submitting for review (minimum 2 minutes after claim).';
  end if;

  -- All checklist items must be done when a checklist exists
  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_task.subtasks, '[]'::jsonb)) elem
    where jsonb_typeof(elem) = 'object'
      and coalesce(
        (elem->>'done')::boolean,
        (elem->>'completed')::boolean,
        false
      ) is not true
  ) then
    raise exception 'Complete every checklist item before submitting for review.';
  end if;

  update task_claims set
    status = 'PendingReview',
    progress_percent = greatest(coalesce(progress_percent, 0), 90),
    submission_evidence = v_evidence,
    submitted_at = now(),
    review_feedback = null,
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  update tasks set status = 'InReview' where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'submitted for review',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'claim_id', v_claim.id,
      'evidence_preview', left(v_evidence, 120)
    )
  );

  return jsonb_build_object('task', to_jsonb(v_task), 'claim', to_jsonb(v_claim));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Staff: accept or reject a pending submission
-- ---------------------------------------------------------------------------
create or replace function public.review_task_submission(
  p_task_id uuid,
  p_accept boolean,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
  v_feedback text := nullif(trim(coalesce(p_feedback, '')), '');
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not v_is_staff then
    raise exception 'Only a Project Lead or moderator can review submissions';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'PendingReview'
  for update;

  if not found then
    raise exception 'No submission waiting for review on this task';
  end if;

  if p_accept then
    update task_claims set
      status = 'Completed',
      progress_percent = 100,
      reviewed_at = now(),
      reviewed_by = v_uid,
      review_feedback = v_feedback,
      last_activity_at = now()
    where id = v_claim.id
    returning * into v_claim;

    update tasks set
      status = 'Completed',
      completed_at = now(),
      subtasks = (
        select coalesce(jsonb_agg(
          case
            when jsonb_typeof(elem) = 'object'
              then elem || jsonb_build_object('done', true)
            else elem
          end
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(v_task.subtasks, '[]'::jsonb)) elem
      )
    where id = p_task_id
    returning * into v_task;

    insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
    values (
      v_task.project_id,
      v_uid,
      'accepted',
      'task',
      v_task.id,
      v_task.title,
      jsonb_build_object(
        'claim_id', v_claim.id,
        'claimant_id', v_claim.user_id,
        'feedback', v_feedback
      )
    );

    -- Credit shoutout path uses "completed" activity for the claimant
    insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
    values (
      v_task.project_id,
      v_claim.user_id,
      'completed',
      'task',
      v_task.id,
      v_task.title,
      jsonb_build_object(
        'claim_id', v_claim.id,
        'accepted_by', v_uid,
        'review_accepted', true
      )
    );
  else
    -- Reject: return to Active for the same claimant so they can revise
    update task_claims set
      status = 'Active',
      review_feedback = coalesce(v_feedback, 'Please revise and resubmit with clearer evidence.'),
      reviewed_at = now(),
      reviewed_by = v_uid,
      submitted_at = null,
      last_activity_at = now()
    where id = v_claim.id
    returning * into v_claim;

    update tasks set
      status = 'InProgress',
      completed_at = null
    where id = p_task_id
    returning * into v_task;

    insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
    values (
      v_task.project_id,
      v_uid,
      'rejected submission on',
      'task',
      v_task.id,
      v_task.title,
      jsonb_build_object(
        'claim_id', v_claim.id,
        'claimant_id', v_claim.user_id,
        'feedback', v_claim.review_feedback
      )
    );
  end if;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'claim', to_jsonb(v_claim),
    'accepted', p_accept
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Progress updates: claimants cannot set 100% (forces review path)
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
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
  v_progress integer;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status = 'InReview' and not v_is_staff then
    raise exception 'This task is waiting for review. A Project Lead will accept or reject it soon.';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'Active'
  for update;

  if not found then
    raise exception 'No active claim on this task';
  end if;

  if v_claim.user_id <> v_uid and not v_is_staff then
    raise exception 'Only the claimant or project staff can update progress';
  end if;

  if p_progress_percent is not null then
    if p_progress_percent < 0 or p_progress_percent > 100 then
      raise exception 'Progress must be between 0 and 100';
    end if;
    -- Claimants: cap at 99 so 100% only happens via accepted review
    if not v_is_staff and p_progress_percent >= 100 then
      v_progress := 99;
    else
      v_progress := p_progress_percent;
    end if;
  else
    v_progress := null;
  end if;

  update task_claims set
    progress_percent = coalesce(v_progress, progress_percent),
    notes = coalesce(p_notes, notes),
    helpers = coalesce(p_helpers, helpers),
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  if p_subtasks is not null then
    update tasks set subtasks = p_subtasks where id = p_task_id
    returning * into v_task;
  end if;

  if v_task.status = 'ToDo' then
    update tasks set status = 'InProgress' where id = p_task_id
    returning * into v_task;
  end if;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'updated progress on',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'progress_percent', v_claim.progress_percent,
      'claim_id', v_claim.id
    )
  );

  return jsonb_build_object('claim', to_jsonb(v_claim), 'task', to_jsonb(v_task));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. claim_task: PendingReview counts toward active claim limit
--    (patch only the active count query via full replace from anti-hoarding if needed)
--    Lightweight: recreate get_my_claim_quota to count PendingReview
-- ---------------------------------------------------------------------------
create or replace function public.get_my_claim_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_active int := 0;
  v_completed int := 0;
  v_limit int := 2;
  v_last timestamptz;
  v_cooldown_ends timestamptz;
  v_can boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('signed_in', false, 'can_claim_now', false);
  end if;

  select count(*) into v_active
  from task_claims
  where user_id = v_uid and status in ('Active', 'PendingReview');

  select count(*) into v_completed
  from task_claims
  where user_id = v_uid and status = 'Completed';

  if v_completed >= 3 then
    v_limit := 5;
  else
    v_limit := 2;
  end if;

  select claimed_at into v_last
  from task_claims
  where user_id = v_uid
  order by claimed_at desc nulls last
  limit 1;

  if v_last is not null then
    v_cooldown_ends := v_last + interval '30 minutes';
  end if;

  v_can := v_active < v_limit
    and (v_cooldown_ends is null or v_cooldown_ends <= now());

  return jsonb_build_object(
    'signed_in', true,
    'active_claims', v_active,
    'completed_claims', v_completed,
    'claim_limit', v_limit,
    'cooldown_ends_at', v_cooldown_ends,
    'can_claim_now', v_can
  );
end;
$$;

-- claim_task: count Active + PendingReview toward limit
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
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  -- Best-effort stale release (if function exists)
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

  if exists (
    select 1 from task_claims
    where task_id = p_task_id and status in ('Active', 'PendingReview')
  ) then
    raise exception 'Task already has an active claim';
  end if;

  select count(*) into v_active
  from task_claims
  where user_id = v_uid and status in ('Active', 'PendingReview');

  select count(*) into v_completed
  from task_claims
  where user_id = v_uid and status = 'Completed';

  if v_completed >= 3 then
    v_limit := 5;
  end if;

  if v_active >= v_limit then
    raise exception 'Claim limit reached (% / %). Complete accepted work or return a claim first.', v_active, v_limit;
  end if;

  select claimed_at into v_last
  from task_claims
  where user_id = v_uid
  order by claimed_at desc nulls last
  limit 1;

  if v_last is not null and v_last > now() - interval '30 minutes' then
    raise exception 'Please wait before claiming another task (30 minute cooldown).';
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
    jsonb_build_object('claim_id', v_claim.id)
  );

  return jsonb_build_object('claim', to_jsonb(v_claim), 'task', to_jsonb(v_task));
end;
$$;

-- return_task_claim: allow returning PendingReview claims (staff or claimant)
create or replace function public.return_task_claim(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status in ('Active', 'PendingReview')
  for update;

  if not found then
    raise exception 'No open claim to return';
  end if;

  if v_claim.user_id <> v_uid and not v_is_staff then
    raise exception 'Only the claimant or project staff can return this claim';
  end if;

  update task_claims set
    status = 'Returned',
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  update tasks set
    status = 'ToDo',
    completed_at = null
  where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'returned',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object('claim_id', v_claim.id)
  );

  return jsonb_build_object('task', to_jsonb(v_task), 'claim', to_jsonb(v_claim));
end;
$$;

grant execute on function public.return_task_claim(uuid) to authenticated;
grant execute on function public.submit_task_for_review(uuid, text) to authenticated;
grant execute on function public.review_task_submission(uuid, boolean, text) to authenticated;
grant execute on function public.complete_task(uuid) to authenticated;
grant execute on function public.update_task_progress(uuid, integer, jsonb, text, jsonb) to authenticated;
grant execute on function public.claim_task(uuid) to authenticated;
grant execute on function public.get_my_claim_quota() to authenticated;

comment on function public.submit_task_for_review is
  'Claimant submits evidence for lead/moderator review (cannot self-complete).';
comment on function public.review_task_submission is
  'Staff accept (Completed + credit) or reject (back to Active with feedback).';
