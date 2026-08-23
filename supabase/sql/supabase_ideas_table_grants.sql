-- =============================================================================
-- Ideas table API grants (required for draft save / publish / vote)
-- Greenfield + supabase_ideas_insert_rls only granted INSERT; PostgREST also
-- needs SELECT (return rows) and UPDATE (save draft / edit).
-- Safe to re-run.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Public read + authenticated write (RLS still enforces row rules)
grant select on table public.ideas to anon, authenticated, service_role;
grant insert, update, delete on table public.ideas to authenticated, service_role;

-- Identity / sequences used by ideas.id
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S' and c.relname like 'ideas%_seq'
  ) then
    grant usage, select on all sequences in schema public to authenticated, service_role;
  end if;
exception when others then
  grant usage, select on all sequences in schema public to authenticated, service_role;
end $$;

-- Votes / comments often used with ideas (same greenfield gap)
do $$
begin
  if to_regclass('public.votes') is not null then
    grant select on table public.votes to anon, authenticated, service_role;
    grant insert, delete on table public.votes to authenticated, service_role;
  end if;
  if to_regclass('public.comments') is not null then
    grant select on table public.comments to anon, authenticated, service_role;
    grant insert, update, delete on table public.comments to authenticated, service_role;
  end if;
  if to_regclass('public.comment_likes') is not null then
    grant select on table public.comment_likes to anon, authenticated, service_role;
    grant insert, delete on table public.comment_likes to authenticated, service_role;
  end if;
end $$;

-- Keep owner update policy present (draft re-save)
drop policy if exists "Owners can update own ideas" on public.ideas;
create policy "Owners can update own ideas"
  on public.ideas for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
