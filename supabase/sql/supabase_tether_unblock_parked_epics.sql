-- Unblock staging Tether-7 / 8 / 11 / 12 / 13.
-- They waited on archived staging Tether-6, which the board shows as "Unknown task".
-- Staging only. Does not publish. Does not change public rows. Safe to re-run.

delete from public.task_dependencies d
using public.tasks a, public.tasks b, public.projects p
where d.task_id = a.id
  and d.blocks_on_task_id = b.id
  and a.project_id = p.id
  and p.slug = 'tether'
  and a.board_scope = 'staging'
  and a.title ~ '^Tether-(7|8|11|12|13)([. ]|$)'
  and b.title ~ '^Tether-6([. ]|$)';

update public.tasks t
set description = btrim(
  regexp_replace(
    t.description,
    E'\\n*Blocker: Parked until Epic 6 is playtested\\.?',
    '',
    'g'
  )
)
from public.projects p
where t.project_id = p.id
  and p.slug = 'tether'
  and t.board_scope = 'staging'
  and t.archived_at is null
  and t.title ~ '^Tether-(7|8|11|12|13)([. ]|$)'
  and t.description ~ 'Parked until Epic 6 is playtested';
