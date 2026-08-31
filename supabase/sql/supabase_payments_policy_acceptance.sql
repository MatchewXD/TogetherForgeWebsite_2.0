-- =============================================================================
-- Payments and refunds policy acceptance (first on-site payment)
-- Safe to re-run. Apply on staging and production with legal pages.
-- =============================================================================

alter table if exists public.profiles
  add column if not exists payments_policy_version text;

alter table if exists public.profiles
  add column if not exists payments_policy_accepted_at timestamptz;

comment on column public.profiles.payments_policy_version is
  'Accepted Payments and refunds policy version key (e.g. 2026-08-30).';
comment on column public.profiles.payments_policy_accepted_at is
  'When the current payments_policy_version was accepted.';

notify pgrst, 'reload schema';
