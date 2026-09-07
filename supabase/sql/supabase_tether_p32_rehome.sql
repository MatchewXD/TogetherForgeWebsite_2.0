-- Rehome public Tether-P.3.2 off the archived Tether-2 / P.3 leftover.
-- Nest it under a live Tether-P.3 on Tether-P First Spark and mark Done.
-- Also archive resurrected Tether-P.2.3. Safe to re-run.

do $$
declare
  v_project uuid;
  v_epic uuid;
  v_p3 uuid;
  v_p32 uuid := '325630f4-46a8-4bbb-8530-fa71520d3d0f';
  v_src public.tasks%rowtype;
begin
  select id into v_project
  from public.projects
  where slug = 'tether'
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found';
  end if;

  select id into v_epic
  from public.tasks
  where project_id = v_project
    and board_scope = 'public'
    and archived_at is null
    and title like 'Tether-P %'
    and parent_task_id is null
  order by created_at desc
  limit 1;

  if v_epic is null then
    raise exception 'Public Tether-P First Spark not found';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;

  select id into v_p3
  from public.tasks
  where project_id = v_project
    and board_scope = 'public'
    and archived_at is null
    and title like 'Tether-P.3 %'
    and parent_task_id = v_epic
  limit 1;

  if v_p3 is null then
    select * into v_src
    from public.tasks
    where id = '88514032-8e88-47ec-8e65-14b76ef6985b';

    insert into public.tasks (
      project_id, parent_task_id, title, description, category, difficulty,
      estimated_effort, status, subtasks, staff_only, board_scope, sort_order
    ) values (
      v_project,
      v_epic,
      coalesce(v_src.title, 'Tether-P.3 QA templates'),
      coalesce(v_src.description, 'Templates for the first beam playtests. Staff Only.'),
      coalesce(v_src.category, 'QA'),
      coalesce(v_src.difficulty, 'Easy'),
      coalesce(v_src.estimated_effort, 'First Spark'),
      'Completed',
      coalesce(v_src.subtasks, '[]'::jsonb),
      true,
      'public',
      coalesce(v_src.sort_order, 20)
    )
    returning id into v_p3;
  else
    update public.tasks
    set
      status = 'Completed',
      staff_only = true,
      parent_task_id = v_epic
    where id = v_p3;
  end if;

  update public.tasks
  set
    parent_task_id = v_p3,
    status = 'Completed',
    staff_only = true
  where id = v_p32
    and project_id = v_project
    and board_scope = 'public';

  update public.tasks
  set published_task_id = v_p3
  where id = '88514032-8e88-47ec-8e65-14b76ef6985b';

  update public.tasks
  set archived_at = coalesce(archived_at, now())
  where project_id = v_project
    and board_scope = 'public'
    and archived_at is null
    and title like 'Tether-P.2.3 %';

  begin
    execute 'alter table public.tasks enable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;
exception
  when others then
    begin
      execute 'alter table public.tasks enable trigger trg_protect_task_staff_only';
    exception
      when undefined_object then null;
    end;
    raise;
end $$;
