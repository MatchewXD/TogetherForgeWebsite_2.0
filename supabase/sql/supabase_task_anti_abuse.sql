-- =============================================================================
-- Task Board Anti-Abuse & Bot Protection
-- Run in Supabase SQL Editor AFTER:
--   supabase_tasks_schema.sql
--   supabase_claim_anti_hoarding.sql
--   supabase_task_claim_hierarchy_rules.sql
--   supabase_task_review_workflow.sql
-- Safe to re-run (idempotent where possible).
-- =============================================================================
-- Layers:
--   1) Progressive trust (claim + submit limits from accepted completions)
--   2) Submit velocity (rolling 24h cap + post-submit cooldown)
--   3) Evidence (min note + at least one URL)
--   4) Identity gate (verified email + Discord or Google SSO)
--   5) Fake-work rejections → escalating claim restrictions + audit log
--   6) Staff trust signals + board-load visibility
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Restriction state + audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.user_task_restrictions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_restricted boolean not null default false,
  is_permanent boolean not null default false,
  restricted_until timestamptz,
  fake_rejection_count integer not null default 0,
  last_reason text,
  appeal_note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.task_restriction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  reason text,
  task_id uuid references public.tasks(id) on delete set null,
  claim_id uuid references public.task_claims(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint task_restriction_events_type_check check (
    event_type in (
      'fake_reject',
      'restrict',
      'auto_restrict',
      'lift',
      'warn'
    )
  )
);

create index if not exists idx_task_restriction_events_user
  on public.task_restriction_events (user_id, created_at desc);
create index if not exists idx_task_restriction_events_created
  on public.task_restriction_events (created_at desc);

alter table public.user_task_restrictions enable row level security;
alter table public.task_restriction_events enable row level security;

drop policy if exists "Users read own task restrictions" on public.user_task_restrictions;
create policy "Users read own task restrictions"
  on public.user_task_restrictions for select
  using (auth.uid() = user_id or public.is_project_staff());

drop policy if exists "Staff manage task restrictions" on public.user_task_restrictions;
create policy "Staff manage task restrictions"
  on public.user_task_restrictions for all
  using (public.is_project_staff())
  with check (public.is_project_staff());

drop policy if exists "Users read own restriction events" on public.task_restriction_events;
create policy "Users read own restriction events"
  on public.task_restriction_events for select
  using (auth.uid() = user_id or public.is_project_staff());

drop policy if exists "Staff insert restriction events" on public.task_restriction_events;
create policy "Staff insert restriction events"
  on public.task_restriction_events for insert
  with check (public.is_project_staff());

-- ---------------------------------------------------------------------------
-- 2. Progressive trust helpers
-- ---------------------------------------------------------------------------
-- Accepted completions = task_claims.status = 'Completed' (reviewer accepted).
-- Tiers:
--   0 accepted  → max 2 claims, max 2 submits / 24h
--   2+ accepted → max 3 claims, max 4 submits / 24h
--   5+ accepted → max 5 claims, max 12 submits / 24h (soft high cap)
-- Submit cooldown after each successful submit: 45 minutes.

create or replace function public.user_accepted_task_count(p_user_id uuid)
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

