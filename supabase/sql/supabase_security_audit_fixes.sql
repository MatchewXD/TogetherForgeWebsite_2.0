-- =============================================================================
-- Security audit fixes (Forge #168)
--
-- Closes the database holes found in the pre-launch security audit. Each
-- section says what an attacker could do before it. Nothing here changes what
-- normal members see or do through the site: every legitimate write already
-- goes through SECURITY DEFINER RPCs or Edge Functions.
--
--   1. Claimants could write task_claims / tasks directly through the REST API:
--      mark their own claim Completed (permanent memorial credit, badges,
--      claim-limit reputation) without staff review, insert a claim with any
--      status (skipping every claim rule), or edit any column of a task they
--      held. Members could also insert fake activity_log rows.
--   2. apply_claim_restriction() was executable by every signed-in member and
--      has no caller check: anyone could restrict (up to permanently) any
--      other member from claiming tasks.
--   3. run_claim_auto_release() / return_stale_claims() are executable by anon.
--      Calling run_claim_auto_release(0, 1) released every Active claim on the
--      site. Non-staff callers now always get the standard 14 / 30 day sweep.
--   4. ensure_project_contribution() was executable by every signed-in member
--      with no checks: anyone could write permanent public credits for any
--      user, project, category and display name (or un-archive credits staff
--      had archived). Members may now only backfill credits the database can
--      prove, with names taken from the database.
--   5. Internal SECURITY DEFINER helpers (AI token credit/debit, Forge Mark
--      grants, badge / conduct helpers, ...) were only revoked from PUBLIC.
--      On Supabase, new functions in the public schema are also granted to
--      anon and authenticated by default, so e.g. credit_ai_tokens() could be
--      called by anyone to mint AI tokens for themselves. They are now
--      service_role only (SECURITY DEFINER callers are unaffected).
--   6. bug_reports was fully readable by anyone, including reporter_email
--      (defaults to the reporter's account email) and staff_notes.
--   7. claim_join_requests was fully readable by anyone (requester ids and
--      messages), and members could insert requests directly (skipping
--      request_join_claim checks) or self-approve their own request row.
--   8. task_scope_requests was fully readable by anyone, including requests on
--      staff-only Staging tasks; requesters could set their own resolution.
--   9. Storage buckets had no size or MIME limits, and avatars had no file
--      type check: any member could host arbitrary files (HTML, SVG, video,
--      large archives) on the public buckets.
--
-- Deploy order: ship the site code from the same branch FIRST (bug reports no
-- longer select('*')), then run this script.
-- Run AFTER every other script in supabase/sql (it is the last hardening
-- step), including supabase_claims_activity_lockdown.sql.
-- Safe to re-run. Run on STAGING first, then production.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Direct writes to task_claims / tasks / activity_log: staff only
-- ---------------------------------------------------------------------------
drop policy if exists "Claimants can update claimed tasks" on public.tasks;

drop policy if exists "Members can claim tasks" on public.task_claims;
drop policy if exists "Staff can insert claims" on public.task_claims;
create policy "Staff can insert claims" on public.task_claims for insert
  with check (public.is_project_staff());

drop policy if exists "Owners or staff can update claims" on public.task_claims;
drop policy if exists "Staff can update claims" on public.task_claims;
create policy "Staff can update claims" on public.task_claims for update
  using (public.is_project_staff());

drop policy if exists "Owners or staff can delete claims" on public.task_claims;
drop policy if exists "Staff can delete claims" on public.task_claims;
create policy "Staff can delete claims" on public.task_claims for delete
  using (public.is_project_staff());

drop policy if exists "Members can insert activity" on public.activity_log;
drop policy if exists "Staff can insert activity" on public.activity_log;
create policy "Staff can insert activity" on public.activity_log for insert
  with check (public.is_project_staff());

-- ---------------------------------------------------------------------------
-- 2. apply_claim_restriction: internal only
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.apply_claim_restriction(uuid, uuid, text, uuid, uuid, boolean)') is not null then
    revoke all on function public.apply_claim_restriction(uuid, uuid, text, uuid, uuid, boolean)
      from public, anon, authenticated;
    grant execute on function public.apply_claim_restriction(uuid, uuid, text, uuid, uuid, boolean)
      to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Claim auto-release: only staff / server callers choose the windows
--    (same definitions as supabase_task_hold_claim.sql)
-- ---------------------------------------------------------------------------
create or replace function public.claim_auto_release_caller_trusted()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
begin
  if v_role not in ('anon', 'authenticated') then
    return true;
  end if;
  return coalesce(public.is_project_staff(), false);
end;
$$;

revoke all on function public.claim_auto_release_caller_trusted() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auto-release skips held cards (and still skips the Tether-CD epic)
-- ---------------------------------------------------------------------------
create or replace function public.run_claim_auto_release(
  p_idle_days integer default 14,
  p_max_claim_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_task tasks%rowtype;
  -- Anyone may run the standard sweep, but only staff / server callers may
  -- change the windows (otherwise anon could call (0, 1) and release every
  -- claim on the site). See supabase_security_audit_fixes.sql.
  v_trusted boolean := public.claim_auto_release_caller_trusted();
  -- 0 = treat every Active claim as idle-overdue (staff test helper)
  v_idle int := case
    when v_trusted then greatest(coalesce(p_idle_days, 14), 0)
    else 14
  end;
  v_max int := case
    when v_trusted then greatest(coalesce(p_max_claim_days, 30), 1)
    else 30
  end;
  v_reason text;
  v_released jsonb := '[]'::jsonb;
  v_count int := 0;
  -- idle 0 → cutoff = now() so any real last_activity in the past counts as idle
  v_idle_cutoff timestamptz := case
    when v_idle = 0 then now()
    else now() - make_interval(days => v_idle)
  end;
  v_max_cutoff timestamptz := now() - make_interval(days => v_max);
  v_idle_label int := case when v_idle = 0 then 14 else v_idle end;
begin
  for r in
    select c.*
    from task_claims c
    where c.status = 'Active'
      and not exists (
        select 1
        from public.tasks t
        where t.id = c.task_id
          and coalesce(t.hold_claim, false)
      )
      and (
        -- Hard maximum claim duration (from claimed_at)
        coalesce(c.claimed_at, c.last_activity_at, now()) < v_max_cutoff
        -- Idle: no meaningful progress for idle window
        or coalesce(c.last_activity_at, c.claimed_at, now()) < v_idle_cutoff
      )
    order by c.claimed_at asc nulls first
  loop
    -- Community Decisions epic stays claimed until staff complete the game.
    if exists (
      select 1
      from public.tasks t
      where t.id = r.task_id
        and t.parent_task_id is null
        and t.title ~ '^Tether-CD( |$)'
    ) then
      continue;
    end if;

    -- Prefer hard-max reason when both apply (skip max when idle is force-test 0
    -- unless the claim truly exceeded max days)
    if coalesce(r.claimed_at, r.last_activity_at, now()) < v_max_cutoff then
      v_reason := 'max_duration';
    else
      v_reason := 'idle';
    end if;

    update task_claims
    set
      status = 'Returned',
      notes = trim(both from coalesce(notes, '') || E'\n' || case
        when v_reason = 'max_duration' then
          '[auto-released: hard maximum of ' || v_max || ' days reached]'
        else
          '[auto-released: no meaningful progress for ' || v_idle_label || ' days]'
      end)
    where id = r.id
      and status = 'Active';

    if not found then
      continue;
    end if;

    select * into v_task from tasks where id = r.task_id;

    if found and v_task.status in ('InProgress', 'ToDo') then
      if not exists (
        select 1
        from task_claims
        where task_id = r.task_id
          and status in ('Active', 'PendingReview')
          and id <> r.id
      ) then
        update tasks
        set status = 'ToDo'
        where id = r.task_id
          and status is distinct from 'Completed'
          and status is distinct from 'InReview';
      end if;
    end if;

    if found then
      insert into activity_log (
        project_id, user_id, action, target_type, target_id, target_title, metadata
      )
      values (
        v_task.project_id,
        r.user_id,
        'auto_released',
        'task',
        r.task_id,
        v_task.title,
        jsonb_build_object(
          'claim_id', r.id,
          'reason', v_reason,
          'idle_days', v_idle_label,
          'max_claim_days', v_max,
          'claimed_at', r.claimed_at,
          'last_activity_at', r.last_activity_at,
          'test_force_idle', (v_idle = 0)
        )
      );
    end if;

    v_released := v_released || jsonb_build_array(
      jsonb_build_object(
        'claim_id', r.id,
        'task_id', r.task_id,
        'user_id', r.user_id,
        'task_title', coalesce(v_task.title, 'Task'),
        'project_id', v_task.project_id,
        'reason', v_reason,
        'idle_days', v_idle_label,
        'max_claim_days', v_max,
        'test_force_idle', (v_idle = 0)
      )
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'released_count', v_count,
    'idle_days', v_idle_label,
    'max_claim_days', v_max,
    'test_force_idle', (v_idle = 0),
    'released', v_released
  );
end;
$$;

grant execute on function public.run_claim_auto_release(integer, integer)
  to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. ensure_project_contribution: caller check
--    (same definition as supabase_contributions_memorial.sql)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_project_contribution(
  p_project_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_category text,
  p_subcategory text default null,
  p_role_label text default null,
  p_source_key text default null,
  p_project_title text default null,
  p_username text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_title text;
  v_display text;
  v_username text;
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  v_key text := nullif(trim(coalesce(p_source_key, '')), '');
  v_subcategory text := p_subcategory;
  v_role_label text := p_role_label;
  v_project_id uuid := p_project_id;
  v_sc_name text;
  v_sc_tag text;
  v_trusted boolean := true;
begin
  if p_category is null
     or p_category not in ('donations', 'development', 'marketing', 'community') then
    raise exception 'Invalid contribution category';
  end if;

  -- Non-donation rows need a user
  if p_category <> 'donations' and p_user_id is null then
    raise exception 'Account required for this contribution category';
  end if;

  -- Caller check (security audit). Trusted: the memorial trigger, server-side
  -- callers (SQL Editor, cron, service role) and staff. Signed-in members may
  -- only backfill a credit the database can prove (completed claim, own idea,
  -- approved showcase post), and the names / labels are taken from the
  -- database, not from the caller.
  if pg_trigger_depth() = 0
     and v_role in ('anon', 'authenticated')
     and not coalesce(public.is_project_staff(), false)
  then
    v_trusted := false;
    if v_role = 'anon' or v_key is null then
      raise exception 'Not allowed to record this credit' using errcode = '42501';
    end if;

    if v_key like 'task-claim:%' then
      if p_category <> 'development' or not exists (
        select 1
        from task_claims c
        join tasks t on t.id = c.task_id
        where c.id::text = substr(v_key, 12)
          and c.status = 'Completed'
          and c.user_id = p_user_id
          and (p_project_id is null or t.project_id = p_project_id)
      ) then
        raise exception 'Not allowed to record this credit' using errcode = '42501';
      end if;
      v_role_label := null;
    elsif v_key like 'idea:%' then
      if p_category <> 'community' or not exists (
        select 1 from ideas i
        where i.id::text = substr(v_key, 6)
          and i.user_id = p_user_id
      ) then
        raise exception 'Not allowed to record this credit' using errcode = '42501';
      end if;
      v_project_id := null;
      v_subcategory := 'Feedback';
      v_role_label := 'Idea author';
    elsif v_key like 'showcase:%' then
      select s.creator_display_name, s.project_tag
        into v_sc_name, v_sc_tag
      from community_showcase_posts s
      where s.id::text = substr(v_key, 10)
        and s.status = 'approved'
        and s.creator_user_id = p_user_id;
      if not found or p_category <> 'marketing' then
        raise exception 'Not allowed to record this credit' using errcode = '42501';
      end if;
      v_subcategory := 'Content Creation';
      v_role_label := 'Community Showcase';
    else
      raise exception 'Not allowed to record this credit' using errcode = '42501';
    end if;

    if v_project_id is not null
       and not exists (select 1 from projects where id = v_project_id) then
      v_project_id := null;
    end if;

    -- Names and titles come from the database, never the caller
    v_display := case
      when v_key like 'showcase:%' then nullif(trim(v_sc_name), '')
      else null
    end;
    v_username := null;
    v_subcategory := left(nullif(trim(coalesce(v_subcategory, '')), ''), 60);
    v_title := case
      when v_project_id is not null then null
      when v_key like 'idea:%' then 'Ideas'
      when v_key like 'showcase:%' then
        'Community Showcase'
        || coalesce(' · ' || left(nullif(trim(v_sc_tag), ''), 60), '')
      else null
    end;
  else
    v_display := nullif(trim(coalesce(p_display_name, '')), '');
    v_username := nullif(trim(coalesce(p_username, '')), '');
    v_title := nullif(trim(coalesce(p_project_title, '')), '');
  end if;

  if v_display is null and p_user_id is not null then
    select coalesce(nullif(trim(username), ''), 'Contributor')
      into v_display
    from profiles
    where id = p_user_id;
  end if;
  v_display := coalesce(v_display, 'Contributor');

  if v_username is null and p_user_id is not null then
    select nullif(trim(username), '') into v_username
    from profiles where id = p_user_id;
  end if;

  if v_title is null and v_project_id is not null then
    select coalesce(nullif(trim(title), ''), nullif(trim(slug), ''), 'Project')
      into v_title
    from projects
    where id = v_project_id;
  end if;

  if p_source_key is not null and trim(p_source_key) <> '' then
    select id into v_id
    from project_contributions
    where source_key = trim(p_source_key)
    limit 1;

    if v_id is not null then
      -- Refresh snapshots if empty; never drop the credit
      update project_contributions
      set
        display_name = coalesce(nullif(trim(display_name), ''), v_display),
        username_snapshot = coalesce(username_snapshot, v_username),
        project_title_snapshot = coalesce(project_title_snapshot, v_title),
        project_id = coalesce(project_id, v_project_id),
        -- Only trusted callers restore a credit staff archived
        archived_at = case when v_trusted then null else archived_at end,
        updated_at = now()
      where id = v_id;
      return v_id;
    end if;
  end if;

  insert into project_contributions (
    project_id,
    user_id,
    display_name,
    category,
    subcategory,
    role_label,
    source_key,
    project_title_snapshot,
    username_snapshot,
    is_anonymous,
    sort_order
  ) values (
    v_project_id,
    p_user_id,
    v_display,
    p_category,
    nullif(trim(coalesce(v_subcategory, '')), ''),
    nullif(trim(coalesce(v_role_label, '')), ''),
    nullif(trim(coalesce(p_source_key, '')), ''),
    v_title,
    v_username,
    false,
    0
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ensure_project_contribution(
  uuid, uuid, text, text, text, text, text, text, text
) from public;
grant execute on function public.ensure_project_contribution(
  uuid, uuid, text, text, text, text, text, text, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Internal SECURITY DEFINER helpers: service_role only
--    (every overload; functions that do not exist are skipped)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        -- AI tokens (Edge Functions only)
        'credit_ai_tokens',
        'try_debit_ai_tokens',
        'try_debit_ai_tokens_up_to',
        'ensure_ai_token_balance',
        'get_ai_studio_spend_micros',
        'grant_ai_token_pack_purchase',
        -- Forge Marks (Stripe webhook only)
        'ensure_forge_mark_balance',
        'grant_forge_marks_from_donation',
        'clawback_forge_marks_for_donation',
        -- Task restrictions (reject_task_as_fake_work only)
        'apply_claim_restriction',
        -- Badges: helpers called from sync_user_badges; some read private
        -- facts (donation totals, active subscription) for any user id
        'backfill_all_user_badges',
        'badge_comment_is_meaningful',
        'badge_recognition_keys_for_user',
        'user_awards_given_count',
        'user_awards_received_count',
        'user_completed_task_count',
        'user_donation_total_cents',
        'user_feedback_on_others_count',
        'user_has_active_subscription',
        'user_has_early_support',
        'user_has_joined_force',
        'user_has_shared_victory',
        'user_has_shipped_game',
        'user_marks_spent_on_awards',
        'user_max_awards_on_target',
        'user_max_idea_comments_by_others',
        'user_max_idea_masterworks',
        'user_max_idea_votes',
        'user_max_showcase_likes',
        'user_meaningful_comment_count',
        'user_public_idea_count',
        'user_showcase_submission_count',
        'user_task_claim_count',
        -- Conduct helpers (called from the conduct RPCs and triggers)
        'conduct_ensure_account',
        'conduct_has_prior_notice',
        'conduct_is_restricted',
        'conduct_log',
        'conduct_new_case_code',
        -- Staff credit / volunteer helpers
        'staff_credit_email_hash',
        'volunteer_apply_is_blocked',
        -- Auto-release caller check (section 3)
        'claim_auto_release_caller_trusted'
      ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. bug_reports: reporter_email and staff_notes are not public
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.bug_reports') is null then
    raise notice 'bug_reports missing: section 6 skipped';
    return;
  end if;
  revoke select on table public.bug_reports from anon, authenticated;
  grant select (
    id, title, description, steps_to_reproduce, severity, status,
    screenshot_url, browser_info, device_info, reporter_id, reporter_name,
    created_at, updated_at, resolved_at
  ) on table public.bug_reports to anon, authenticated;
  grant select on table public.bug_reports to service_role;
  revoke insert on table public.bug_reports from anon;
end $$;

-- ---------------------------------------------------------------------------
-- 7. claim_join_requests: requester, claim holder and staff only
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.claim_join_requests') is null then
    raise notice 'claim_join_requests missing: section 7 skipped';
    return;
  end if;

  drop policy if exists "Public can read join requests" on public.claim_join_requests;
  drop policy if exists "Requester, claim holder or staff can read join requests" on public.claim_join_requests;
  create policy "Requester, claim holder or staff can read join requests"
    on public.claim_join_requests for select
    to authenticated
    using (
      auth.uid() = requester_id
      or public.is_project_staff()
      or exists (
        select 1 from public.task_claims tc
        where tc.id = claim_join_requests.claim_id
          and tc.user_id = auth.uid()
      )
    );

  -- New requests go through request_join_claim()
  drop policy if exists "Users can request to join" on public.claim_join_requests;

  drop policy if exists "Requester can cancel own request" on public.claim_join_requests;
  create policy "Requester can cancel own request"
    on public.claim_join_requests for update
    to authenticated
    using (auth.uid() = requester_id)
    with check (auth.uid() = requester_id and status in ('pending', 'cancelled'));
end $$;

-- ---------------------------------------------------------------------------
-- 8. task_scope_requests: Public-board rows, the requester and staff
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.task_scope_requests') is null then
    raise notice 'task_scope_requests missing: section 8 skipped';
    return;
  end if;

  drop policy if exists "Public can read scope requests" on public.task_scope_requests;
  create policy "Public can read scope requests"
    on public.task_scope_requests for select
    using (
      auth.uid() = requester_id
      or public.is_project_staff()
      or exists (
        select 1 from public.tasks t
        where t.id = task_scope_requests.task_id
          and coalesce(t.board_scope, 'public') = 'public'
      )
    );

  -- New requests go through request_task_scope_help()
  drop policy if exists "Claimants can create scope requests" on public.task_scope_requests;

  drop policy if exists "Requester can cancel own scope request" on public.task_scope_requests;
  create policy "Requester can cancel own scope request"
    on public.task_scope_requests for update
    to authenticated
    using (auth.uid() = requester_id)
    with check (auth.uid() = requester_id and status in ('pending', 'cancelled'));
end $$;

-- ---------------------------------------------------------------------------
-- 9. Storage: 5 MB images only on every public bucket (the site already
--    limits uploads to 5 MB JPEG / PNG / WebP / GIF in the browser)
-- ---------------------------------------------------------------------------
do $$
begin
  update storage.buckets
  set
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  where id in ('avatars', 'idea-images', 'showcase-images', 'question-images', 'bug-screenshots');

  drop policy if exists "Users can upload own avatar folder" on storage.objects;
  create policy "Users can upload own avatar folder"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
      and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif'))
    );

  drop policy if exists "Users can update own avatar folder" on storage.objects;
  create policy "Users can update own avatar folder"
    on storage.objects for update
    to authenticated
    using (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    )
    with check (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
      and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif'))
    );
exception
  when others then
    raise notice 'storage hardening skipped: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verify (each must hold; see the Forge #168 report for the full checklist)
-- ---------------------------------------------------------------------------
-- select has_function_privilege('anon', 'public.credit_ai_tokens(uuid, integer, text, text, text, text, uuid, text, text, text, text, text, jsonb)', 'execute');  -- false
-- select has_function_privilege('authenticated', 'public.apply_claim_restriction(uuid, uuid, text, uuid, uuid, boolean)', 'execute');                      -- false
-- select has_column_privilege('anon', 'public.bug_reports', 'reporter_email', 'select');                                                                   -- false
-- select polname from pg_policy where polrelid = 'public.task_claims'::regclass order by 1;  -- no "Members can claim tasks" / "Owners or staff ..."
-- select id, file_size_limit, allowed_mime_types from storage.buckets;                      -- 5242880 + image types
