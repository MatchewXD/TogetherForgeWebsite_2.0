-- =============================================================================
-- When staff add a Small under a claimed Medium (leaf → parent), return the
-- open claim, move the parent to To Do, and clear its checklist.
-- The previous claimant gets an activity_log row for their dashboard.
-- Safe to re-run.
-- =============================================================================

create or replace function public.release_parent_claim_if_split(p_parent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.tasks%rowtype;
  v_child_count integer := 0;
  v_released integer := 0;
  r record;
begin
  if p_parent_id is null then
    return jsonb_build_object('released_count', 0);
  end if;

  select * into v_parent
  from public.tasks
  where id = p_parent_id
  for update;
  if not found then
    return jsonb_build_object('released_count', 0);
  end if;

  -- Staff hold Community Decisions until the game is done.
  if v_parent.parent_task_id is null
     and v_parent.title ~ '^Tether-CD( |$)' then
    return jsonb_build_object('released_count', 0, 'skipped', 'community_decisions');
  end if;

  if v_parent.status = 'Completed' then
    return jsonb_build_object('released_count', 0, 'skipped', 'completed');
  end if;

  begin
    select count(*)::integer into v_child_count
    from public.tasks t
    where t.parent_task_id = p_parent_id
      and t.archived_at is null;
  exception
    when undefined_column then
      select count(*)::integer into v_child_count
      from public.tasks t
      where t.parent_task_id = p_parent_id;
  end;

  if v_child_count < 1 then
    return jsonb_build_object('released_count', 0);
  end if;

  -- Parent progress is children now — drop the leaf checklist.
  update public.tasks
  set subtasks = '[]'::jsonb
  where id = p_parent_id
    and coalesce(subtasks, '[]'::jsonb) <> '[]'::jsonb;

  for r in
    select c.*
    from public.task_claims c
    where c.task_id = p_parent_id
      and c.status in ('Active', 'PendingReview')
    for update
  loop
    update public.task_claims
    set
      status = 'Returned',
      last_activity_at = now(),
      notes = trim(both from coalesce(notes, '') || E'\n'
        || '[returned: parent split into Small tasks]')
    where id = r.id
      and status in ('Active', 'PendingReview');

    if not found then
      continue;
    end if;

    begin
      update public.claim_join_requests
      set
        status = 'cancelled',
        resolved_at = now()
      where claim_id = r.id
        and status = 'pending';
    exception
      when undefined_table then null;
      when undefined_column then null;
    end;

    insert into public.activity_log (
      project_id, user_id, action, target_type, target_id, target_title, metadata
    )
    values (
      v_parent.project_id,
      r.user_id,
      'claim_split_to_smalls',
      'task',
      v_parent.id,
      v_parent.title,
      jsonb_build_object(
        'claim_id', r.id,
        'reason', 'parent_split_to_smalls'
      )
    );

    v_released := v_released + 1;
  end loop;

  if v_released > 0 then
    update public.tasks
    set
      status = 'ToDo',
      completed_at = null
    where id = p_parent_id
      and status is distinct from 'Completed';
  end if;

  return jsonb_build_object(
    'released_count', v_released,
    'parent_id', p_parent_id,
    'title', v_parent.title
  );
end;
$$;

revoke all on function public.release_parent_claim_if_split(uuid) from public;
revoke all on function public.release_parent_claim_if_split(uuid) from anon;
revoke all on function public.release_parent_claim_if_split(uuid) from authenticated;

create or replace function public.trg_release_parent_claim_when_split()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_task_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.parent_task_id is not distinct from old.parent_task_id then
    return new;
  end if;
  perform public.release_parent_claim_if_split(new.parent_task_id);
  return new;
end;
$$;

drop trigger if exists trg_release_parent_claim_when_split on public.tasks;
create trigger trg_release_parent_claim_when_split
  after insert or update of parent_task_id
  on public.tasks
  for each row
  execute function public.trg_release_parent_claim_when_split();

comment on function public.release_parent_claim_if_split(uuid) is
  'Return an open claim on a parent when staff add nested Smalls. Parent goes to To Do.';
