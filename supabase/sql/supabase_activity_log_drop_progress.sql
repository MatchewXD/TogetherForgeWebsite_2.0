-- =============================================================================
-- Together Forge — stop logging checklist/progress ticks in activity_log
-- Run AFTER: supabase_task_review_workflow.sql
-- Safe to re-run
-- =============================================================================
-- Progress still updates task_claims.last_activity_at (idle auto-release).
-- Claim / complete / review / auto-release events stay in activity_log.
-- =============================================================================

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

  return jsonb_build_object('claim', to_jsonb(v_claim), 'task', to_jsonb(v_task));
end;
$$;

grant execute on function public.update_task_progress(uuid, integer, jsonb, text, jsonb) to authenticated;

delete from public.activity_log
where action in ('updated progress on', 'progress');
