-- =============================================================================
-- Ko-fi personal runway (separate from Stripe studio Support)
-- Safe to re-run.
-- =============================================================================

create table if not exists public.kofi_runway_payments (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  kofi_transaction_id text,
  type text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  from_name text,
  message text,
  is_public boolean not null default false,
  is_subscription_payment boolean not null default false,
  is_first_subscription_payment boolean not null default false,
  tier_name text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_kofi_runway_paid_at
  on public.kofi_runway_payments (paid_at desc nulls last);

create table if not exists public.runway_fund_settings (
  id integer primary key default 1 check (id = 1),
  monthly_cost_cents integer not null default 433800,
  updated_at timestamptz not null default now()
);

insert into public.runway_fund_settings (id, monthly_cost_cents)
values (1, 433800)
on conflict (id) do update set
  monthly_cost_cents = excluded.monthly_cost_cents,
  updated_at = now();

comment on table public.kofi_runway_payments is
  'Ko-fi webhook payments for founder personal runway. Not Stripe. Not studio Support.';
comment on table public.runway_fund_settings is
  'Living-cost target used to convert runway dollars into months of coverage.';

alter table public.kofi_runway_payments enable row level security;
alter table public.runway_fund_settings enable row level security;

drop policy if exists "Public can read kofi runway payments" on public.kofi_runway_payments;
-- No anon/authenticated policies: public reads go through RPCs only.

drop policy if exists "Public can read runway fund settings" on public.runway_fund_settings;
create policy "Public can read runway fund settings"
  on public.runway_fund_settings for select
  using (true);

grant select on table public.runway_fund_settings to anon, authenticated, service_role;
grant all on table public.kofi_runway_payments to service_role;
grant all on table public.runway_fund_settings to service_role;

-- ---------------------------------------------------------------------------
-- Public totals: Stripe studio + (legacy Stripe runway + Ko-fi runway)
-- ---------------------------------------------------------------------------
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
      coalesce(count(*), 0) as n
    from public.kofi_runway_payments
    where lower(coalesce(currency, 'usd')) = 'usd'
      and amount_cents > 0
  ),
  stripe_runway as (
    select
      coalesce(sum(amount_cents), 0) as total_cents,
      coalesce(count(*), 0) as n
    from completed
    where fund_type = 'runway'
  )
  select json_build_object(
    'studio_total_cents', coalesce((select sum(amount_cents) from studio), 0),
    'studio_payment_count', coalesce((select count(*) from studio), 0),
    'studio_mrr_cents', (select cents from mrr),
    'studio_subscriber_count', (select n from mrr),
    'runway_total_cents',
      (select total_cents from stripe_runway) + (select total_cents from kofi),
    'runway_payment_count',
      (select n from stripe_runway) + (select n from kofi),
    'runway_monthly_cost_cents', coalesce(
      (select monthly_cost_cents from public.runway_fund_settings where id = 1),
      433800
    ),
    'last_payment_at', (select max(created_at) from studio),
    'currency', 'usd'
  );
$$;

