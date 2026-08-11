-- =============================================================================
-- Subscription renewal recognition (monthly thank-you feed cards)
-- =============================================================================
-- Each successful subscription charge should insert a donations row (webhook:
-- invoice.paid). Credit (user_id / is_anonymous / display_name) is copied from
-- subscription metadata or the original checkout donation.
--
-- This script only adds optional columns on stripe_subscriptions for caching
-- credit identity. Safe to re-run. Deploy/update stripe-webhook after running.
-- =============================================================================

alter table if exists public.stripe_subscriptions
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table if exists public.stripe_subscriptions
  add column if not exists is_anonymous boolean default true;

alter table if exists public.stripe_subscriptions
  add column if not exists display_name text;

comment on column public.stripe_subscriptions.user_id is
  'Optional TF user credited on each renewal recognition card.';
comment on column public.stripe_subscriptions.is_anonymous is
  'Public credit choice from checkout (false = show username in recent support).';

-- get_public_recent_donations already returns one row per donations payment
-- (including interval=month renewals). No change required for the feed RPC.
