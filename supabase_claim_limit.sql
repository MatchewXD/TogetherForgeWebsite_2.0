-- Cap active task claims per user at 5.
-- Run in Supabase SQL Editor (replaces claim_task function body with limit check).

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
begin
  if v_uid is null then
    raise exception 'You must be signed in to claim a task';
  end if;

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

  select count(*)::integer into v_active_count
  from task_claims
  where user_id = v_uid and status = 'Active';

  if v_active_count >= 5 then
    raise exception 'You already have 5 active tasks. Finish or return one before claiming another.';
  end if;

  insert into task_claims (task_id, user_id, status, progress_percent, last_activity_at)
  values (p_task_id, v_uid, 'Active', 0, now())
  returning * into v_claim;

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

  return jsonb_build_object('claim', to_jsonb(v_claim), 'task_id', p_task_id, 'status', 'InProgress');
end;
$$;

grant execute on function public.claim_task(uuid) to authenticated;
