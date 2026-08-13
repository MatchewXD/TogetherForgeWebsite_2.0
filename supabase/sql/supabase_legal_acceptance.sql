-- =============================================================================
-- Legal acceptance (Terms + Community Guidelines versions)
-- Safe to re-run. Apply on staging and production when legal pages go live.
-- =============================================================================

alter table if exists public.profiles
  add column if not exists terms_version text;

alter table if exists public.profiles
  add column if not exists terms_accepted_at timestamptz;

alter table if exists public.profiles
  add column if not exists guidelines_version text;

alter table if exists public.profiles
  add column if not exists guidelines_accepted_at timestamptz;

comment on column public.profiles.terms_version is
  'Accepted Terms of Service version key (e.g. 2026-08-12).';
comment on column public.profiles.terms_accepted_at is
  'When the current terms_version was accepted.';
comment on column public.profiles.guidelines_version is
  'Accepted Community Guidelines version key.';
comment on column public.profiles.guidelines_accepted_at is
  'When the current guidelines_version was accepted.';

-- Users may update their own acceptance fields (covered by existing update policy)
notify pgrst, 'reload schema';
