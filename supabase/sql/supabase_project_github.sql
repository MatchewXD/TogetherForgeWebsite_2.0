-- =============================================================================
-- Per-project GitHub link + contribution metadata (Task Board workflow)
-- Run in Supabase SQL Editor after supabase_tasks_schema.sql
-- Safe to re-run.
-- =============================================================================
-- github_url: optional repo or GitHub Project board URL (staff-editable).
-- contribution_meta: future-friendly JSON for Discord notify channels, etc.
--   Example shape (all optional):
--   {
--     "discord_notify_channel_id": null,
--     "discord_review_channel_id": null,
--     "prefer_pr_evidence": true,
--     "default_branch": "main"
--   }
-- =============================================================================

alter table if exists public.projects
  add column if not exists github_url text;

alter table if exists public.projects
  add column if not exists contribution_meta jsonb not null default '{}'::jsonb;

comment on column public.projects.github_url is
  'Optional GitHub repository or Project board URL shown on the Task Board.';
comment on column public.projects.contribution_meta is
  'Future contribution workflow settings (Discord notify channels, PR defaults).';

-- Optional: seed Tether / prototype-systems if you already have a repo URL
-- update public.projects
-- set github_url = 'https://github.com/your-org/tether'
-- where slug = 'prototype-systems' and (github_url is null or github_url = '');
