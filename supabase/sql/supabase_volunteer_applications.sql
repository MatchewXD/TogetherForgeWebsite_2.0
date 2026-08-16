-- =============================================================================
-- Private volunteer applications (Get Involved funnel)
-- Submissions are NOT public. Staff/service_role can review.
-- Safe to re-run.
-- =============================================================================

create table if not exists public.volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  application_type text not null default 'skill_offer',
  -- display name / handle (not necessarily account username)
  handle text not null,
  email text,
  discord_username text,
  skill_areas text[] not null default '{}',
  skill_other text,
  role_id text,
  open_need_id text,
  description text not null,
  time_commitment text,
  portfolio_url text,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'new',
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_applications_type_chk check (
    application_type in ('skill_offer', 'moderation_role', 'open_need')
  ),
  constraint volunteer_applications_status_chk check (
    status in ('new', 'reviewing', 'contacted', 'accepted', 'declined', 'archived')
  ),
  constraint volunteer_applications_contact_chk check (
    (email is not null and length(trim(email)) > 0)
    or (discord_username is not null and length(trim(discord_username)) > 0)
  )
);

create index if not exists idx_volunteer_applications_created
  on public.volunteer_applications (created_at desc);
create index if not exists idx_volunteer_applications_status
  on public.volunteer_applications (status, created_at desc);

comment on table public.volunteer_applications is
  'Private volunteer skill offers and mod self-nominations from Get Involved. Not public.';

alter table public.volunteer_applications enable row level security;

-- No public SELECT policies (staff use service_role / dashboard)
drop policy if exists "Anyone can submit volunteer applications" on public.volunteer_applications;
create policy "Anyone can submit volunteer applications"
  on public.volunteer_applications
  for insert
  to anon, authenticated
  with check (true);

-- Optional: applicants can re-read their own row if signed in
drop policy if exists "Users read own volunteer applications" on public.volunteer_applications;
create policy "Users read own volunteer applications"
  on public.volunteer_applications
  for select
  to authenticated
  using (user_id is not null and auth.uid() = user_id);

grant usage on schema public to anon, authenticated, service_role;
grant insert on public.volunteer_applications to anon, authenticated, service_role;
grant select, update, delete on public.volunteer_applications to service_role;
grant select on public.volunteer_applications to authenticated;

notify pgrst, 'reload schema';
