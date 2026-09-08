-- Tether PUBLIC board state fix. Does not insert new task titles.
-- Volunteer Claim stays on Tether-3.1 only. Safe to re-run.

do $$
declare
  v_project uuid;
begin
  select id into v_project from public.projects where slug = 'tether' limit 1;
  if v_project is null then
    raise exception 'Tether project not found';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;

  -- Cancel leftover art / parked chapters if they are still live on public.
  update public.tasks t
  set archived_at = coalesce(t.archived_at, now())
  where t.project_id = v_project
    and t.board_scope = 'public'
    and t.archived_at is null
    and (
      t.title ~ '^Tether-P\.2([. ]|$)'
      or t.title ~ '^Tether-(7|8|11|12|13)([. ]|$)'
    );

  -- Staff Only (existing public cards only).
  update public.tasks t
  set staff_only = true
  where t.project_id = v_project
    and t.board_scope = 'public'
    and t.archived_at is null
    and t.title ~ '^Tether-(3\.2 |9 |9\.1 |10 |10\.1 |10\.2 )';

  -- Tether-3.1 Ready: not Staff Only, no blockers.
  update public.tasks t
  set staff_only = false
  where t.project_id = v_project
    and t.board_scope = 'public'
    and t.archived_at is null
    and t.title like 'Tether-3.1 %';

  delete from public.task_dependencies d
  using public.tasks t
  where d.task_id = t.id
    and t.project_id = v_project
    and t.board_scope = 'public'
    and t.archived_at is null
    and t.title like 'Tether-3.1 %';

  -- Done, no Claim.
  update public.tasks t
  set
    status = 'Completed',
    staff_only = true
  where t.project_id = v_project
    and t.board_scope = 'public'
    and t.archived_at is null
    and (
      t.title like 'Tether-P.3.2 %'
      or t.title like 'Tether-10.1 %'
    );

  -- Replace named blockers on public cards (public IDs only).
  delete from public.task_dependencies d
  using public.tasks t
  where d.task_id = t.id
    and t.project_id = v_project
    and t.board_scope = 'public'
    and t.archived_at is null
    and t.title ~ '^Tether-(3\.2\.1 |4 |4\.1 |4\.2 |5 |5\.1 |6 |6\.1 |6\.1\.1 |6\.1\.2 |6\.2 |9\.2 )';

  insert into public.task_dependencies (task_id, blocks_on_task_id)
  select a.id, b.id
  from public.tasks a
  join public.tasks b
    on b.project_id = a.project_id
   and b.board_scope = 'public'
   and b.archived_at is null
  where a.project_id = v_project
    and a.board_scope = 'public'
    and a.archived_at is null
    and a.id is distinct from b.id
    and (
      (a.title like 'Tether-3.2.1 %' and b.title like 'Tether-3.2 %')
      or (a.title like 'Tether-4 %' and a.title not like 'Tether-4.%' and b.title like 'Tether-3.1 %')
      or (a.title like 'Tether-4.1 %' and b.title like 'Tether-3.1 %')
      or (a.title like 'Tether-4.2 %' and b.title like 'Tether-4.1 %')
      or (a.title like 'Tether-5 %' and a.title not like 'Tether-5.%' and b.title like 'Tether-4.2 %')
      or (a.title like 'Tether-5.1 %' and b.title like 'Tether-4.2 %')
      or (a.title like 'Tether-6.1.2 %' and b.title like 'Tether-6.1.1 %')
      or (a.title like 'Tether-6.2 %' and b.title like 'Tether-6.1.2 %')
      or (a.title like 'Tether-9.2 %' and b.title like 'Tether-CD.1 %')
    )
  on conflict do nothing;

  update public.tasks t
  set dependency_override = false
  where t.project_id = v_project
    and t.board_scope = 'public'
    and t.archived_at is null
    and t.title ~ '^Tether-(3\.2\.1 |4 |4\.1 |4\.2 |5 |5\.1 |6 |6\.1 |6\.1\.1 |6\.1\.2 |6\.2 |9\.2 )';

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
