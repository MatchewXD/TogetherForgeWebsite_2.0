-- =============================================================================
-- Billing API grants (My Plan / history RPCs + own-row reads)
-- Safe to re-run. Apply if Account → My Plan is empty despite Stripe charges.
-- Prerequisites: supabase_billing_account.sql
-- =============================================================================

grant usage on schema public to authenticated, anon, service_role;

grant select on table public.stripe_subscriptions to authenticated, service_role;
grant select on table public.donations to authenticated, service_role;

-- RPCs (security definer; filter by auth.uid())
grant execute on function public.get_my_subscription_plan() to authenticated;
grant execute on function public.get_my_subscriptions() to authenticated;
grant execute on function public.get_my_billing_history(integer) to authenticated;

-- Own-row RLS (service role bypasses; clients need these for table fallbacks)
alter table public.stripe_subscriptions enable row level security;
alter table public.donations enable row level security;

drop policy if exists stripe_subscriptions_select_own on public.stripe_subscriptions;
create policy stripe_subscriptions_select_own
  on public.stripe_subscriptions
  for select
  to authenticated
  using (user_id is not null and user_id = auth.uid());

drop policy if exists "Users can read own donations" on public.donations;
create policy "Users can read own donations"
  on public.donations
  for select
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
