-- =============================================================================
-- Billing + My Plan (Stripe subscriptions for account area)
-- Run after supabase_donations_stripe.sql + supabase_stripe_subscriptions.sql
-- Safe to re-run.
-- =============================================================================
-- Separation:
--   donations.payment_kind = 'one_time' | 'subscription_payment'
--   stripe_subscriptions   = active/historical monthly plans (lifecycle)
-- =============================================================================

-- ── Donations: clear one-time vs subscription charge ─────────────────────────
alter table if exists public.donations
  add column if not exists payment_kind text;

update public.donations
set payment_kind = case
  when coalesce(interval, 'once') = 'month'
    or stripe_subscription_id is not null
    then 'subscription_payment'
  else 'one_time'
end
where payment_kind is null;

alter table public.donations
  alter column payment_kind set default 'one_time';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'donations_payment_kind_check'
  ) then
    alter table public.donations
      add constraint donations_payment_kind_check
      check (payment_kind in ('one_time', 'subscription_payment'));
  end if;
exception when others then
  raise notice 'payment_kind check: %', sqlerrm;
end;
$$;

create index if not exists idx_donations_payment_kind
  on public.donations (payment_kind, created_at desc);

create index if not exists idx_donations_user_created
  on public.donations (user_id, created_at desc)
  where user_id is not null;

-- ── Subscriptions: plan identity for My Plan ─────────────────────────────────
alter table if exists public.stripe_subscriptions
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table if exists public.stripe_subscriptions
  add column if not exists is_anonymous boolean default true;

alter table if exists public.stripe_subscriptions
  add column if not exists display_name text;

alter table if exists public.stripe_subscriptions
  add column if not exists tier_label text;

alter table if exists public.stripe_subscriptions
  add column if not exists created_at timestamptz default now();

create index if not exists idx_stripe_subscriptions_user
  on public.stripe_subscriptions (user_id)
  where user_id is not null;

create index if not exists idx_stripe_subscriptions_customer
  on public.stripe_subscriptions (customer_id);

-- Users may read their own subscription rows (account UI)
drop policy if exists stripe_subscriptions_select_own on public.stripe_subscriptions;
create policy stripe_subscriptions_select_own
  on public.stripe_subscriptions
  for select
  to authenticated
  using (user_id is not null and user_id = auth.uid());

-- Users may read own donation history
drop policy if exists "Users can read own donations" on public.donations;
create policy "Users can read own donations"
  on public.donations
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ── RPC: current plan for signed-in user ─────────────────────────────────────
create or replace function public.get_my_subscription_plan()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r record;
begin
  if uid is null then
    return null;
  end if;

  select
    s.id,
    s.status,
    s.fund_type,
    s.amount_cents,
    s.currency,
    s.tier_id,
    s.tier_label,
    s.cancel_at_period_end,
    s.current_period_end,
    s.canceled_at,
    s.customer_id,
    s.updated_at,
    s.created_at
  into r
  from public.stripe_subscriptions s
  where s.user_id = uid
    and s.status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid')
  order by
    case
      when s.status in ('active', 'trialing') then 0
      when s.status = 'past_due' then 1
      else 2
    end,
    s.updated_at desc nulls last
  limit 1;

  if not found then
    return null;
  end if;

  return json_build_object(
    'id', r.id,
    'status', r.status,
    'fund_type', coalesce(r.fund_type, 'studio'),
    'amount_cents', coalesce(r.amount_cents, 0),
    'currency', coalesce(r.currency, 'usd'),
    'tier_id', r.tier_id,
    'tier_label', r.tier_label,
    'cancel_at_period_end', coalesce(r.cancel_at_period_end, false),
    'current_period_end', r.current_period_end,
    'canceled_at', r.canceled_at,
    'customer_id', r.customer_id,
    'updated_at', r.updated_at,
    'created_at', r.created_at
  );
end;
$$;

grant execute on function public.get_my_subscription_plan() to authenticated;

-- ── RPC: my payment history (one-time + subscription charges, no stripe secrets)
create or replace function public.get_my_billing_history(limit_n integer default 30)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return '[]'::json;
  end if;

  return coalesce(
    (
      select json_agg(row_to_json(t))
      from (
        select
          d.id,
          d.created_at,
          coalesce(d.amount_cents, d.amount * 100, 0)::integer as amount_cents,
          coalesce(d.currency, 'usd') as currency,
          coalesce(d.payment_kind,
            case
              when coalesce(d.interval, 'once') = 'month'
                or d.stripe_subscription_id is not null
              then 'subscription_payment'
              else 'one_time'
            end
          ) as payment_kind,
          coalesce(d.interval, 'once') as interval,
          coalesce(d.status, 'completed') as status,
          d.tier_id,
          d.tier_label,
          d.fund_type,
          (d.stripe_subscription_id is not null) as is_subscription_charge
        from public.donations d
        where d.user_id = uid
          and coalesce(d.status, 'completed') in (
            'completed', 'paid', 'succeeded', 'refunded'
          )
        order by d.created_at desc nulls last
        limit least(greatest(coalesce(limit_n, 30), 1), 100)
      ) t
    ),
    '[]'::json
  );
end;
$$;

grant execute on function public.get_my_billing_history(integer) to authenticated;

-- Active subscriptions list for account
create or replace function public.get_my_subscriptions()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return '[]'::json;
  end if;

  return coalesce(
    (
      select json_agg(row_to_json(t))
      from (
        select
          s.id,
          s.status,
          s.amount_cents,
          s.currency,
          s.tier_id,
          s.tier_label,
          s.cancel_at_period_end,
          s.current_period_end,
          s.canceled_at,
          s.updated_at,
          s.created_at
        from public.stripe_subscriptions s
        where s.user_id = uid
        order by s.updated_at desc nulls last
        limit 20
      ) t
    ),
    '[]'::json
  );
end;
$$;

grant execute on function public.get_my_subscriptions() to authenticated;

comment on column public.donations.payment_kind is
  'one_time = pure donation; subscription_payment = monthly sub charge (including renewals).';
comment on function public.get_my_subscription_plan is
  'Signed-in user current/most relevant subscription for Account → My Plan.';
