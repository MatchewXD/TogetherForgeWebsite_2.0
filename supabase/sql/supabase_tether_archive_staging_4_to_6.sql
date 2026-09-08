-- Hide published Tether-4..6 twins from Staging. Public cards stay live.
-- Does not delete. Does not touch Tether-3, 7+, or Tether-CD. Safe to re-run.

update public.tasks t
set archived_at = coalesce(t.archived_at, now())
from public.projects p
where t.project_id = p.id
  and p.slug = 'tether'
  and t.board_scope = 'staging'
  and t.archived_at is null
  and t.title ~ '^Tether-[4-6]([. ]|$)';
