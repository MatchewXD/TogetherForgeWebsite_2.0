-- =============================================================================
-- Projects: completion metadata for Early (and future Released Games)
-- Run in Supabase SQL Editor after supabase_tasks_schema.sql
-- Safe to re-run
-- =============================================================================

-- Short blurb for hub cards (optional; description remains the long form)
alter table if exists projects
  add column if not exists summary text;

-- When the project shipped / left the active board
alter table if exists projects
  add column if not exists completed_at timestamptz;

-- Release / buy / play / download links for completed work
-- Shape: [ { "label": "Play", "url": "https://...", "kind": "play" }, ... ]
alter table if exists projects
  add column if not exists completion_links jsonb default '[]'::jsonb;

-- Optional staff notes shown lightly on completed listings
alter table if exists projects
  add column if not exists completion_notes text;

-- Manual ordering within a phase (lower first)
alter table if exists projects
  add column if not exists sort_order integer default 0;

alter table if exists projects
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_projects_phase_status
  on projects (phase, status);

create index if not exists idx_projects_completed_at
  on projects (completed_at desc nulls last);

comment on column projects.summary is 'Short card blurb for phase hubs';
comment on column projects.completed_at is 'When project was marked complete / released';
comment on column projects.completion_links is 'JSON array of {label, url, kind?} release links';
comment on column projects.completion_notes is 'Optional completion notes for public listing';
comment on column projects.sort_order is 'Lower sorts first within a phase';

-- Ensure Early project exists and is titled Tether (never "Prototype Systems")
insert into projects (slug, title, description, phase, status, summary, sort_order)
values (
  'prototype-systems',
  'Tether',
  'A tethered crew crosses dangerous semi-procedural levels to reach a destroyed orbital station. Linked by a shared energy tether, players must coordinate movement, manage tension and momentum, collect critical resources for their stranded colony, and ultimately recover an antimatter generator that will let the colony survive on its own. Teamwork tools grow stronger when used together, while simple enemies try to break the tether. The tone is serious and the stakes are real: the people waiting below are counting on the crew.',
  'Early',
  'In Development',
  'A tethered crew crosses dangerous semi-procedural levels. Teamwork tools grow stronger when used together.',
  0
)
on conflict (slug) do nothing;

-- Rename any existing row still called Prototype Systems
update projects
set title = 'Tether',
    updated_at = now()
where slug = 'prototype-systems'
  and (
    title is null
    or title ilike 'prototype systems'
    or title ilike 'prototype-systems'
  );
