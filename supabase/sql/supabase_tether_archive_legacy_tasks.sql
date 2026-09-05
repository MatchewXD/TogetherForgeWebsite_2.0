-- Tether only: hide leftover public/demo/empty cards that are not v0.6.
-- Unpublish them (leave the public board) and archive so they do not sit
-- beside the real staging tree. Does not delete. Does not touch v0.6 states.
-- Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_archive_legacy_tasks.sql

alter table public.tasks
  add column if not exists archived_at timestamptz;

comment on column public.tasks.archived_at is
  'When set, the task is hidden from public and staging boards. Used to retire leftover demo cards without deleting them.';

create index if not exists idx_tasks_project_archived
  on public.tasks (project_id, board_scope)
  where archived_at is null;

do $$
declare
  v_project uuid;
  v_n int;
begin
  select id into v_project
  from public.projects
  where slug = 'tether'
  limit 1;

  if v_project is null then
    raise notice 'Tether project not found; nothing to archive.';
    return;
  end if;

  -- Break publish links from leftover staging cards to leftover public copies.
  update public.tasks s
  set
    published_task_id = null,
    published_at = null
  where s.project_id = v_project
    and s.published_task_id is not null
    and not (s.title ~ '^Tether-(P|[1-9]|1[0-3])([. ]|$)')
    and exists (
      select 1
      from public.tasks p
      where p.id = s.published_task_id
        and p.project_id = v_project
        and not (p.title ~ '^Tether-(P|[1-9]|1[0-3])([. ]|$)')
    );

  -- Archive leftover Tether cards on both boards. Do not change v0.6 rows.
  -- Do not flip board_scope (publish copies; do not move boards).
  update public.tasks t
  set archived_at = coalesce(t.archived_at, now())
  where t.project_id = v_project
    and t.archived_at is null
    and not (t.title ~ '^Tether-(P|[1-9]|1[0-3])([. ]|$)');

  get diagnostics v_n = row_count;
  raise notice 'Archived % leftover Tether task(s). v0.6 titles left unchanged.', v_n;
end $$;
