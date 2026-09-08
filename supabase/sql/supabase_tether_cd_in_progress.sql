-- Hold Tether-CD Community Decisions in In Progress, claimed by MatchewXD.
-- Volunteers still cannot claim epics. Auto-release skips this card.
-- Safe to re-run.

do $$
declare
  v_project uuid;
  v_user uuid;
  v_task uuid;
  v_claim uuid;
begin
  select id into v_project from public.projects where slug = 'tether' limit 1;
  if v_project is null then
    raise exception 'Tether project not found';
  end if;

  select id into v_user
  from public.profiles
  where username = 'MatchewXD'
  limit 1;
  if v_user is null then
    raise exception 'MatchewXD profile not found';
  end if;

  -- SQL editor has no auth.uid(); claim triggers that check session would block.
  begin
    execute 'alter table public.task_claims disable trigger trg_enforce_staff_only_on_claim';
  exception
    when undefined_object then null;
  end;
  begin
    execute 'alter table public.task_claims disable trigger trg_task_claims_rate';
  exception
    when undefined_object then null;
  end;

  -- Staging cannot take claims. Still mark the staging twin In Progress.
  update public.tasks t
  set status = 'InProgress'
  from public.projects p
  where t.project_id = p.id
    and p.slug = 'tether'
    and t.archived_at is null
    and t.parent_task_id is null
    and t.title ~ '^Tether-CD( |$)'
    and t.status is distinct from 'Completed';

  for v_task in
    select t.id
    from public.tasks t
    where t.project_id = v_project
      and t.archived_at is null
      and t.parent_task_id is null
      and t.board_scope = 'public'
      and t.title ~ '^Tether-CD( |$)'
  loop
    update public.tasks
    set status = 'InProgress'
    where id = v_task
      and status is distinct from 'Completed';

    if not exists (
      select 1
      from public.task_claims
      where task_id = v_task
        and status in ('Active', 'PendingReview')
    ) then
      insert into public.task_claims (
        task_id, user_id, status, progress_percent, last_activity_at, claimed_at
      ) values (
        v_task, v_user, 'Active', 0, now(), now()
      )
      returning id into v_claim;

      insert into public.activity_log (
        project_id, user_id, action, target_type, target_id, target_title, metadata
      )
      select
        t.project_id,
        v_user,
        'claimed',
        'task',
        t.id,
        t.title,
        jsonb_build_object('claim_id', v_claim, 'community_decisions', true)
      from public.tasks t
      where t.id = v_task;
    else
      update public.task_claims
      set
        user_id = v_user,
        last_activity_at = now()
      where task_id = v_task
        and status = 'Active'
        and user_id is distinct from v_user;
    end if;
  end loop;

  begin
    execute 'alter table public.task_claims enable trigger trg_enforce_staff_only_on_claim';
  exception
    when undefined_object then null;
  end;
  begin
    execute 'alter table public.task_claims enable trigger trg_task_claims_rate';
  exception
    when undefined_object then null;
  end;
exception
  when others then
    begin
      execute 'alter table public.task_claims enable trigger trg_enforce_staff_only_on_claim';
    exception
      when undefined_object then null;
    end;
    begin
      execute 'alter table public.task_claims enable trigger trg_task_claims_rate';
    exception
      when undefined_object then null;
    end;
    raise;
end $$;
