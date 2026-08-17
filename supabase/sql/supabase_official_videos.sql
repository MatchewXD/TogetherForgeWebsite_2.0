-- =============================================================================
-- Official Media library (studio videos for /media)
-- Staff (admin | moderator | project_lead) manage rows; public reads published only.
-- Run after profiles + is_project_staff() (supabase_tasks_schema.sql).
-- Safe to re-run.
-- =============================================================================

create table if not exists official_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  -- Normalized 11-char YouTube id (or full URL accepted by app before save)
  youtube_id text not null,
  thumbnail_url text,
  category text,
  -- Used for public sort (newest first)
  published_at date not null default (current_date),
  -- Public /media only shows is_published = true and archived_at is null
  is_published boolean not null default true,
  archived_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_videos_youtube_id_len check (char_length(trim(youtube_id)) >= 6)
);

create index if not exists idx_official_videos_public_list
  on official_videos (published_at desc, sort_order asc)
  where is_published = true and archived_at is null;

create index if not exists idx_official_videos_staff_list
  on official_videos (archived_at nulls first, published_at desc);

comment on table official_videos is
  'Official Together Forge videos for /media. Not community Showcase content.';

-- Volunteer credits for a video are memorial rows on project_contributions
-- (source_key = official-media:{official_videos.id}:{profiles.id}).
-- No FK: deleting a video must not erase public credit.

-- ---------------------------------------------------------------------------
-- updated_at touch
-- ---------------------------------------------------------------------------
create or replace function public.touch_official_videos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_official_videos_updated_at on official_videos;
create trigger trg_official_videos_updated_at
  before update on official_videos
  for each row
  execute function public.touch_official_videos_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table official_videos enable row level security;

-- Public: published, not archived
drop policy if exists "Public can read published official videos" on official_videos;
create policy "Public can read published official videos"
  on official_videos for select
  using (
    is_published = true
    and archived_at is null
  );

-- Staff: read all (including drafts / archived)
drop policy if exists "Staff can read all official videos" on official_videos;
create policy "Staff can read all official videos"
  on official_videos for select
  to authenticated
  using (public.is_project_staff());

drop policy if exists "Staff can insert official videos" on official_videos;
create policy "Staff can insert official videos"
  on official_videos for insert
  to authenticated
  with check (public.is_project_staff());

drop policy if exists "Staff can update official videos" on official_videos;
create policy "Staff can update official videos"
  on official_videos for update
  to authenticated
  using (public.is_project_staff())
  with check (public.is_project_staff());

drop policy if exists "Staff can delete official videos" on official_videos;
create policy "Staff can delete official videos"
  on official_videos for delete
  to authenticated
  using (public.is_project_staff());

-- Table privileges (RLS still decides which rows). Missing GRANTs →
-- PostgREST "permission denied for table official_videos".
grant usage on schema public to anon, authenticated, service_role;
grant select on table public.official_videos to anon, authenticated, service_role;
grant insert, update, delete on table public.official_videos to authenticated, service_role;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Demo seed (only if table empty) — replace youtube_id with real TF videos later.
-- Thumbnails use public site images so cards look good offline.
-- Embeds use well-known public sample videos so Watch still works in demos.
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  select count(*) into n from official_videos;
  if n > 0 then
    return;
  end if;

  insert into official_videos (
    title,
    description,
    youtube_id,
    thumbnail_url,
    category,
    published_at,
    is_published,
    sort_order
  ) values
  (
    'What is Together Forge?',
    'A short studio overview: community-first development, Early Game, and how players help ship real titles.',
    'aqz-KE-bpKQ',
    '/images/Hero_Background.webp',
    'Studio / Behind the scenes',
    current_date - 14,
    true,
    0
  ),
  (
    'Early Game progress report',
    'What we built this sprint, open tasks for volunteers, and what ships next on the Early board.',
    'eRsGyueVLvQ',
    '/images/Projects_Page.webp',
    'Progress & Updates',
    current_date - 7,
    true,
    1
  ),
  (
    'How to help: claim a task',
    'Walkthrough for new volunteers: find the workspace, claim a task, and submit for review.',
    'R6MlUcmOul8',
    '/images/Get_Involved_Background.webp',
    'Guides',
    current_date - 3,
    true,
    2
  ),
  (
    'Support & transparency (draft)',
    'Draft cut explaining Support and the Transparency Hub. Unpublished sample for staff UI testing.',
    'aqz-KE-bpKQ',
    '/images/Support_Page.webp',
    'Announcements',
    current_date - 1,
    false,
    3
  );
end $$;

-- Optional: remap older freeform labels to the current category set (safe to re-run)
update official_videos set category = 'Progress & Updates'
  where lower(trim(category)) in ('progress', 'progress & updates', 'updates');
update official_videos set category = 'Guides'
  where lower(trim(category)) in ('guides', 'guide', 'how to help', 'how-to-help');
update official_videos set category = 'Announcements'
  where lower(trim(category)) in ('announcements', 'announcement', 'release');
update official_videos set category = 'Studio / Behind the scenes'
  where lower(trim(category)) in (
    'studio', 'overview', 'behind the scenes', 'studio / behind the scenes'
  );
update official_videos set category = 'Other'
  where lower(trim(category)) = 'other';
