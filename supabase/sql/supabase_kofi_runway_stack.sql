-- =============================================================================
-- Runway ledger stack: Ko-fi only (no studio Stripe). Optional PayPal net.
-- Safe to re-run. Apply after supabase_kofi_runway.sql.
-- =============================================================================

alter table if exists public.kofi_runway_payments
  add column if not exists fee_cents integer;

alter table if exists public.kofi_runway_payments
  add column if not exists net_cents integer;

comment on column public.kofi_runway_payments.fee_cents is
  'Stored processor fee in cents when known. Null = estimate in the app.';
comment on column public.kofi_runway_payments.net_cents is
  'Stored amount landed after fees. Null = estimate in the app.';

create or replace function public.get_public_support_summary()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with completed as (
    select *
    from public.donations
    where coalesce(status, 'completed') in ('completed', 'paid', 'succeeded')
  ),
  studio as (
    select * from completed where coalesce(fund_type, 'studio') = 'studio'
  ),
  active_subs as (
    select amount_cents
    from public.stripe_subscriptions
    where status in ('active', 'trialing')
      and coalesce(fund_type, 'studio') = 'studio'
      and coalesce(amount_cents, 0) > 0
  ),
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
  ),
  kofi as (
    select
      coalesce(sum(amount_cents), 0) as total_cents,
      coalesce(count(*), 0) as n,
      case
        when count(*) = 0 then 0
        when count(*) filter (where net_cents is not null) = count(*)
          then coalesce(sum(net_cents), 0)
        else null
      end as net_cents,
      case
        when count(*) = 0 then 0
        when count(*) filter (where fee_cents is not null) = count(*)
          then coalesce(sum(fee_cents), 0)
        else null
      end as fee_cents
    from public.kofi_runway_payments
    where lower(coalesce(currency, 'usd')) = 'usd'
      and amount_cents > 0
  )
  select json_build_object(
    'studio_total_cents', coalesce((select sum(amount_cents) from studio), 0),
    'studio_payment_count', coalesce((select count(*) from studio), 0),
    'studio_mrr_cents', (select cents from mrr),
    'studio_subscriber_count', (select n from mrr),
    'runway_total_cents', (select total_cents from kofi),
    'runway_payment_count', (select n from kofi),
    'runway_net_cents', (select net_cents from kofi),
    'runway_fee_cents', (select fee_cents from kofi),
    'runway_monthly_cost_cents', coalesce(
      (select monthly_cost_cents from public.runway_fund_settings where id = 1),
      433800
    ),
    'last_payment_at', (select max(created_at) from studio),
    'currency', 'usd'
  );
$$;

grant execute on function public.get_public_support_summary() to anon, authenticated;

notify pgrst, 'reload schema';
