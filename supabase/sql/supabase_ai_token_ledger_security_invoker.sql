-- =============================================================================
-- Fix advisor: view public.ai_token_ledger_user SECURITY DEFINER
-- Recreate as SECURITY INVOKER + column-level grants so cost/margin stay hidden.
-- Safe to re-run. Apply on staging and production.
-- =============================================================================

drop policy if exists "Users read own ai token ledger" on public.ai_token_ledger;
create policy "Users read own ai token ledger"
  on public.ai_token_ledger for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.ai_token_ledger from anon, authenticated, public;
grant select, insert on public.ai_token_ledger to service_role;
grant select (
  id,
  user_id,
  entry_type,
  tokens_display,
  status,
  prompt_summary,
  action_key,
  pack_id,
  created_at
) on public.ai_token_ledger to authenticated;

drop view if exists public.ai_token_ledger_user;
create view public.ai_token_ledger_user
with (security_invoker = true)
as
select
  id,
  user_id,
  entry_type,
  tokens_display as tokens,
  status,
  prompt_summary,
  action_key,
  pack_id,
  created_at
from public.ai_token_ledger
where user_id = (select auth.uid());

comment on view public.ai_token_ledger_user is
  'User-visible AI token history. Never exposes API cost or margins. SECURITY INVOKER.';

revoke all on public.ai_token_ledger_user from anon, public;
grant select on public.ai_token_ledger_user to authenticated;

notify pgrst, 'reload schema';
