-- =============================================================================
-- Ideas: optional primary supporting image
-- Run after base ideas schema. Safe to re-run.
-- Staff delete policy needs is_project_staff() (defined here if tasks SQL not yet applied).
-- =============================================================================

alter table if exists public.ideas
  add column if not exists image_url text;

comment on column public.ideas.image_url is
  'Optional public URL for one supporting image (concept art, mockup, mood reference).';

-- Staff helper (same definition as supabase_tasks_schema.sql; idempotent)
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

-- ---------------------------------------------------------------------------
-- Storage: idea-images (public read; authenticated upload)
-- Dashboard fallback: Storage → New bucket → id "idea-images" → Public
-- ---------------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('idea-images', 'idea-images', true)
  on conflict (id) do update set public = true;
exception
  when others then
    raise notice 'storage.buckets insert skipped: %', sqlerrm;
end $$;

drop policy if exists "Public read idea images" on storage.objects;
create policy "Public read idea images"
  on storage.objects for select
  using (bucket_id = 'idea-images');

-- Authenticated users upload into their own folder: {user_id}/...
drop policy if exists "Users can upload idea images" on storage.objects;
create policy "Users can upload idea images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'idea-images'
    and auth.uid()::text = (storage.foldername(name))[1]
    and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif'))
  );

-- Owners can update/replace their uploads
drop policy if exists "Users can update own idea images" on storage.objects;
create policy "Users can update own idea images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'idea-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owners can delete their uploads
drop policy if exists "Users can delete own idea images" on storage.objects;
create policy "Users can delete own idea images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'idea-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Staff can delete any
drop policy if exists "Staff can delete idea images" on storage.objects;
create policy "Staff can delete idea images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'idea-images'
    and public.is_project_staff()
  );
