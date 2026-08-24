-- =============================================================================
-- Task Board rate-limit bypass (staff + test accounts)
-- Run AFTER supabase_task_anti_abuse.sql
-- Safe to re-run.
-- =============================================================================
-- Who bypasses progressive claim limits, claim cooldown, submit 24h cap,
-- submit cooldown, and the short post-claim hold before submit:
--   • profiles.role in ('admin', 'moderator', 'project_lead', 'founder')
--   • OR profiles.task_limit_bypass = true  (staff-only flag for test accounts)
-- Normal users are unchanged. Identity gate + fake-work restrictions still apply.
-- =============================================================================

alter table if exists public.profiles
  add column if not exists task_limit_bypass boolean not null default false;

comment on column public.profiles.task_limit_bypass is
  'When true, user skips Task Board claim/submit velocity limits (test accounts). Staff roles always bypass regardless.';

-- High soft ceilings so staff cannot accidentally hold the whole board forever
-- without a hard stop, but testing is not blocked by progressive trust.
-- (Still one open claim per task; hierarchy rules unchanged.)

create or replace function public.user_bypasses_task_limits(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      coalesce(p.task_limit_bypass, false)
      or coalesce(p.role, 'user') in ('admin', 'moderator', 'project_lead', 'founder')
    from public.profiles p
    where p.id = p_user_id
  ), false);
$$;

grant execute on function public.user_bypasses_task_limits(uuid) to authenticated, anon;

