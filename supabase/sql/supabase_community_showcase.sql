-- =============================================================================
-- Community Showcase — moderated fan / community posts
-- Official Media stays on official_videos (/media). Do not mix.
-- Run after profiles + is_project_staff() / is_staff().
-- Safe to re-run.
-- =============================================================================

create table if not exists community_showcase_posts (
  id uuid primary key default gen_random_uuid(),
  -- video | stream | art | article
  content_type text not null
    check (content_type in ('video', 'stream', 'art', 'article')),
  title text not null,
  description text not null default '',
  -- Required public credit (display name always shown when approved)
  creator_display_name text not null,
  -- Optional account link
  creator_user_id uuid references profiles(id) on delete set null,
  -- Optional contact for moderation feedback (guests)
  submitter_email text,
  -- Links / media
  url text,
  youtube_id text,
  image_url text,
  thumbnail_url text,
  -- Optional project tag (free text or slug) for filters
  project_tag text,
  -- Moderation
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  is_featured boolean not null default false,
  moderator_note text,
  moderated_by uuid references profiles(id) on delete set null,
  moderated_at timestamptz,
  -- Sort / timestamps
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_showcase_title_len check (char_length(trim(title)) >= 2),
  constraint community_showcase_creator_len check (
    char_length(trim(creator_display_name)) >= 1
  )
);

create index if not exists idx_showcase_public_feed
  on community_showcase_posts (is_featured desc, published_at desc nulls last, created_at desc)
  where status = 'approved';

create index if not exists idx_showcase_moderation_queue
  on community_showcase_posts (status, created_at desc);

create index if not exists idx_showcase_content_type
  on community_showcase_posts (content_type)
  where status = 'approved';

create index if not exists idx_showcase_project_tag
  on community_showcase_posts (project_tag)
  where status = 'approved' and project_tag is not null;

comment on table community_showcase_posts is
  'Community Showcase submissions. Public only when status=approved. Official Media is separate.';

-- updated_at
create or replace function public.touch_community_showcase_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_community_showcase_updated_at on community_showcase_posts;
create trigger trg_community_showcase_updated_at
  before update on community_showcase_posts
  for each row
  execute function public.touch_community_showcase_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table community_showcase_posts enable row level security;

-- Public: approved only
drop policy if exists "Public can read approved showcase posts" on community_showcase_posts;
create policy "Public can read approved showcase posts"
  on community_showcase_posts for select
  using (status = 'approved');

-- Submitters (signed in) can read their own (any status)
drop policy if exists "Users can read own showcase submissions" on community_showcase_posts;
create policy "Users can read own showcase submissions"
  on community_showcase_posts for select
  to authenticated
  using (creator_user_id = auth.uid());

-- Staff: read all
drop policy if exists "Staff can read all showcase posts" on community_showcase_posts;
create policy "Staff can read all showcase posts"
  on community_showcase_posts for select
  to authenticated
  using (public.is_project_staff());

-- Signed-in users only may submit as pending
drop policy if exists "Anyone can submit showcase posts" on community_showcase_posts;
drop policy if exists "Authenticated users can submit showcase posts" on community_showcase_posts;
create policy "Authenticated users can submit showcase posts"
  on community_showcase_posts for insert
  to authenticated
  with check (
    status = 'pending'
    and is_featured = false
    and moderated_by is null
    and moderated_at is null
    and creator_user_id = auth.uid()
  );

-- Staff: update (approve / reject / feature)
drop policy if exists "Staff can update showcase posts" on community_showcase_posts;
create policy "Staff can update showcase posts"
  on community_showcase_posts for update
  to authenticated
  using (public.is_project_staff())
  with check (public.is_project_staff());

-- Staff: delete
drop policy if exists "Staff can delete showcase posts" on community_showcase_posts;
create policy "Staff can delete showcase posts"
  on community_showcase_posts for delete
  to authenticated
  using (public.is_project_staff());

-- ---------------------------------------------------------------------------
-- Optional demo seed (approved) — only if table empty
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  select count(*) into n from community_showcase_posts;
  if n > 0 then
    return;
  end if;

  insert into community_showcase_posts (
    content_type, title, description, creator_display_name,
    youtube_id, thumbnail_url, project_tag, status, is_featured, published_at
  ) values
  (
    'video',
    'First tether run — we almost made it',
    'Community clip from a weekend playtest. Pure co-op chaos and a last-second save.',
    'ClipCaptain',
    'aqz-KE-bpKQ',
    '/images/Hero_Background.webp',
    'Tether',
    'approved',
    true,
    now() - interval '14 days'
  ),
  (
    'stream',
    'Forge Friday: building with volunteers',
    'Recap stream walking through open tasks and how to claim your first one.',
    'StreamBridge',
    'eRsGyueVLvQ',
    '/images/Get_Involved_Background.webp',
    null,
    'approved',
    false,
    now() - interval '10 days'
  ),
  (
    'art',
    'Colony vista fan art',
    'Digital painting of the colony waiting below while the crew climbs.',
    'LumenBrush',
    null,
    '/images/About_Page_Background.webp',
    'Tether',
    'approved',
    true,
    now() - interval '7 days'
  ),
  (
    'article',
    'Why I joined the task board',
    'Short write-up on claiming a small art task and how public credit felt.',
    'PixelPatron',
    null,
    '/images/Support_Page.webp',
    null,
    'approved',
    false,
    now() - interval '5 days'
  );
  -- Fix article URL on seed rows via update if needed
  update community_showcase_posts
  set url = 'https://togetherforge.gg',
      image_url = thumbnail_url
  where content_type in ('art', 'article')
    and url is null;
end $$;
