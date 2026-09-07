-- Cancel Tether-P.2 art suggestion cards on public and staging.
-- Archive only. Does not touch Tether-9 / 9.1 / 9.2 or Tether-3.1 / 4-6.
-- Safe to re-run.

with targets as (
  select t.id, t.title, t.board_scope, t.status, t.archived_at
  from public.tasks t
  join public.projects p on p.id = t.project_id
  where p.slug = 'tether'
    and t.title ~ '^Tether-P\.2([. ]|$)'
),
archived as (
  update public.tasks t
  set archived_at = now()
  from targets x
  where t.id = x.id
    and t.archived_at is null
  returning t.id, t.title, t.board_scope, t.status
)
select
  a.id,
  a.title,
  a.board_scope,
  a.status,
  'cancelled'::text as action
from archived a
union all
select
  x.id,
  x.title,
  x.board_scope,
  x.status,
  'already archived'::text as action
from targets x
where x.archived_at is not null
order by board_scope, title;
