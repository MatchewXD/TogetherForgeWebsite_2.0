-- =============================================================================
-- Private community / moderation concern reports
-- Staff-only read. Public insert (anon + signed-in). Not listed on the site.
-- Safe to re-run.
-- =============================================================================

create table if not exists public.concern_reports (
  id uuid primary key default gen_random_uuid(),
  what_happened text not null,
  where_happened text not null,
  reference text,
  contact text,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint concern_reports_where_chk check (
    where_happened in ('discord', 'website', 'both')
  ),
  constraint concern_reports_what_len check (
    char_length(trim(what_happened)) >= 10
    and char_length(what_happened) <= 4000
  ),
  constraint concern_reports_status_chk check (
    status in ('new', 'reviewing', 'closed')
  )
);

create index if not exists idx_concern_reports_created
  on public.concern_reports (created_at desc);

comment on table public.concern_reports is
  'Private Report a concern submissions. Not public. Staff / service_role only.';

alter table public.concern_reports enable row level security;

drop policy if exists "Anyone can submit concern reports" on public.concern_reports;
create policy "Anyone can submit concern reports"
  on public.concern_reports
  for insert
  to anon, authenticated
  with check (
    char_length(trim(what_happened)) >= 10
    and where_happened in ('discord', 'website', 'both')
  );

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_staff'
  ) then
    drop policy if exists "Staff can read concern reports" on public.concern_reports;
    create policy "Staff can read concern reports"
      on public.concern_reports
      for select
      to authenticated
      using (public.is_staff());

    drop policy if exists "Staff can update concern reports" on public.concern_reports;
    create policy "Staff can update concern reports"
      on public.concern_reports
      for update
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant insert on table public.concern_reports to anon, authenticated, service_role;
grant select, update, delete on table public.concern_reports to service_role;
grant select, update on table public.concern_reports to authenticated;

notify pgrst, 'reload schema';