-- Prefer supabase_task_limit_bypass.sql after this file for staff/test bypass.
-- These helpers are overridden there with user_bypasses_task_limits().
create or replace function public.user_claim_limit(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
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
    when public.user_accepted_task_count(p_user_id) >= 5 then 12
    when public.user_accepted_task_count(p_user_id) >= 2 then 4
    else 2
  end;
$$;

create or replace function public.user_is_claim_restricted(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.user_task_restrictions%rowtype;
begin
  select * into v_row
  from public.user_task_restrictions
  where user_id = p_user_id;

  if not found then
    return false;
  end if;

  if not v_row.is_restricted then
    return false;
  end if;

  if v_row.is_permanent then
    return true;
  end if;

  if v_row.restricted_until is not null and v_row.restricted_until > now() then
    return true;
  end if;

  -- Expired temporary restriction — treat as not restricted (lazy clear)
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Identity gate: verified email + Discord or Google identity
-- ---------------------------------------------------------------------------
create or replace function public.user_meets_identity_gate(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email_ok boolean := false;
  v_sso_ok boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  select (u.email_confirmed_at is not null)
  into v_email_ok
  from auth.users u
  where u.id = p_user_id;

  if not coalesce(v_email_ok, false) then
    return false;
  end if;

  select exists (
    select 1
    from auth.identities i
    where i.user_id = p_user_id
      and lower(i.provider) in ('discord', 'google', 'github')
  ) into v_sso_ok;

  return coalesce(v_sso_ok, false);
end;
$$;

create or replace function public.user_identity_gate_status(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email_ok boolean := false;
  v_sso_ok boolean := false;
  v_providers text[] := array[]::text[];
begin
  if p_user_id is null then
    return jsonb_build_object(
      'signed_in', false,
      'email_verified', false,
      'has_sso', false,
      'meets_gate', false,
      'providers', '[]'::jsonb
    );
  end if;

  select (u.email_confirmed_at is not null)
  into v_email_ok
  from auth.users u
  where u.id = p_user_id;

  select coalesce(array_agg(lower(i.provider) order by i.provider), array[]::text[])
  into v_providers
  from auth.identities i
  where i.user_id = p_user_id;

  v_sso_ok := exists (
    select 1 from unnest(v_providers) p
    where p in ('discord', 'google', 'github')
  );

  return jsonb_build_object(
    'signed_in', true,
    'email_verified', coalesce(v_email_ok, false),
    'has_sso', v_sso_ok,
    'meets_gate', coalesce(v_email_ok, false) and v_sso_ok,
    'providers', to_jsonb(v_providers)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Evidence helpers (min note + at least one URL)
-- ---------------------------------------------------------------------------
create or replace function public.evidence_has_url(p_evidence text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_evidence, '') ~* 'https?://[^\s<>"{}|\\^`\[\]]+';
$$;

create or replace function public.evidence_note_body(p_evidence text)
returns text
language plpgsql
immutable
as $$
declare
  v text := trim(coalesce(p_evidence, ''));
  v_links_pos int;
  v_blocked_pos int;
begin
  -- Strip structured sections added by the client composeReviewEvidence helper
  v_links_pos := position(E'\n\nLinks:' in v);
  if v_links_pos > 0 then
    v := left(v, v_links_pos - 1);
  end if;
  v_blocked_pos := position(E'\n\nBlocked by / depends on:' in v);
  if v_blocked_pos > 0 then
    v := left(v, v_blocked_pos - 1);
  end if;
  return trim(v);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Restriction apply helper (escalating)
-- ---------------------------------------------------------------------------
create or replace function public.apply_claim_restriction(
  p_user_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_task_id uuid default null,
  p_claim_id uuid default null,
  p_increment_fake boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fake int := 0;
  v_until timestamptz := null;
  v_permanent boolean := false;
  v_restricted boolean := false;
  v_event text := 'restrict';
begin
  insert into public.user_task_restrictions (user_id, fake_rejection_count)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select fake_rejection_count into v_fake
  from public.user_task_restrictions
  where user_id = p_user_id
  for update;

  if p_increment_fake then
    v_fake := coalesce(v_fake, 0) + 1;
  end if;

  -- Escalation: 2 → 7 days, 3 → 30 days, 4+ → permanent
  if v_fake >= 4 then
    v_permanent := true;
    v_restricted := true;
    v_until := null;
    v_event := 'auto_restrict';
  elsif v_fake >= 3 then
    v_restricted := true;
    v_until := now() + interval '30 days';
    v_event := 'auto_restrict';
  elsif v_fake >= 2 then
    v_restricted := true;
    v_until := now() + interval '7 days';
    v_event := 'auto_restrict';
  else
    -- First fake rejection: warn only (still counted)
    v_restricted := false;
    v_until := null;
    v_event := 'warn';
  end if;

  -- Staff explicit restrict (increment still applies; force at least 7-day if first)
  if not p_increment_fake then
    v_restricted := true;
    if not v_permanent and v_until is null then
      v_until := now() + interval '7 days';
    end if;
    v_event := 'restrict';
  end if;

  update public.user_task_restrictions set
    is_restricted = v_restricted or is_permanent,
    is_permanent = v_permanent or is_permanent,
    restricted_until = case
      when v_permanent or is_permanent then null
      when v_restricted then v_until
      else restricted_until
    end,
    fake_rejection_count = v_fake,
    last_reason = coalesce(p_reason, last_reason),
    updated_at = now(),
    updated_by = p_actor_id
  where user_id = p_user_id;

  insert into public.task_restriction_events (
    user_id, actor_id, event_type, reason, task_id, claim_id, metadata
  ) values (
    p_user_id,
    p_actor_id,
    case when p_increment_fake and v_fake = 1 then 'fake_reject' else v_event end,
    p_reason,
    p_task_id,
    p_claim_id,
    jsonb_build_object(
      'fake_rejection_count', v_fake,
      'is_restricted', v_restricted or v_permanent,
      'is_permanent', v_permanent,
      'restricted_until', v_until
    )
  );

  -- Also log a dedicated fake_reject event when this was a fake-work reject
  if p_increment_fake and v_fake > 1 then
    insert into public.task_restriction_events (
      user_id, actor_id, event_type, reason, task_id, claim_id, metadata
    ) values (
      p_user_id, p_actor_id, 'fake_reject', p_reason, p_task_id, p_claim_id,
      jsonb_build_object('fake_rejection_count', v_fake)
    );
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'fake_rejection_count', v_fake,
    'is_restricted', v_restricted or v_permanent,
    'is_permanent', v_permanent,
    'restricted_until', v_until
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. get_my_claim_quota — full snapshot for UI
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
begin
  if v_uid is null then
    return jsonb_build_object('signed_in', false, 'can_claim_now', false, 'can_submit_now', false);
  end if;

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

  if v_last_claim is not null then
    v_claim_cooldown_ends := v_last_claim + interval '30 minutes';
  end if;

  if v_last_submit is not null then
    v_submit_cooldown_ends := v_last_submit + interval '45 minutes';
  end if;

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
    'trust_tier', case
      when v_completed >= 5 then 'trusted'
      when v_completed >= 2 then 'established'
      else 'new'
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. claim_task — identity + restriction + progressive limit + hierarchy
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
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

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

  -- Hierarchy (same rules as supabase_task_claim_hierarchy_rules.sql)
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

  select max(claimed_at) into v_last
  from task_claims
  where user_id = v_uid and claimed_at is not null;

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
    jsonb_build_object(
      'claim_id', v_claim.id,
      'accepted_count', v_completed,
      'claim_limit', v_limit
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

-- ---------------------------------------------------------------------------
-- 8. submit_task_for_review — identity, velocity, evidence URL+note
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
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

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

  -- Submit velocity
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
      'submit_limit', v_submit_limit
    )
  );

  return jsonb_build_object('task', to_jsonb(v_task), 'claim', to_jsonb(v_claim));
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Staff: reject as fake work + restrict
-- ---------------------------------------------------------------------------
create or replace function public.reject_task_as_fake_work(
  p_task_id uuid,
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
  v_feedback text := nullif(trim(coalesce(p_feedback, '')), '');
  v_restrict jsonb;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_project_staff() then
    raise exception 'Only a Project Lead or moderator can reject fake work';
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

  v_feedback := coalesce(
    v_feedback,
    'This submission was flagged as fake / no real work. Your claim was released and claim privileges may be restricted.'
  );

  -- Free the board: return claim fully so others can take the task
  update task_claims set
    status = 'Returned',
    review_feedback = v_feedback,
    reviewed_at = now(),
    reviewed_by = v_uid,
    submitted_at = null,
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  update tasks set
    status = 'ToDo',
    completed_at = null
  where id = p_task_id
  returning * into v_task;

  v_restrict := public.apply_claim_restriction(
    v_claim.user_id,
    v_uid,
    v_feedback,
    p_task_id,
    v_claim.id,
    true
  );

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'rejected fake work on',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'claim_id', v_claim.id,
      'claimant_id', v_claim.user_id,
      'feedback', v_feedback,
      'restriction', v_restrict
    )
  );

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'claim', to_jsonb(v_claim),
    'restriction', v_restrict,
    'accepted', false,
    'fake_work', true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Staff: contributor trust + board load
-- ---------------------------------------------------------------------------
create or replace function public.get_contributor_trust(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_completed int := 0;
  v_active int := 0;
  v_pending int := 0;
  v_joined timestamptz;
  v_restricted boolean := false;
  v_row public.user_task_restrictions%rowtype;
  v_age_days int := 0;
begin
  if p_user_id is null then
    return jsonb_build_object('found', false);
  end if;

  -- Staff or self
  if auth.uid() is distinct from p_user_id and not public.is_project_staff() then
    raise exception 'Not allowed';
  end if;

  v_completed := public.user_accepted_task_count(p_user_id);

  select count(*) into v_active
  from task_claims
  where user_id = p_user_id and status = 'Active';

  select count(*) into v_pending
  from task_claims
  where user_id = p_user_id and status = 'PendingReview';

  select p.joined_at into v_joined
  from profiles p
  where p.id = p_user_id;

  if v_joined is not null then
    v_age_days := greatest(0, floor(extract(epoch from (now() - v_joined)) / 86400.0)::int);
  end if;

  v_restricted := public.user_is_claim_restricted(p_user_id);

  select * into v_row from public.user_task_restrictions where user_id = p_user_id;

  return jsonb_build_object(
    'found', true,
    'user_id', p_user_id,
    'accepted_tasks', v_completed,
    'active_claims', v_active,
    'pending_review', v_pending,
    'board_load', v_active + v_pending,
    'claim_limit', public.user_claim_limit(p_user_id),
    'account_age_days', v_age_days,
    'joined_at', v_joined,
    'trust_tier', case
      when v_completed >= 5 then 'trusted'
      when v_completed >= 2 then 'established'
      else 'new'
    end,
    'trust_label', case
      when v_restricted then 'Restricted'
      when v_completed >= 5 then 'Trusted'
      when v_completed >= 2 then 'Established'
      else 'New'
    end,
    'is_restricted', v_restricted,
    'restriction_permanent', coalesce(v_row.is_permanent, false),
    'restricted_until', v_row.restricted_until,
    'fake_rejection_count', coalesce(v_row.fake_rejection_count, 0)
  );
end;
$$;

create or replace function public.list_recent_restriction_events(p_limit integer default 50)
returns setof public.task_restriction_events
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_project_staff() then
    raise exception 'Only staff can list restriction events';
  end if;
  return query
  select *
  from public.task_restriction_events
  order by created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.user_accepted_task_count(uuid) to authenticated, anon;
grant execute on function public.user_claim_limit(uuid) to authenticated, anon;
grant execute on function public.user_submit_limit_24h(uuid) to authenticated, anon;
grant execute on function public.user_is_claim_restricted(uuid) to authenticated, anon;
grant execute on function public.user_meets_identity_gate(uuid) to authenticated, anon;
grant execute on function public.user_identity_gate_status(uuid) to authenticated, anon;
grant execute on function public.evidence_has_url(text) to authenticated, anon;
grant execute on function public.get_my_claim_quota() to authenticated;
grant execute on function public.claim_task(uuid) to authenticated;
grant execute on function public.submit_task_for_review(uuid, text) to authenticated;
grant execute on function public.reject_task_as_fake_work(uuid, text) to authenticated;
grant execute on function public.apply_claim_restriction(uuid, uuid, text, uuid, uuid, boolean) to authenticated;
grant execute on function public.get_contributor_trust(uuid) to authenticated;
grant execute on function public.list_recent_restriction_events(integer) to authenticated;

comment on table public.user_task_restrictions is
  'Per-user claim restriction state (fake-work escalation + manual).';
comment on table public.task_restriction_events is
  'Audit trail for claim restriction / fake-work events.';
comment on function public.reject_task_as_fake_work is
  'Staff: reject pending submission as fake work, release claim, escalate restrictions.';
comment on function public.get_contributor_trust is
  'Staff/self: trust signal + current board load for a contributor.';
