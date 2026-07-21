-- Together Forge: Founders Thoughts + per-user likes
-- Run in Supabase SQL Editor (or psql). Safe to re-run (IF NOT EXISTS / ON CONFLICT).
--
-- Mirrors ideas/votes pattern:
--   founders_thoughts.likes  = denormalized count
--   founders_thought_likes    = one row per (thought, user)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists founders_thoughts (
  id bigserial primary key,
  slug text not null unique,
  title text not null,
  content text not null,
  lead text,
  theme text,
  published_at date,
  likes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists founders_thought_likes (
  id bigserial primary key,
  thought_id bigint not null references founders_thoughts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint founders_thought_likes_unique unique (thought_id, user_id)
);

create index if not exists idx_founders_thought_likes_user
  on founders_thought_likes (user_id);

create index if not exists idx_founders_thought_likes_thought
  on founders_thought_likes (thought_id);

create index if not exists idx_founders_thoughts_published
  on founders_thoughts (published_at desc nulls last);

-- ---------------------------------------------------------------------------
-- Keep founders_thoughts.likes in sync with like rows
-- ---------------------------------------------------------------------------

create or replace function refresh_founders_thought_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id bigint;
  new_count integer;
begin
  target_id := coalesce(new.thought_id, old.thought_id);
  select count(*)::integer into new_count
  from founders_thought_likes
  where thought_id = target_id;

  update founders_thoughts
  set likes = new_count,
      updated_at = now()
  where id = target_id;

  return null;
end;
$$;

drop trigger if exists trg_founders_thought_likes_refresh on founders_thought_likes;
create trigger trg_founders_thought_likes_refresh
  after insert or delete on founders_thought_likes
  for each row
  execute function refresh_founders_thought_likes_count();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table founders_thoughts enable row level security;
alter table founders_thought_likes enable row level security;

-- Thoughts: public read (page is public)
drop policy if exists "Public can read founders_thoughts" on founders_thoughts;
create policy "Public can read founders_thoughts"
  on founders_thoughts for select
  using (true);

-- Likes: public read (needed so clients can see who liked / existence)
drop policy if exists "Public can read founders_thought_likes" on founders_thought_likes;
create policy "Public can read founders_thought_likes"
  on founders_thought_likes for select
  using (true);

drop policy if exists "Authenticated users can like founders thoughts" on founders_thought_likes;
create policy "Authenticated users can like founders thoughts"
  on founders_thought_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove own founders thought likes" on founders_thought_likes;
create policy "Users can remove own founders thought likes"
  on founders_thought_likes for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed essays (exact site copy / Transparency Hub deep links)
-- ---------------------------------------------------------------------------

-- Drop retired seed slugs (likes cascade via FK)
delete from founders_thoughts
where slug in (
  'reasonable-pay',
  'publish-the-books',
  'community-constraint',
  'personal-note'
);

insert into founders_thoughts (slug, title, lead, theme, published_at, content)
values
(
  'why-i-created-together-forge',
  'Why I Created Together Forge',
  null,
  'Origin',
  '2026-07-15',
  $c$I built Together Forge because I got sick and tired of modern game companies screwing over gamers. Titles like The Last of Us Part II, Concord, aggressive loot boxes, and countless other examples show the same pattern. These companies care more about investors and loud ideologies than about the players who actually buy and play their games.

Game companies have failed us. The rise of successful indie developers is proof of that. Bottom lines, bureaucracy, and forced ideologies have slowed real progress in gaming to a crawl. Genuine new content and innovation now live almost entirely in the indie space.

It is time for us, the players, to stand up. We need to make our own games. Real games that push boundaries. Games that people actually care about and that bring us closer together.

Stop buying mediocre games just because you need something to play. Support Together Forge instead. Every purchase gives you quality content and helps build a better system of game development, one that puts gamers first.

Together Forge will be so successful that it renders the old models obsolete. Any company focused on investors or ideologies will not be able to compete with the speed, innovation, and community power of Together Forge.$c$
),
(
  'founder-compensation',
  'Founder Compensation',
  null,
  'Compensation',
  '2026-07-15',
  $c$As founder, I want Together Forge to be extremely successful. I want it to completely outcompete companies that put profits or ideologies over people. Because of this, I refuse to drain profits the way many CEOs do.

Right now I work a normal 40-50 hour job while spending another 40+ hours building Together Forge. I will not use donations to cover my living expenses. I will only draw a living wage from Together Forge once the company is generating enough revenue to pay all employees (including myself) a wage that can comfortably support a family of five. Anything beyond that is unnecessary. I have no interest in the bloated executive compensation seen at places like Bungie.

I created a separate option for people who want to support my personal runway directly. Donations to my living expenses go into a trust. Once there is enough to cover one full year, I will quit my day job and focus 100% on Together Forge. As more donations come in they will extend that runway. When Together Forge itself can pay living wages, I will switch to company pay and move any remaining trust funds into Together Forge as a direct donation.$c$
),
(
  'why-transparency-matters',
  'Why Transparency Matters',
  null,
  'Transparency',
  '2026-07-15',
  $c$Transparency is built into every part of this project because the community must be able to see whether the company is staying true to its principles. If money starts flowing to individuals or ideologies instead of games and players, people deserve to know immediately. Any future gaming company that avoids this level of openness will be signaling corruption. They prioritize lining pockets over making good games. Together Forge will never hide behind marketing copy. If we ever lose our way, the transparency systems will make it obvious.$c$
),
(
  'long-term-vision',
  'Long Term Vision',
  null,
  'Vision',
  '2026-07-15',
  $c$I want Together Forge to become the gold standard of game development. We will create systems that help aligned indie developers get support, brainstorm directly with the community, and rapidly test new mechanics and ideas with low risk. Together Forge will also create systems that teach people how to become indie developers and how to work in any specific field of game development.

Together Forge will release revolutionary games that change the industry. Our success will force other companies, through market pressure, to adopt real transparency and put players first. We will build unifying cooperative experiences and MMOs where people form real connections and work together in shared worlds.$c$
)
on conflict (slug) do update set
  title = excluded.title,
  lead = excluded.lead,
  theme = excluded.theme,
  published_at = excluded.published_at,
  content = excluded.content,
  updated_at = now();

-- Reconcile denormalized counts from like rows
update founders_thoughts t
set likes = coalesce((
  select count(*)::integer
  from founders_thought_likes l
  where l.thought_id = t.id
), 0);

comment on table founders_thoughts is
  'Public founder notes. likes is denormalized count of founders_thought_likes rows.';
comment on table founders_thought_likes is
  'Per-user likes on founders_thoughts. Unique (thought_id, user_id).';
