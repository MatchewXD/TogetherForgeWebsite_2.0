-- =============================================================================
-- MFA recovery codes (app-managed; Supabase TOTP has no built-in backup codes)
-- Codes are stored hashed only (bcrypt via pgcrypto). Plaintext is never stored.
-- Safe to re-run.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists idx_mfa_recovery_codes_user
  on public.mfa_recovery_codes (user_id)
  where used_at is null;

alter table public.mfa_recovery_codes enable row level security;

-- No client policies: only service role (edge function) reads/writes.
drop policy if exists "Users cannot read recovery codes" on public.mfa_recovery_codes;

comment on table public.mfa_recovery_codes is
  'One-time MFA recovery codes; code_hash only. Managed via mfa-recovery edge function.';

grant all on table public.mfa_recovery_codes to service_role;
