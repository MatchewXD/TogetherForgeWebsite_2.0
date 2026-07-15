-- Link ideas to project workspaces
-- Run in Supabase → SQL Editor → Run

alter table if exists ideas add column if not exists project_id text;
create index if not exists idx_ideas_project_id on ideas (project_id);

-- Optional: backfill nothing — new submits with ?project=slug set project_id
-- Verify: select id, title, project_id from ideas order by created_at desc limit 20;
