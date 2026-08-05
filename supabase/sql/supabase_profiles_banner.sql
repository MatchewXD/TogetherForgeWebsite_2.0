-- =============================================================================
-- Profile banner image (public profile header + private profile card)
-- Run after base profiles schema. Safe to re-run.
-- =============================================================================

alter table if exists profiles
  add column if not exists banner_url text;

alter table if exists profiles
  add column if not exists banner_position text default '50% 50%';

comment on column profiles.banner_url is
  'Optional public URL for profile banner (wide landscape image).';

comment on column profiles.banner_position is
  'CSS object-position for banner framing, e.g. "50% 20%" (x y).';

-- Reuse public "avatars" storage bucket (same as profile pictures).
-- Path convention: {user_id}/banner.{ext}
-- Dashboard: Storage → avatars → Public bucket recommended.
-- Policies below are additive; safe if similar policies already exist.

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;
exception
  when others then
    raise notice 'storage.buckets avatars insert skipped: %', sqlerrm;
end $$;

-- Authenticated users may upload/update/delete objects under their own folder
drop policy if exists "Users can upload own avatar folder" on storage.objects;
create policy "Users can upload own avatar folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own avatar folder" on storage.objects;
create policy "Users can update own avatar folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own avatar folder" on storage.objects;
create policy "Users can delete own avatar folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Public can read avatars" on storage.objects;
create policy "Public can read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
