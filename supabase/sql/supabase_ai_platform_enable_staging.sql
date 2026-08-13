-- =============================================================================
-- Enable AI services for staging / testing
-- - services_enabled = true
-- - High daily/monthly spend caps (cents of USD API cost budget)
-- - Ensure service_role can call get_ai_service_availability (Edge Functions)
-- Safe to re-run.
-- =============================================================================

insert into public.ai_platform_config (id)
values (1)
on conflict (id) do nothing;

update public.ai_platform_config
set
  services_enabled = true,
  disabled_reason = null,
  -- $500 / day, $5,000 / month of internal API cost budget (testing-friendly)
  daily_spend_cap_cents = 50000,
  monthly_spend_cap_cents = 500000,
  user_hourly_request_cap = 120,
  user_daily_request_cap = 500,
  updated_at = now()
where id = 1;

-- Edge Functions use service_role; without EXECUTE they fail closed → "usage limits"
grant execute on function public.get_ai_service_availability() to service_role;
grant execute on function public.get_ai_studio_spend_micros(text) to service_role;
grant execute on function public.ensure_ai_token_balance(uuid) to service_role;
grant execute on function public.credit_ai_tokens(
  uuid, integer, text, text, text, text, uuid, text, text, text, text, text, jsonb
) to service_role;
grant execute on function public.try_debit_ai_tokens(
  uuid, integer, text, text, text, text, bigint, bigint, text, jsonb
) to service_role;
grant execute on function public.try_debit_ai_tokens_up_to(
  uuid, integer, text, text, text, text, bigint, bigint, text, jsonb
) to service_role;

notify pgrst, 'reload schema';

-- Confirm
select id, services_enabled, daily_spend_cap_cents, monthly_spend_cap_cents
from public.ai_platform_config
where id = 1;

select public.get_ai_service_availability() as availability;
