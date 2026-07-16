-- Together Forge: basic moderation columns + content reports
-- Run in Supabase SQL Editor. Safe to re-run.
-- Staff roles (profiles.role): moderator | admin | project_lead

-- ---------------------------------------------------------------------------
-- Profiles: moderation status
-- ---------------------------------------------------------------------------
alter table if exists profiles
  add column if not exists role text default 'user';

alter table if exists profiles
  add column if not exists moderation_status text default 'active';

alter table if exists profiles
  add column if not exists moderation_note text;

comment on column profiles.moderation_status is
  'active | suspended | banned. Client and RLS should treat non-active carefully.';

-- ---------------------------------------------------------------------------
-- Content reports (user-submitted or staff-flagged)
-- ---------------------------------------------------------------------------
create table if not exists content_reports (
  id bigserial primary key,
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null, -- idea | user | comment | other
  target_id text not null,
  reason text,
  details text,
  status text not null default 'pending', -- pending | reviewing | resolved | dismissed
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_content_reports_status
  on content_reports (status, created_at desc);

create index if not exists idx_content_reports_target
  on content_reports (target_type, target_id);

alter table content_reports enable row level security;

-- Helpers: is current user staff?
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('moderator', 'admin', 'project_lead')
  );
$$;

-- Reports: anyone signed in can create; staff can read/update
drop policy if exists "Authenticated can create reports" on content_reports;
create policy "Authenticated can create reports"
  on content_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "Staff can read reports" on content_reports;
create policy "Staff can read reports"
  on content_reports for select
  to authenticated
  using (public.is_staff() or auth.uid() = reporter_id);

drop policy if exists "Staff can update reports" on content_reports;
create policy "Staff can update reports"
  on content_reports for update
  to authenticated
  using (public.is_staff());

-- Profiles: staff can read all profiles (for mod dashboard)
drop policy if exists "Staff can read all profiles" on profiles;
create policy "Staff can read all profiles"
  on profiles for select
  to authenticated
  using (public.is_staff() or auth.uid() = id);

-- Profiles: staff can update moderation fields (and role only if admin ideally;
-- for simplicity staff can update moderation_status / note)
drop policy if exists "Staff can moderate profiles" on profiles;
create policy "Staff can moderate profiles"
  on profiles for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Ideas: staff can update / delete any idea (if table has RLS)
-- These policies only apply if ideas RLS is enabled; harmless if not.
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'ideas'
  ) then
    execute 'alter table ideas enable row level security';

    -- Public/authenticated read often already exists; ensure staff write:
    execute 'drop policy if exists "Staff can update any idea" on ideas';
    execute $p$
      create policy "Staff can update any idea"
        on ideas for update
        to authenticated
        using (public.is_staff())
        with check (public.is_staff())
    $p$;

    execute 'drop policy if exists "Staff can delete any idea" on ideas';
    execute $p$
      create policy "Staff can delete any idea"
        on ideas for delete
        to authenticated
        using (public.is_staff())
    $p$;
  end if;
end $$;

comment on table content_reports is
  'User or staff reports of ideas/users/comments. Moderators resolve from dashboard.';
