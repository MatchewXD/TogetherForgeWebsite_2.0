-- =============================================================================
-- Public slug: Prototype Systems → tether
-- Keeps the same project UUID (tasks, claims, credits stay attached).
-- Ideas that stored the old slug as project_id are remapped.
-- Safe to re-run.
-- =============================================================================

-- If a stray `tether` row already exists, do not clobber it; only rename the
-- original Early project.
update public.projects
set
  slug = 'tether',
  title = 'Tether'
where slug = 'prototype-systems'
  and not exists (
    select 1 from public.projects p2 where p2.slug = 'tether'
  );

-- Title-only cleanup if slug was already renamed
update public.projects
set title = 'Tether'
where slug = 'tether'
  and (
    title is null
    or title ilike 'prototype systems'
    or title ilike 'prototype-systems'
    or title ilike 'prototype_systems'
  );

-- Ideas that stored the retired slug (text project_id, not UUID).
-- Disable submit-rules trigger: this is a staff slug remap, not an idea edit.
alter table public.ideas disable trigger trg_ideas_submit_rules;

update public.ideas
set project_id = 'tether'
where lower(trim(project_id::text)) in (
  'prototype-systems',
  'prototype systems',
  'prototype_systems'
);

alter table public.ideas enable trigger trg_ideas_submit_rules;
