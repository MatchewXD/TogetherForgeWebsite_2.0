-- =============================================================================
-- Community Showcase likes
-- Run after supabase_community_showcase.sql
-- Safe to re-run.
-- Pattern matches founders_thought_likes / idea votes.
-- =============================================================================

-- Denormalized count on posts
alter table if exists community_showcase_posts
  add column if not exists likes integer not null default 0;

comment on column community_showcase_posts.likes is
  'Denormalized like count; kept in sync with community_showcase_likes.';

-- One like per user per post
create table if not exists community_showcase_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_showcase_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint community_showcase_likes_unique unique (post_id, user_id)
);

create index if not exists idx_showcase_likes_user
  on community_showcase_likes (user_id);

create index if not exists idx_showcase_likes_post
  on community_showcase_likes (post_id);

-- Keep posts.likes in sync
create or replace function public.refresh_community_showcase_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post uuid;
  new_count integer;
begin
  target_post := coalesce(new.post_id, old.post_id);
  if target_post is null then
    return null;
  end if;

  select count(*)::integer into new_count
  from community_showcase_likes
  where post_id = target_post;

  update community_showcase_posts
  set likes = coalesce(new_count, 0)
  where id = target_post;

  return null;
end;
$$;

drop trigger if exists trg_showcase_likes_refresh on community_showcase_likes;
create trigger trg_showcase_likes_refresh
  after insert or delete on community_showcase_likes
  for each row
  execute function public.refresh_community_showcase_likes_count();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table community_showcase_likes enable row level security;

drop policy if exists "Public can read showcase likes" on community_showcase_likes;
create policy "Public can read showcase likes"
  on community_showcase_likes for select
  using (true);

drop policy if exists "Users can like showcase posts" on community_showcase_likes;
create policy "Users can like showcase posts"
  on community_showcase_likes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from community_showcase_posts p
      where p.id = post_id
        and p.status = 'approved'
    )
  );

drop policy if exists "Users can remove own showcase likes" on community_showcase_likes;
create policy "Users can remove own showcase likes"
  on community_showcase_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- Backfill denormalized counts (if likes rows already exist)
update community_showcase_posts p
set likes = coalesce((
  select count(*)::integer
  from community_showcase_likes l
  where l.post_id = p.id
), 0);
