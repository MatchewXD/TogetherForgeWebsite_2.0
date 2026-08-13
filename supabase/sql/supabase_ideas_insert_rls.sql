-- =============================================================================
-- Ideas insert RLS: authenticated owner only
-- Removes open insert (with check (true)). Safe to re-run.
-- Apply after base schema (ideas table + RLS enabled).
-- =============================================================================

-- Ensure authenticated can insert/update/select; anon cannot forge rows for others
revoke insert, update, delete on table public.ideas from anon;
grant select on table public.ideas to anon, authenticated;
grant insert, update, delete on table public.ideas to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "Anyone can submit ideas" on public.ideas;
drop policy if exists "Authenticated users can insert ideas" on public.ideas;

create policy "Authenticated users can insert ideas"
  on public.ideas for insert
  to authenticated
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
  );

notify pgrst, 'reload schema';
