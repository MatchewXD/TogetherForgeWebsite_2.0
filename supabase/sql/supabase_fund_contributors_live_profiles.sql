-- Live profile avatar + pinned badge for public fund supporter lists.
-- Ko-fi runway rows store from_name only; join profiles by username so credit
-- matches All Contributors (current avatar_url and pinned_badge_key).
-- Safe to re-run.

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
      case
        when k.is_public then coalesce(
          nullif(trim(p.username), ''),
          nullif(trim(k.from_name), '')
        )
        else null
      end as username,
      case when k.is_public then p.avatar_url else null end as avatar_url,
      case
        when k.is_public then coalesce(
          nullif(trim(p.username), ''),
          nullif(trim(k.from_name), '')
        )
        else null
      end as display_name,
      case when k.is_public then p.pinned_badge_key else null end as pinned_badge_key
    from public.kofi_runway_payments k
    left join public.profiles p
      on k.is_public
     and p.username is not null
     and lower(p.username) = lower(trim(k.from_name))
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
      p.id as user_id,
      coalesce(
        nullif(trim(p.username), ''),
        nullif(trim(k.from_name), '')
      ) as display_name,
      nullif(trim(p.username), '') as username,
      p.avatar_url,
      p.pinned_badge_key,
      coalesce(k.paid_at, k.created_at) as created_at,
      coalesce(
        case when p.id is not null then 'u:' || p.id::text end,
        'k:' || lower(trim(k.from_name))
      ) as person_key
    from public.kofi_runway_payments k
    left join public.profiles p
      on p.username is not null
     and lower(p.username) = lower(trim(k.from_name))
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
      user_id,
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
          user_id,
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

comment on function public.get_public_fund_contributors(text) is
  'Unique opted-in supporters for studio or runway. Live profile username, avatar, and pinned badge. No anonymous rows, no duplicates.';

notify pgrst, 'reload schema';
