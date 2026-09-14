-- Staff may delete platform suggestions. Safe to re-run.
-- is_staff() plus founder: production is_staff() may omit founder.

grant delete on table public.platform_suggestions to authenticated;

drop policy if exists platform_suggestions_delete_staff on public.platform_suggestions;
create policy platform_suggestions_delete_staff
  on public.platform_suggestions
  for delete
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  );
