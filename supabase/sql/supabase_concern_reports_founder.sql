-- Private concern reports: Founder read/update. Safe to re-run.
-- The Concerns tab is Founder-only. Moderators use Reports for content flags.

drop policy if exists "Staff can read concern reports" on public.concern_reports;
create policy "Staff can read concern reports"
  on public.concern_reports
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  );

drop policy if exists "Staff can update concern reports" on public.concern_reports;
create policy "Staff can update concern reports"
  on public.concern_reports
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  );
