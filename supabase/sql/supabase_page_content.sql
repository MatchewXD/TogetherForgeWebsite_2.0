-- Phase page content (Early / Mid / Late hub copy editable by staff)
-- Idempotent. Run in Supabase SQL Editor if page_content is missing.

create table if not exists page_content (
  page_key text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table page_content enable row level security;

-- Public read (phase pages are public)
drop policy if exists "Public can read page_content" on page_content;
create policy "Public can read page_content"
  on page_content for select using (true);

-- Staff write: moderator | admin | project_lead (via profiles.role)
drop policy if exists "Staff can upsert page_content" on page_content;
create policy "Staff can upsert page_content"
  on page_content for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('moderator', 'admin', 'project_lead')
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('moderator', 'admin', 'project_lead')
    )
  );

comment on table page_content is 'JSON content for phase hubs and other CMS-like pages (early_game, mid_game, late_game, …)';
