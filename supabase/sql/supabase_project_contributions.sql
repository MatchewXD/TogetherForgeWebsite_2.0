-- =============================================================================
-- Project contributions / public credits
-- Powers Contributors pages now; Released Game credits later.
-- Run after supabase_tasks_schema.sql (+ profiles). Safe to re-run.
-- =============================================================================

create table if not exists project_contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  -- Account holder (required for development / marketing / community)
  user_id uuid references profiles(id) on delete set null,
  -- Guest display name (donations only when user_id is null)
  display_name text,
  -- Top-level section: donations | development | marketing | community
  category text not null
    check (category in ('donations', 'development', 'marketing', 'community')),
  -- Static sub-header (Art, Coding, Content Creation, …)
  subcategory text,
  -- Donations only: hide identity; amount used for anonymous + project totals
  is_anonymous boolean not null default false,
  amount_cents integer
    check (amount_cents is null or amount_cents >= 0),
  -- Optional freeform credit line
  role_label text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Non-accounts only allowed under donations
  constraint project_contributions_account_rule check (
    category = 'donations'
    or user_id is not null
  )
);

create index if not exists idx_project_contributions_project
  on project_contributions (project_id, category, sort_order);

create index if not exists idx_project_contributions_user
  on project_contributions (user_id)
  where user_id is not null;

-- Optional: tie Stripe support rows to a project later
alter table if exists donations
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists idx_donations_project
  on donations (project_id)
  where project_id is not null;

alter table project_contributions enable row level security;

drop policy if exists "Public can read project contributions" on project_contributions;
create policy "Public can read project contributions"
  on project_contributions for select
  using (true);

drop policy if exists "Staff can insert project contributions" on project_contributions;
create policy "Staff can insert project contributions"
  on project_contributions for insert
  with check (public.is_project_staff());

drop policy if exists "Staff can update project contributions" on project_contributions;
create policy "Staff can update project contributions"
  on project_contributions for update
  using (public.is_project_staff());

drop policy if exists "Staff can delete project contributions" on project_contributions;
create policy "Staff can delete project contributions"
  on project_contributions for delete
  using (public.is_project_staff());

comment on table project_contributions is
  'Public credits per project. Same rows can feed Released Game credits later.';

-- ---------------------------------------------------------------------------
-- Optional demo seed for Tether (prototype-systems) if table empty for that project
-- ---------------------------------------------------------------------------
do $$
declare
  pid uuid;
  n int;
begin
  select id into pid from projects where slug = 'prototype-systems' limit 1;
  if pid is null then
    return;
  end if;

  select count(*) into n from project_contributions where project_id = pid;
  if n > 0 then
    return;
  end if;

  -- Named donor (guest — donations only)
  insert into project_contributions (
    project_id, user_id, display_name, category, is_anonymous, amount_cents, sort_order
  ) values
    (pid, null, 'Community Supporter', 'donations', false, 2500, 0),
    (pid, null, null, 'donations', true, 1500, 1),
    (pid, null, null, 'donations', true, 500, 2);
end $$;
