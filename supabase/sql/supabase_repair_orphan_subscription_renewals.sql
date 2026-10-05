-- Repair subscription renewals that landed without credit.
-- Happened when invoice.paid payloads omitted invoice.subscription
-- (Stripe Basil nested it under parent.subscription_details).
-- Safe to re-run.

with pick as (
  select distinct on (d.id)
    d.id as donation_id,
    s.id as sub_id,
    s.user_id,
    s.display_name,
    s.is_anonymous
  from public.donations d
  join public.stripe_subscriptions s
    on s.customer_id = d.stripe_customer_id
   and s.user_id is not null
  where d.user_id is null
    and d.payment_kind = 'subscription_payment'
    and d.stripe_subscription_id is null
    and d.stripe_customer_id is not null
    and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
  order by
    d.id,
    case when s.amount_cents = d.amount_cents then 0 else 1 end,
    s.updated_at desc nulls last
)
update public.donations d
set
  user_id = p.user_id,
  display_name = case
    when p.is_anonymous is false then coalesce(p.display_name, d.display_name)
    else d.display_name
  end,
  is_anonymous = p.is_anonymous,
  stripe_subscription_id = p.sub_id
from pick p
where d.id = p.donation_id;

update public.project_contributions c
set
  user_id = d.user_id,
  display_name = d.display_name,
  is_anonymous = d.is_anonymous
from public.donations d
where c.category = 'donations'
  and c.user_id is null
  and coalesce(c.is_anonymous, true) = true
  and c.amount_cents = d.amount_cents
  and c.project_id is not distinct from d.project_id
  and d.user_id is not null
  and coalesce(d.is_anonymous, true) = false
  and d.payment_kind = 'subscription_payment'
  and abs(extract(epoch from (c.created_at - d.created_at))) < 5;
