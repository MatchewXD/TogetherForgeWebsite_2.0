-- Together Forge: Mechanic Lab demos (future interactive phase)
-- Optional. Not required for the informational /demos MVP.
-- Run in Supabase SQL Editor when you are ready to store live demos.
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT).

-- ---------------------------------------------------------------------------
-- mechanic_demos: catalog of lab entries
-- ---------------------------------------------------------------------------
create table if not exists mechanic_demos (
  id bigserial primary key,
  slug text not null unique,
  title text not null,
  summary text,
  description text,
  status text not null default 'Concept'
    check (status in ('Concept', 'Prototype', 'Playable', 'Archived')),
  thumbnail_url text,
  demo_url text,              -- future: playable link / embed source
  idea_id bigint,             -- optional link to ideas(id) when types match
  project_slug text,          -- optional workspace slug
  votes integer not null default 0,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mechanic_demos_status
  on mechanic_demos (status);

create index if not exists idx_mechanic_demos_featured
  on mechanic_demos (is_featured, sort_order);

-- Optional per-user demo votes (mirrors idea votes pattern)
create table if not exists mechanic_demo_votes (
  id bigserial primary key,
  demo_id bigint not null references mechanic_demos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint mechanic_demo_votes_unique unique (demo_id, user_id)
);

create index if not exists idx_mechanic_demo_votes_user
  on mechanic_demo_votes (user_id);

-- Keep mechanic_demos.votes in sync
create or replace function refresh_mechanic_demo_votes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id bigint;
  new_count integer;
begin
  target_id := coalesce(new.demo_id, old.demo_id);
  select count(*)::integer into new_count
  from mechanic_demo_votes
  where demo_id = target_id;

  update mechanic_demos
  set votes = new_count,
      updated_at = now()
  where id = target_id;

  return null;
end;
$$;

drop trigger if exists trg_mechanic_demo_votes_refresh on mechanic_demo_votes;
create trigger trg_mechanic_demo_votes_refresh
  after insert or delete on mechanic_demo_votes
  for each row
  execute function refresh_mechanic_demo_votes_count();

-- RLS
alter table mechanic_demos enable row level security;
alter table mechanic_demo_votes enable row level security;

drop policy if exists "Public can read mechanic_demos" on mechanic_demos;
create policy "Public can read mechanic_demos"
  on mechanic_demos for select
  using (true);

-- Staff write (reuse is_staff() from supabase/sql/supabase_moderation.sql if present)
drop policy if exists "Staff can write mechanic_demos" on mechanic_demos;
create policy "Staff can write mechanic_demos"
  on mechanic_demos for all
  to authenticated
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

drop policy if exists "Public can read demo votes" on mechanic_demo_votes;
create policy "Public can read demo votes"
  on mechanic_demo_votes for select
  using (true);

drop policy if exists "Authenticated can vote demos" on mechanic_demo_votes;
create policy "Authenticated can vote demos"
  on mechanic_demo_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove own demo votes" on mechanic_demo_votes;
create policy "Users can remove own demo votes"
  on mechanic_demo_votes for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table mechanic_demos is
  'Mechanic Lab catalog. MVP UI uses static cards; wire this table when interactive demos ship.';
comment on table mechanic_demo_votes is
  'Per-user votes on mechanic demos. Unique (demo_id, user_id).';
