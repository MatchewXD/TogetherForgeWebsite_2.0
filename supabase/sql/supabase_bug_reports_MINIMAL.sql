-- =============================================================================
-- MINIMAL bug_reports setup - run this FIRST if full script failed
-- Afterwards ALWAYS run supabase_bug_reports.sql and supabase_require_auth_to_post.sql
-- (this fallback alone is not the production security setup).
-- Supabase → project lbstantgrrrupzeasndg → SQL Editor → Run
-- =============================================================================

-- UUID generator (needed on some projects)
create extension if not exists "pgcrypto";

-- 1) TABLE ONLY
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  steps_to_reproduce text,
  severity text not null default 'Medium',
  status text not null default 'Reported',
  screenshot_url text,
  browser_info text,
  device_info text,
  reporter_id uuid,
  reporter_email text,
  reporter_name text,
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- 2) Soft checks (added after table exists so create never fails on constraints)
do $$
begin
  alter table public.bug_reports
    drop constraint if exists bug_reports_severity_check;
  alter table public.bug_reports
    add constraint bug_reports_severity_check
    check (severity in ('Low', 'Medium', 'High', 'Critical'));
exception when others then
  raise notice 'severity check: %', sqlerrm;
end $$;

do $$
begin
  alter table public.bug_reports
    drop constraint if exists bug_reports_status_check;
  alter table public.bug_reports
    add constraint bug_reports_status_check
    check (status in ('Reported', 'Confirmed', 'In Progress', 'Fixed', 'Closed'));
exception when others then
  raise notice 'status check: %', sqlerrm;
end $$;

-- 3) Indexes
create index if not exists idx_bug_reports_status
  on public.bug_reports (status, created_at desc);

-- 4) Grants (API cannot see the table without these)
grant usage on schema public to anon, authenticated, service_role;
grant all on table public.bug_reports to postgres, service_role;
-- reporter_email / staff_notes are not selectable by the public API
revoke select, insert on table public.bug_reports from anon;
revoke select on table public.bug_reports from authenticated;
grant select (
  id, title, description, steps_to_reproduce, severity, status,
  screenshot_url, browser_info, device_info, reporter_id, reporter_name,
  created_at, updated_at, resolved_at
) on table public.bug_reports to anon, authenticated;
grant insert on table public.bug_reports to authenticated;
grant update, delete on table public.bug_reports to authenticated;

-- 5) RLS
alter table public.bug_reports enable row level security;

drop policy if exists "Public can read bug reports" on public.bug_reports;
create policy "Public can read bug reports"
  on public.bug_reports for select
  to public
  using (true);

drop policy if exists "Anyone can submit bug reports" on public.bug_reports;
drop policy if exists "Authenticated users can submit bug reports" on public.bug_reports;
create policy "Authenticated users can submit bug reports"
  on public.bug_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- Staff update: use is_staff if it exists, else nobody (never allow every member)
do $$
begin
  drop policy if exists "Staff can update bug reports" on public.bug_reports;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_staff'
  ) then
    execute $p$
      create policy "Staff can update bug reports"
        on public.bug_reports for update
        to authenticated
        using (public.is_staff())
        with check (public.is_staff())
    $p$;
  else
    execute $p$
      create policy "Staff can update bug reports"
        on public.bug_reports for update
        to authenticated
        using (false)
        with check (false)
    $p$;
  end if;
end $$;

-- 6) Reload API schema cache
notify pgrst, 'reload schema';

-- 7) VERIFY - must print public.bug_reports (not null)
select to_regclass('public.bug_reports') as bug_reports_table;
