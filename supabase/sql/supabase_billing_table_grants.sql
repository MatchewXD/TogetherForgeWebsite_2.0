-- =============================================================================
-- Billing tables: grants for Edge Functions (service_role) + Account UI
-- Fixes: sync-checkout / stripe-webhook "permission denied for table donations"
-- Safe to re-run.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Donations: webhook + sync-checkout write; users read own rows via RLS
do $$
begin
  if to_regclass('public.donations') is not null then
    grant select on table public.donations to authenticated, service_role;
    grant insert, update, delete on table public.donations to service_role;
    -- optional: authenticated insert not needed (webhook only)
  end if;
  if to_regclass('public.stripe_subscriptions') is not null then
    grant select on table public.stripe_subscriptions to authenticated, service_role;
    grant insert, update, delete on table public.stripe_subscriptions to service_role;
  end if;
  if to_regclass('public.stripe_webhook_events') is not null then
    grant select, insert, update, delete on table public.stripe_webhook_events to service_role;
  end if;
  if to_regclass('public.project_contributions') is not null then
    grant select on table public.project_contributions to anon, authenticated, service_role;
    grant insert, update, delete on table public.project_contributions to service_role;
  end if;
end $$;

-- Billing RPCs
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_my_subscription_plan'
  ) then
    grant execute on function public.get_my_subscription_plan() to authenticated;
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_my_subscriptions'
  ) then
    grant execute on function public.get_my_subscriptions() to authenticated;
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_my_billing_history'
  ) then
    grant execute on function public.get_my_billing_history(integer) to authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
