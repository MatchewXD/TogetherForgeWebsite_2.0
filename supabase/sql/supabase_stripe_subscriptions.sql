-- Optional companion tables for stripe-webhook Edge Function
-- Run after supabase_donations_stripe.sql. Safe to re-run.

-- Track processed events (idempotency)
create table if not exists stripe_webhook_events (
  id text primary key, -- evt_...
  type text,
  processed_at timestamptz not null default now()
);

-- Active / historical subscriptions (for MRR accuracy)
create table if not exists stripe_subscriptions (
  id text primary key, -- sub_...
  status text not null, -- active, canceled, past_due, etc.
  fund_type text default 'studio',
  amount_cents integer,
  currency text default 'usd',
  customer_id text,
  tier_id text,
  cancel_at_period_end boolean default false,
  current_period_end timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_stripe_subscriptions_status
  on stripe_subscriptions (status);

alter table stripe_webhook_events enable row level security;
alter table stripe_subscriptions enable row level security;

-- No public access; service role (webhook) bypasses RLS
drop policy if exists "No public stripe_webhook_events" on stripe_webhook_events;
-- intentional: no policies for anon → deny by default under RLS

drop policy if exists "No public stripe_subscriptions" on stripe_subscriptions;

-- Prefer active subscriptions for MRR when table is populated
create or replace function get_public_support_summary()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with completed as (
    select *
    from donations
    where coalesce(status, 'completed') in ('completed', 'paid', 'succeeded')
  ),
  studio as (
    select * from completed where coalesce(fund_type, 'studio') = 'studio'
  ),
  active_subs as (
    select amount_cents
    from stripe_subscriptions
    where status in ('active', 'trialing')
      and coalesce(fund_type, 'studio') = 'studio'
      and coalesce(amount_cents, 0) > 0
  ),
  -- Fallback MRR from donation rows if subscriptions table empty
  latest_sub as (
    select distinct on (stripe_subscription_id)
      stripe_subscription_id,
      amount_cents
    from studio
    where interval = 'month'
      and stripe_subscription_id is not null
      and coalesce(amount_cents, 0) > 0
    order by stripe_subscription_id, created_at desc
  ),
  mrr as (
    select coalesce(
      (select sum(amount_cents) from active_subs),
      (select sum(amount_cents) from latest_sub),
      0
    ) as cents,
    coalesce(
      (select count(*) from active_subs),
      (select count(*) from latest_sub),
      0
    ) as n
  )
  select json_build_object(
    'studio_total_cents', coalesce((select sum(amount_cents) from studio), 0),
    'studio_payment_count', coalesce((select count(*) from studio), 0),
    'studio_mrr_cents', (select cents from mrr),
    'studio_subscriber_count', (select n from mrr),
    'runway_total_cents', coalesce((
      select sum(amount_cents) from completed where fund_type = 'runway'
    ), 0),
    'runway_payment_count', coalesce((
      select count(*) from completed where fund_type = 'runway'
    ), 0),
    'last_payment_at', (select max(created_at) from studio),
    'currency', 'usd'
  );
$$;

grant execute on function get_public_support_summary() to anon, authenticated;

comment on table stripe_webhook_events is 'Processed Stripe event ids for idempotency.';
comment on table stripe_subscriptions is 'Subscription lifecycle from customer.subscription.* webhooks.';
