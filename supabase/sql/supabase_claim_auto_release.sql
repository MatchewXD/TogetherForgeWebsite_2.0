-- =============================================================================
-- Together Forge - Claim auto-release (idle 14d + hard max 30d)
-- Run AFTER: supabase_claim_anti_hoarding.sql (and later claim_task patches)
-- Safe to re-run
-- =============================================================================
-- Rules:
--   * Idle: Active claim with no meaningful progress for p_idle_days (default 14)
--     Meaningful progress = last_activity_at (updated on progress notes, checklist,
--     submit-for-review, etc. — not on mere task views).
--   * Hard max: Active claim older than p_max_claim_days from claimed_at (default 30)
--     even if the volunteer is still posting occasional updates.
--   * PendingReview is not auto-released (waiting on staff).
--   * Released claims → Returned; task → ToDo when no other open claim.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Core dual-rule release (returns detail for staff tooling + user notices)
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
  -- 0 = treat every Active claim as idle-overdue (staff test helper)
  v_idle int := greatest(coalesce(p_idle_days, 14), 0);
  v_max int := greatest(coalesce(p_max_claim_days, 30), 1);
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
      and (
        -- Hard maximum claim duration (from claimed_at)
        coalesce(c.claimed_at, c.last_activity_at, now()) < v_max_cutoff
        -- Idle: no meaningful progress for idle window
        or coalesce(c.last_activity_at, c.claimed_at, now()) < v_idle_cutoff
      )
    order by c.claimed_at asc nulls first
  loop
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
-- Staff test: treat every Active claim as if the 14-day idle window elapsed.
-- Does NOT wait real time — for moderation / QA of the auto-release path.
-- ---------------------------------------------------------------------------
create or replace function public.run_claim_auto_release_test()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_project_staff() then
    raise exception 'Only project leads and admins can run the auto-release test';
  end if;

  -- idle_days = 0 → simulate “14 days idle” for every Active claim
  v_result := public.run_claim_auto_release(0, 30);

  return v_result || jsonb_build_object(
    'mode', 'test_idle_14d',
    'message', 'Test run: Active claims were evaluated as if idle for 14 days.'
  );
end;
$$;

grant execute on function public.run_claim_auto_release_test() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Back-compat: return_stale_claims(p_days) → idle window; hard max 30
--    Still returns integer count for older callers.
-- ---------------------------------------------------------------------------
create or replace function public.return_stale_claims(p_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.run_claim_auto_release(
    greatest(coalesce(p_days, 14), 1),
    30
  );
  return coalesce((v_result ->> 'released_count')::integer, 0);
end;
$$;

grant execute on function public.return_stale_claims(integer) to authenticated, anon;

comment on function public.run_claim_auto_release(integer, integer) is
  'Auto-release Active claims: idle (no last_activity_at progress) or hard max from claimed_at.';

comment on function public.return_stale_claims(integer) is
  'Back-compat wrapper: idle days param + 30-day hard max. Prefer run_claim_auto_release.';
