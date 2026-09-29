-- =============================================================================
-- Hold claim (staff disables auto-release on a specific card)
-- Run AFTER: supabase_claim_auto_release.sql
-- Safe to re-run
-- =============================================================================
-- Staff can flag a task so its Active claim is not returned by the 14-day idle
-- or 30-day hard-max auto-release. Use for long-running staff work (palette
-- lock, Community Decisions) that must stay claimed until the game is done.
-- Volunteers cannot flip this flag.
-- =============================================================================

alter table if exists public.tasks
  add column if not exists hold_claim boolean not null default false;

comment on column public.tasks.hold_claim is
  'When true, Active claims on this card skip idle/max auto-release. Staff only.';

-- ---------------------------------------------------------------------------
-- Keep non-staff from flipping the flag via the claimant UPDATE policy
-- ---------------------------------------------------------------------------
create or replace function public.protect_task_hold_claim_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.hold_claim, false) and not public.is_project_staff() then
      raise exception 'HOLD_CLAIM: Only staff can create a held claim card.';
    end if;
    return new;
  end if;

  if coalesce(new.hold_claim, false) is distinct from coalesce(old.hold_claim, false)
     and not public.is_project_staff() then
    raise exception 'HOLD_CLAIM: Only staff can change the Hold claim flag.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_task_hold_claim on public.tasks;
create trigger trg_protect_task_hold_claim
  before insert or update of hold_claim on public.tasks
  for each row
  execute function public.protect_task_hold_claim_flag();

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

comment on function public.run_claim_auto_release(integer, integer) is
  'Auto-release Active claims: idle (no last_activity_at progress) or hard max from claimed_at. Skips hold_claim cards and the Tether-CD epic.';
