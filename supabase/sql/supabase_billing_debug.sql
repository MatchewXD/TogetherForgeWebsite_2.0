-- Billing debug snapshot (run on staging SQL Editor or: supabase db query --linked -f ...)
select 'stripe_subscriptions' as src, count(*)::text as n from stripe_subscriptions
union all
select 'donations', count(*)::text from donations
union all
select 'stripe_webhook_events', count(*)::text from stripe_webhook_events
union all
select 'donations_with_user', count(*)::text from donations where user_id is not null
union all
select 'subs_with_user', count(*)::text from stripe_subscriptions where user_id is not null;

select id, user_id, status, amount_cents, customer_id, updated_at
from stripe_subscriptions
order by updated_at desc nulls last
limit 10;

select id, user_id, amount_cents, interval, status, stripe_session_id, stripe_subscription_id, created_at
from donations
order by created_at desc
limit 10;

select id, type, processed_at
from stripe_webhook_events
order by processed_at desc
limit 15;
