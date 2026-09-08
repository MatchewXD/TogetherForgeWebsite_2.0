-- Delete invalid self-blockers and ensure they cannot be written again.
-- Safe to re-run.

delete from public.task_dependencies
where task_id = blocks_on_task_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_dependencies_no_self'
      and conrelid = 'public.task_dependencies'::regclass
  ) then
    alter table public.task_dependencies
      add constraint task_dependencies_no_self
      check (task_id <> blocks_on_task_id);
  end if;
end $$;