grant execute on function public.get_public_support_summary() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Recent runway gifts: Ko-fi + any legacy Stripe runway rows
-- ---------------------------------------------------------------------------
create or replace function public.get_public_recent_donations(
  limit_n integer default 12,
  p_fund_type text default 'studio'
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with lim as (
    select least(greatest(coalesce(limit_n, 12), 1), 20) as n
  ),
  fund as (
    select coalesce(nullif(trim(p_fund_type), ''), 'studio') as kind
  ),
  stripe_rows as (
    select
      coalesce(d.amount_cents, d.amount * 100, 0)::integer as amount_cents,
      d.created_at,
      (coalesce(d.interval, 'once') = 'month') as is_recurring,
      coalesce(d.is_anonymous, true) as is_anonymous,
      case
        when coalesce(d.is_anonymous, true) = false then p.username
        else null
      end as username,
      case
        when coalesce(d.is_anonymous, true) = false then p.avatar_url
        else null
      end as avatar_url,
      case
        when coalesce(d.is_anonymous, true) = false then
          coalesce(
            nullif(trim(p.username), ''),
            nullif(trim(d.display_name), ''),
            null
          )
        else null
      end as display_name,
      case
        when coalesce(d.is_anonymous, true) = false then p.pinned_badge_key
        else null
      end as pinned_badge_key
    from public.donations d
    left join public.profiles p on p.id = d.user_id
    where coalesce(d.fund_type, 'studio') = (select kind from fund)
      and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
      and coalesce(d.amount_cents, d.amount * 100, 0) > 0
  ),
  kofi_rows as (
    select
      k.amount_cents,
      coalesce(k.paid_at, k.created_at) as created_at,
      k.is_subscription_payment as is_recurring,
      (not k.is_public) as is_anonymous,
      case when k.is_public then nullif(trim(k.from_name), '') else null end as username,
      null::text as avatar_url,
      case when k.is_public then nullif(trim(k.from_name), '') else null end as display_name,
      null::text as pinned_badge_key
    from public.kofi_runway_payments k
    where (select kind from fund) = 'runway'
      and lower(coalesce(k.currency, 'usd')) = 'usd'
      and k.amount_cents > 0
  ),
  combined as (
    select * from stripe_rows
    union all
    select * from kofi_rows
  )
  select coalesce(
    (
      select json_agg(row_to_json(t))
      from (
        select *
        from combined
        order by created_at desc nulls last
        limit (select n from lim)
      ) t
    ),
    '[]'::json
  );
$$;

grant execute on function public.get_public_recent_donations(integer, text)
  to anon, authenticated;

create or replace function public.get_public_fund_contributors(
  p_fund_type text default 'studio'
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with fund as (
    select coalesce(nullif(trim(p_fund_type), ''), 'studio') as kind
  ),
  named as (
    select
      d.user_id,
      coalesce(
        nullif(trim(p.username), ''),
        nullif(trim(d.display_name), '')
      ) as display_name,
      nullif(trim(p.username), '') as username,
      p.avatar_url,
      p.pinned_badge_key,
      d.created_at,
      coalesce(
        case when d.user_id is not null then 'u:' || d.user_id::text end,
        'n:' || lower(trim(coalesce(
          nullif(trim(p.username), ''),
          nullif(trim(d.display_name), ''),
          ''
        )))
      ) as person_key
    from public.donations d
    left join public.profiles p on p.id = d.user_id
    where coalesce(d.fund_type, 'studio') = (select kind from fund)
      and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
      and coalesce(d.amount_cents, d.amount * 100, 0) > 0
      and coalesce(d.is_anonymous, true) = false

    union all

    select
      null::uuid as user_id,
      nullif(trim(k.from_name), '') as display_name,
      null::text as username,
      null::text as avatar_url,
      null::text as pinned_badge_key,
      coalesce(k.paid_at, k.created_at) as created_at,
      'k:' || lower(trim(k.from_name)) as person_key
    from public.kofi_runway_payments k
    where (select kind from fund) = 'runway'
      and k.is_public = true
      and nullif(trim(k.from_name), '') is not null
      and k.amount_cents > 0
  ),
  keyed as (
    select *
    from named
    where display_name is not null
      and person_key is not null
      and person_key <> 'n:'
      and person_key <> 'k:'
  ),
  first_seen as (
    select distinct on (person_key)
      person_key,
      display_name,
      username,
      avatar_url,
      pinned_badge_key,
      created_at as first_at
    from keyed
    order by person_key, created_at asc nulls last
  )
  select coalesce(
    (
      select json_agg(row_to_json(t))
      from (
        select
          display_name,
          username,
          avatar_url,
          pinned_badge_key,
          first_at
        from first_seen
        order by lower(display_name)
      ) t
    ),
    '[]'::json
  );
$$;

grant execute on function public.get_public_fund_contributors(text)
  to anon, authenticated;

notify pgrst, 'reload schema';
