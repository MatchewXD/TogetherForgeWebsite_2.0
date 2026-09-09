-- =============================================================================
-- Project Updates — staff Devlogs & announcements on the project hub
-- Public can read. Staff (is_project_staff) can insert, update, delete.
-- Devlog body may be longer than other categories.
-- Safe to re-run.
-- =============================================================================

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  category text not null
    check (category in (
      'Devlog',
      'Announcement',
      'Process',
      'Art',
      'Audio',
      'Build'
    )),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_updates_title_len check (
    char_length(btrim(title)) between 8 and 120
  ),
  constraint project_updates_body_len check (
    char_length(btrim(body)) >= 8
    and char_length(btrim(body)) <= case
      when category = 'Devlog' then 8000
      else 2000
    end
  )
);

create index if not exists idx_project_updates_project
  on public.project_updates (project_id, created_at desc);

comment on table public.project_updates is
  'Staff Devlogs and announcements on a project hub. Devlog body max 8000; other categories 2000.';

create or replace function public.touch_project_updates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_project_updates_updated_at on public.project_updates;
create trigger trg_project_updates_updated_at
  before update on public.project_updates
  for each row
  execute function public.touch_project_updates_updated_at();

alter table public.project_updates enable row level security;

grant select on table public.project_updates to anon, authenticated;
grant insert, update, delete on table public.project_updates to authenticated;

drop policy if exists "Public can read project updates" on public.project_updates;
create policy "Public can read project updates"
  on public.project_updates for select
  using (true);

drop policy if exists "Staff can insert project updates" on public.project_updates;
create policy "Staff can insert project updates"
  on public.project_updates for insert
  to authenticated
  with check (
    public.is_project_staff()
    and created_by = auth.uid()
  );

drop policy if exists "Staff can update project updates" on public.project_updates;
create policy "Staff can update project updates"
  on public.project_updates for update
  to authenticated
  using (public.is_project_staff())
  with check (public.is_project_staff());

drop policy if exists "Staff can delete project updates" on public.project_updates;
create policy "Staff can delete project updates"
  on public.project_updates for delete
  to authenticated
  using (public.is_project_staff());

notify pgrst, 'reload schema';
