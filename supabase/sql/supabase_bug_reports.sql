-- =============================================================================
-- Together Forge — Bug reports / public tracker
-- Run in Supabase → SQL Editor on project: lbstantgrrrupzeasndg
-- Safe to re-run. Run the WHOLE script, then confirm the verify SELECT at the bottom.
-- =============================================================================
-- Workflow: Reported → Confirmed → In Progress → Fixed
-- =============================================================================

-- Staff helper (shared with moderation; create if missing)
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
      and coalesce(p.role, 'user') in ('moderator', 'admin', 'project_lead')
  );
$$;

-- ---------------------------------------------------------------------------
-- Table (core — must succeed)
-- ---------------------------------------------------------------------------
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  steps_to_reproduce text,
  severity text not null default 'Medium'
    check (severity in ('Low', 'Medium', 'High', 'Critical')),
  status text not null default 'Reported'
    check (status in ('Reported', 'Confirmed', 'In Progress', 'Fixed', 'Closed')),
  screenshot_url text,
  browser_info text,
  device_info text,
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_email text,
  reporter_name text,
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_bug_reports_status
  on public.bug_reports (status, created_at desc);

create index if not exists idx_bug_reports_severity
  on public.bug_reports (severity, created_at desc);

create index if not exists idx_bug_reports_reporter
  on public.bug_reports (reporter_id);

comment on table public.bug_reports is
  'Public bug tracker. Anyone may submit; staff triages status.';

create or replace function public.touch_bug_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status in ('Fixed', 'Closed') and old.status is distinct from new.status then
    new.resolved_at := coalesce(new.resolved_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bug_reports_updated_at on public.bug_reports;
create trigger trg_bug_reports_updated_at
  before update on public.bug_reports
  for each row
  execute function public.touch_bug_reports_updated_at();

-- ---------------------------------------------------------------------------
-- Grants (required for anon/authenticated API access)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert on table public.bug_reports to anon, authenticated;
grant update, delete on table public.bug_reports to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.bug_reports enable row level security;

drop policy if exists "Public can read bug reports" on public.bug_reports;
create policy "Public can read bug reports"
  on public.bug_reports for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit bug reports" on public.bug_reports;
create policy "Anyone can submit bug reports"
  on public.bug_reports for insert
  to anon, authenticated
  with check (
    (reporter_id is null or reporter_id = auth.uid())
    and length(trim(title)) >= 3
    and length(trim(description)) >= 10
  );

drop policy if exists "Staff can update bug reports" on public.bug_reports;
create policy "Staff can update bug reports"
  on public.bug_reports for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Staff can delete bug reports" on public.bug_reports;
create policy "Staff can delete bug reports"
  on public.bug_reports for delete
  to authenticated
  using (public.is_staff());

-- Force PostgREST to see the new table
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Storage (optional — failures here must NOT block the table)
-- Dashboard fallback: Storage → New bucket → id "bug-screenshots" → Public
-- ---------------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('bug-screenshots', 'bug-screenshots', true)
  on conflict (id) do update set public = true;
exception when others then
  raise notice 'Storage bucket skip: %', sqlerrm;
end $$;

do $$
begin
  drop policy if exists "Public read bug screenshots" on storage.objects;
  create policy "Public read bug screenshots"
    on storage.objects for select
    using (bucket_id = 'bug-screenshots');

  drop policy if exists "Anyone can upload bug screenshots" on storage.objects;
  create policy "Anyone can upload bug screenshots"
    on storage.objects for insert
    with check (
      bucket_id = 'bug-screenshots'
      and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif'))
    );

  drop policy if exists "Staff can delete bug screenshots" on storage.objects;
  create policy "Staff can delete bug screenshots"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'bug-screenshots' and public.is_staff());
exception when others then
  raise notice 'Storage policies skip: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- VERIFY (must return one row with bug_reports = 'public.bug_reports')
-- ---------------------------------------------------------------------------
select to_regclass('public.bug_reports') as bug_reports_table;