create or replace function public.user_claim_limit(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.user_bypasses_task_limits(p_user_id) then 50
    when public.user_accepted_task_count(p_user_id) >= 5 then 5
    when public.user_accepted_task_count(p_user_id) >= 2 then 3
    else 2
  end;
$$;

create or replace function public.user_submit_limit_24h(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.user_bypasses_task_limits(p_user_id) then 500
    when public.user_accepted_task_count(p_user_id) >= 5 then 12
    when public.user_accepted_task_count(p_user_id) >= 2 then 4
    else 2
  end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_claim_quota — expose bypass; null cooldowns when bypassing
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
  v_pending int := 0;
  v_completed int := 0;
  v_limit int := 2;
  v_submit_limit int := 2;
  v_submits_24h int := 0;
  v_last_claim timestamptz;
  v_last_submit timestamptz;
  v_claim_cooldown_ends timestamptz;
  v_submit_cooldown_ends timestamptz;
  v_restricted boolean := false;
  v_restriction public.user_task_restrictions%rowtype;
  v_identity jsonb;
  v_can_claim boolean := false;
  v_can_submit boolean := false;
  v_bypass boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('signed_in', false, 'can_claim_now', false, 'can_submit_now', false);
  end if;

  v_bypass := public.user_bypasses_task_limits(v_uid);

  select count(*) into v_active
  from task_claims
  where user_id = v_uid and status = 'Active';

  select count(*) into v_pending
  from task_claims
  where user_id = v_uid and status = 'PendingReview';

  v_completed := public.user_accepted_task_count(v_uid);
  v_limit := public.user_claim_limit(v_uid);
  v_submit_limit := public.user_submit_limit_24h(v_uid);
  v_restricted := public.user_is_claim_restricted(v_uid);
  v_identity := public.user_identity_gate_status(v_uid);

  select * into v_restriction
  from public.user_task_restrictions
  where user_id = v_uid;

  select count(*) into v_submits_24h
  from task_claims
  where user_id = v_uid
    and submitted_at is not null
    and submitted_at > now() - interval '24 hours';

  select max(claimed_at) into v_last_claim
  from task_claims
  where user_id = v_uid and claimed_at is not null;

  select max(submitted_at) into v_last_submit
  from task_claims
  where user_id = v_uid and submitted_at is not null;

  if not v_bypass then
    if v_last_claim is not null then
      v_claim_cooldown_ends := v_last_claim + interval '30 minutes';
    end if;
    if v_last_submit is not null then
      v_submit_cooldown_ends := v_last_submit + interval '45 minutes';
    end if;
  end if;

  if v_bypass then
    v_can_claim :=
      not v_restricted
      and coalesce((v_identity->>'meets_gate')::boolean, false)
      and (v_active + v_pending) < v_limit;
    v_can_submit :=
      not v_restricted
      and coalesce((v_identity->>'meets_gate')::boolean, false);
  else
    v_can_claim :=
      not v_restricted
      and coalesce((v_identity->>'meets_gate')::boolean, false)
      and (v_active + v_pending) < v_limit
      and (v_claim_cooldown_ends is null or v_claim_cooldown_ends <= now());
    v_can_submit :=
      not v_restricted
      and coalesce((v_identity->>'meets_gate')::boolean, false)
      and v_submits_24h < v_submit_limit
      and (v_submit_cooldown_ends is null or v_submit_cooldown_ends <= now());
  end if;

  return jsonb_build_object(
    'signed_in', true,
    'active_claims', v_active + v_pending,
    'active_working', v_active,
    'pending_review', v_pending,
    'completed_claims', v_completed,
    'claim_limit', v_limit,
    'submit_limit_24h', v_submit_limit,
    'submits_last_24h', v_submits_24h,
    'cooldown_ends_at', v_claim_cooldown_ends,
    'submit_cooldown_ends_at', v_submit_cooldown_ends,
    'can_claim_now', v_can_claim,
    'can_submit_now', v_can_submit,
    'is_restricted', v_restricted,
    'restriction_permanent', coalesce(v_restriction.is_permanent, false),
    'restricted_until', v_restriction.restricted_until,
    'restriction_reason', v_restriction.last_reason,
    'fake_rejection_count', coalesce(v_restriction.fake_rejection_count, 0),
    'identity', v_identity,
    'rate_limit_bypass', v_bypass,
    'trust_tier', case
      when v_bypass then 'staff'
      when v_completed >= 5 then 'trusted'
      when v_completed >= 2 then 'established'
      else 'new'
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_task — skip progressive limit + claim cooldown when bypass
-- If you re-run this file, also re-run supabase_task_staff_only.sql so the
-- Staff Only claim gate stays in claim_task (insert trigger still enforces it).
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
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  v_bypass := public.user_bypasses_task_limits(v_uid);

  if not public.user_meets_identity_gate(v_uid) then
    raise exception 'IDENTITY_GATE: Verify your email and link Discord or Google before claiming tasks.';
  end if;

  if public.user_is_claim_restricted(v_uid) then
    raise exception 'CLAIM_RESTRICTED: Your claim privileges are temporarily limited due to prior review issues. Contact a Project Lead via Discord to appeal.';
  end if;

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

  v_completed := public.user_accepted_task_count(v_uid);
  v_limit := public.user_claim_limit(v_uid);

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
    'claim_limit', v_limit,
    'rate_limit_bypass', v_bypass
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_task_for_review — skip velocity + cooldown + min-hold when bypass
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
  v_note text;
  v_min_hold interval := interval '2 minutes';
  v_submit_limit int;
  v_submits_24h int;
  v_last_submit timestamptz;
  v_bypass boolean := false;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  v_bypass := public.user_bypasses_task_limits(v_uid);

  if not public.user_meets_identity_gate(v_uid) then
    raise exception 'IDENTITY_GATE: Verify your email and link Discord or Google before submitting for review.';
  end if;

  if public.user_is_claim_restricted(v_uid) then
    raise exception 'CLAIM_RESTRICTED: Your claim privileges are limited, so you cannot submit new work for review right now. Contact a Project Lead via Discord to appeal.';
  end if;

  v_note := public.evidence_note_body(v_evidence);
  if length(v_note) < 15 then
    raise exception 'EVIDENCE_REQUIRED: Add a short evidence note (at least 15 characters) describing what you delivered.';
  end if;

  if not public.evidence_has_url(v_evidence) then
    raise exception 'EVIDENCE_LINK_REQUIRED: Include at least one evidence link (URL) so reviewers can verify your work.';
  end if;

  if not v_bypass then
    v_submit_limit := public.user_submit_limit_24h(v_uid);

    select count(*) into v_submits_24h
    from task_claims
    where user_id = v_uid
      and submitted_at is not null
      and submitted_at > now() - interval '24 hours';

    if v_submits_24h >= v_submit_limit then
      raise exception 'SUBMIT_LIMIT: Review submission limit reached (% / % in 24 hours). Limits rise after accepted reviews.',
        v_submits_24h, v_submit_limit;
    end if;

    select max(submitted_at) into v_last_submit
    from task_claims
    where user_id = v_uid and submitted_at is not null;

    if v_last_submit is not null and v_last_submit > now() - interval '45 minutes' then
      raise exception 'SUBMIT_COOLDOWN: Wait about % more minutes before submitting another task for review.',
        ceil(extract(epoch from (v_last_submit + interval '45 minutes' - now())) / 60.0);
    end if;
  else
    v_submit_limit := public.user_submit_limit_24h(v_uid);
    v_submits_24h := 0;
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

  if not v_bypass
     and v_claim.claimed_at is not null
     and v_claim.claimed_at > now() - v_min_hold then
    raise exception 'Please work on the task a bit longer before submitting for review (minimum 2 minutes after claim).';
  end if;

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
      'evidence_preview', left(v_evidence, 120),
      'submits_24h', v_submits_24h + 1,
      'submit_limit', v_submit_limit,
      'rate_limit_bypass', v_bypass
    )
  );

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'claim', to_jsonb(v_claim),
    'rate_limit_bypass', v_bypass
  );
end;
$$;

grant execute on function public.get_my_claim_quota() to authenticated;
grant execute on function public.claim_task(uuid) to authenticated;
grant execute on function public.submit_task_for_review(uuid, text) to authenticated;
grant execute on function public.user_claim_limit(uuid) to authenticated, anon;
grant execute on function public.user_submit_limit_24h(uuid) to authenticated, anon;

comment on function public.user_bypasses_task_limits is
  'True for staff (admin/moderator/project_lead) or profiles.task_limit_bypass — skips Task Board velocity limits.';
