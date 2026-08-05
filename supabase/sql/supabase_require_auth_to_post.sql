-- =============================================================================
-- Require signed-in accounts for all public content posts
-- Safe to re-run. Apply after showcase + bug report base SQL.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Community Showcase: authenticated insert only, linked to auth.uid()
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can submit showcase posts" on community_showcase_posts;
drop policy if exists "Authenticated users can submit showcase posts" on community_showcase_posts;
create policy "Authenticated users can submit showcase posts"
  on community_showcase_posts for insert
  to authenticated
  with check (
    status = 'pending'
    and is_featured = false
    and moderated_by is null
    and moderated_at is null
    and creator_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Bug reports: authenticated insert only
-- ---------------------------------------------------------------------------
revoke insert on table public.bug_reports from anon;
grant insert on table public.bug_reports to authenticated;

drop policy if exists "Anyone can submit bug reports" on public.bug_reports;
drop policy if exists "Authenticated users can submit bug reports" on public.bug_reports;
create policy "Authenticated users can submit bug reports"
  on public.bug_reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and length(trim(title)) >= 3
    and length(trim(description)) >= 10
  );

-- ---------------------------------------------------------------------------
-- Bug screenshots storage: authenticated upload only
-- ---------------------------------------------------------------------------
do $$
begin
  drop policy if exists "Anyone can upload bug screenshots" on storage.objects;
  drop policy if exists "Authenticated can upload bug screenshots" on storage.objects;
  create policy "Authenticated can upload bug screenshots"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'bug-screenshots'
      and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif'))
    );
exception
  when others then
    raise notice 'bug screenshot policy skip: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
