-- =============================================================================
-- Platform Suggestions — lightweight site feedback (minimal)
-- Run in Supabase → SQL Editor. Safe to re-run.
-- =============================================================================
-- Statuses: Open → Under consideration → Done | Closed
-- Public sees non-hidden rows. Staff can change status or hide.
-- =============================================================================

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') in ('moderator', 'admin', 'project_lead')
  );
$$;

create table if not exists public.platform_suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null default 'Other'
    check (category in (
      'Payments',
      'Task Board',
      'Ideas',
      'Auth',
      'Mobile',
      'Other'
    )),
  status text not null default 'Open'
    check (status in (
      'Open',
      'Under consideration',
      'Done',
      'Closed'
    )),
  is_hidden boolean not null default false,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_suggestions_public
  on public.platform_suggestions (is_hidden, status, created_at desc);

create index if not exists idx_platform_suggestions_user
  on public.platform_suggestions (user_id);

comment on table public.platform_suggestions is
  'Minimal platform / site suggestions. Signed-in submit; staff triage status or hide.';

create or replace function public.touch_platform_suggestions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_platform_suggestions_updated_at
  on public.platform_suggestions;
create trigger trg_platform_suggestions_updated_at
  before update on public.platform_suggestions
  for each row
  execute function public.touch_platform_suggestions_updated_at();

grant usage on schema public to anon, authenticated;
grant select on table public.platform_suggestions to anon, authenticated;
grant insert on table public.platform_suggestions to authenticated;
grant update on table public.platform_suggestions to authenticated;

alter table public.platform_suggestions enable row level security;

-- Public: non-hidden only; staff see all
drop policy if exists platform_suggestions_select on public.platform_suggestions;
create policy platform_suggestions_select
  on public.platform_suggestions
  for select
  to anon, authenticated
  using (is_hidden = false or public.is_staff());

-- Authenticated insert: only as self, always Open + not hidden
drop policy if exists platform_suggestions_insert on public.platform_suggestions;
create policy platform_suggestions_insert
  on public.platform_suggestions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'Open'
    and is_hidden = false
  );

-- Staff update (status / hide)
drop policy if exists platform_suggestions_update_staff on public.platform_suggestions;
create policy platform_suggestions_update_staff
  on public.platform_suggestions
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
