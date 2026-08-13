-- =============================================================================
-- Profiles API grants (required for username check / public /u/:name)
-- Greenfield SQL create table does not always expose tables to PostgREST roles.
-- Safe to re-run. Apply on staging if username availability fails.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select on table public.profiles to anon, authenticated, service_role;
grant insert, update on table public.profiles to authenticated, service_role;

-- Username history used when changing names
grant select, insert on table public.username_history to authenticated, service_role;

-- Ensure public read policy exists (username availability + /u pages)
alter table public.profiles enable row level security;

drop policy if exists "Public can read usernames" on public.profiles;
create policy "Public can read usernames"
  on public.profiles for select
  using (true);

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

notify pgrst, 'reload schema';
