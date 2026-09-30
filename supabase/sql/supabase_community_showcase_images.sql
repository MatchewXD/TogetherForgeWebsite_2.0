-- =============================================================================
-- Community Showcase: optional art / image uploads
-- Run after supabase_community_showcase.sql (needs is_project_staff()).
-- Safe to re-run.
-- Dashboard fallback: Storage → New bucket → id "showcase-images" → Public
-- =============================================================================

-- Staff helper (same definition as tasks schema; idempotent)
create or replace function public.is_project_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and coalesce(role, 'user') in ('admin', 'moderator', 'project_lead')
  );
$$;

grant execute on function public.is_project_staff() to authenticated, anon;

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('showcase-images', 'showcase-images', true)
  on conflict (id) do update set public = true;
exception
  when others then
    raise notice 'storage.buckets insert skipped: %', sqlerrm;
end $$;

drop policy if exists "Public read showcase images" on storage.objects;
create policy "Public read showcase images"
  on storage.objects for select
  using (bucket_id = 'showcase-images');

-- Authenticated users upload into their own folder: {user_id}/...
drop policy if exists "Users can upload showcase images" on storage.objects;
create policy "Users can upload showcase images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'showcase-images'
    and auth.uid()::text = (storage.foldername(name))[1]
    and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif'))
  );

drop policy if exists "Users can update own showcase images" on storage.objects;
create policy "Users can update own showcase images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'showcase-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'showcase-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own showcase images" on storage.objects;
create policy "Users can delete own showcase images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'showcase-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Staff can delete showcase images" on storage.objects;
create policy "Staff can delete showcase images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'showcase-images'
    and public.is_project_staff()
  );
