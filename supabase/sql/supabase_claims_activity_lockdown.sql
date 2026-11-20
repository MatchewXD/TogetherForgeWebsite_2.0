-- =============================================================================
-- Lock down public reads of task_claims and activity_log
--
-- Before this script, anyone with the public anon key could read:
--   * task_claims: every claim (also on Staging / staff-only boards) including
--     notes, submission_evidence and review_feedback.
--   * activity_log: every row (also about Staging tasks, with their titles)
--     including the metadata column (evidence_preview, review feedback,
--     claimant_id, fake-work restrictions, staff notes).
--
-- After this script:
--   * anon / authenticated can only SELECT safe columns (column-level grants).
--     Private columns are never readable through the table API:
--       task_claims:  notes, submission_evidence, review_feedback,
--                     reviewed_by, last_claim_at
--       activity_log: metadata
--   * Rows: the public sees claims and activity tied to Public-board tasks only
--     (accepted task suggestions count when the accepted task is public).
--     "rejected fake work on" moderation rows are never public.
--     Claimants still see their own rows, staff see every row.
--   * Private fields come from two SECURITY DEFINER RPCs that check the caller:
--       get_task_claim_private_details(uuid[]): notes / evidence / feedback for
--         claims the caller owns, or any claim for staff.
--       list_my_activity(text[], timestamptz, int): the caller's own activity
--         rows with metadata (auto-release / claim-split notices).
--   * Writes are unchanged (RPCs and Edge Functions run as owner/service_role).
--
-- Deploy order: ship the site code that uses these RPCs FIRST, then run this
-- script (old code selects the private columns and would get "permission
-- denied" once this runs).
--
-- Run AFTER supabase_task_board_scope.sql and supabase_task_suggestion_activity.sql.
-- Safe to re-run. Run on staging first, then production.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. task_claims: column-level SELECT for anon / authenticated
-- ---------------------------------------------------------------------------
revoke select on table public.task_claims from anon, authenticated;
grant select (
  id,
  task_id,
  user_id,
  claimed_at,
  progress_percent,
  last_activity_at,
  status,
  helpers,
  submitted_at,
  reviewed_at
) on table public.task_claims to anon, authenticated;
grant select on table public.task_claims to service_role;

-- ---------------------------------------------------------------------------
-- 2. task_claims: row-level SELECT policies
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read task_claims" on public.task_claims;

drop policy if exists "Public can read claims on public tasks" on public.task_claims;
create policy "Public can read claims on public tasks"
  on public.task_claims for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.tasks t
      where t.id = task_claims.task_id
        and coalesce(t.board_scope, 'public') = 'public'
    )
  );

drop policy if exists "Claimants can read own claims" on public.task_claims;
create policy "Claimants can read own claims"
  on public.task_claims for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Staff can read all claims" on public.task_claims;
create policy "Staff can read all claims"
  on public.task_claims for select
  to authenticated
  using ((select public.is_project_staff()));

-- ---------------------------------------------------------------------------
-- 3. activity_log: column-level SELECT for anon / authenticated (no metadata)
-- ---------------------------------------------------------------------------
revoke select on table public.activity_log from anon, authenticated;
grant select (
  id,
  project_id,
  user_id,
  action,
  target_type,
  target_id,
  target_title,
  created_at
) on table public.activity_log to anon, authenticated;
grant select on table public.activity_log to service_role;

-- ---------------------------------------------------------------------------
-- 4. activity_log: row-level SELECT policies
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read activity_log" on public.activity_log;

drop policy if exists "Public can read public task activity" on public.activity_log;
create policy "Public can read public task activity"
  on public.activity_log for select
  to anon, authenticated
  using (
    action is distinct from 'rejected fake work on'
    and (
      (
        coalesce(target_type, 'task') = 'task'
        and exists (
          select 1
          from public.tasks t
          where t.id = activity_log.target_id
            and coalesce(t.board_scope, 'public') = 'public'
        )
      )
      or (
        target_type = 'task_suggestion'
        and exists (
          select 1
          from public.tasks t
          where t.id::text = activity_log.metadata ->> 'accepted_task_id'
            and coalesce(t.board_scope, 'public') = 'public'
        )
      )
    )
  );

drop policy if exists "Members can read own activity" on public.activity_log;
create policy "Members can read own activity"
  on public.activity_log for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Staff can read all activity" on public.activity_log;
create policy "Staff can read all activity"
  on public.activity_log for select
  to authenticated
  using ((select public.is_project_staff()));

-- ---------------------------------------------------------------------------
-- 5. RPC: private claim fields for the claimant or staff
-- ---------------------------------------------------------------------------
create or replace function public.get_task_claim_private_details(p_claim_ids uuid[])
returns table (
  id uuid,
  notes text,
  submission_evidence text,
  review_feedback text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.notes, c.submission_evidence, c.review_feedback
  from public.task_claims c
  where auth.uid() is not null
    and c.id = any (coalesce(p_claim_ids, '{}'::uuid[])[1:1000])
    and (c.user_id = auth.uid() or public.is_project_staff());
$$;

comment on function public.get_task_claim_private_details(uuid[]) is
  'Notes, submission evidence and review feedback for the given claims; only rows the caller owns (or all, for staff).';

revoke all on function public.get_task_claim_private_details(uuid[]) from public, anon;
grant execute on function public.get_task_claim_private_details(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC: the caller's own activity rows with metadata
-- ---------------------------------------------------------------------------
create or replace function public.list_my_activity(
  p_actions text[],
  p_since timestamptz default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  project_id uuid,
  user_id uuid,
  action text,
  target_id uuid,
  target_title text,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.project_id, a.user_id, a.action, a.target_id, a.target_title,
         a.metadata, a.created_at
  from public.activity_log a
  where auth.uid() is not null
    and a.user_id = auth.uid()
    and a.action = any (coalesce(p_actions, '{}'::text[]))
    and (p_since is null or a.created_at >= p_since)
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

comment on function public.list_my_activity(text[], timestamptz, integer) is
  'The signed-in user''s own activity_log rows (with metadata) for the given actions.';

revoke all on function public.list_my_activity(text[], timestamptz, integer) from public, anon;
grant execute on function public.list_my_activity(text[], timestamptz, integer) to authenticated;

notify pgrst, 'reload schema';
