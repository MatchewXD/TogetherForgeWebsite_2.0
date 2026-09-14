-- Staff may read and triage Get Involved applications. Safe to re-run.

grant select, update on public.volunteer_applications to authenticated;

drop policy if exists volunteer_applications_select_staff on public.volunteer_applications;
create policy volunteer_applications_select_staff
  on public.volunteer_applications
  for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  );

drop policy if exists volunteer_applications_update_staff on public.volunteer_applications;
create policy volunteer_applications_update_staff
  on public.volunteer_applications
  for update
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  )
  with check (
    public.is_staff()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  );
