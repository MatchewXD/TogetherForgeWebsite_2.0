-- =============================================================================
-- Migrate AI token packs from legacy tiny scale → 50,000 tokens per $1
--
-- Old packs:  Starter 250 | Builder 700 | Studio 1600
-- New packs:  Starter 250,000 | Builder 600,000 | Studio 1,250,000
--
-- Safe to re-run (only touches rows still on old pack amounts).
-- Temporarily lifts ledger immutability for corrections, then restores it.
-- =============================================================================

-- 1) Allow ledger corrections
drop trigger if exists trg_ai_token_ledger_no_update on public.ai_token_ledger;

-- 2) Fix purchase rows still on old token grants (by pack_id)
update public.ai_token_purchases p
set tokens_granted = v.new_tokens
from (
  values
    ('starter', 250, 250000),
    ('builder', 700, 600000),
    ('studio', 1600, 1250000)
) as v(pack_id, old_tokens, new_tokens)
where lower(p.pack_id) = v.pack_id
  and p.tokens_granted = v.old_tokens;

-- Price fallback for rows still on tiny grants
update public.ai_token_purchases p
set tokens_granted = v.new_tokens
from (
  values
    (500, 250000),
    (1200, 600000),
    (2500, 1250000)
) as v(amount_cents, new_tokens)
where p.amount_cents = v.amount_cents
  and p.tokens_granted in (250, 700, 1600);

-- 3) Fix ledger purchase credits (by pack_id + old display amount)
update public.ai_token_ledger l
set
  tokens = v.new_tokens,
  tokens_display = v.new_tokens,
  meta = coalesce(l.meta, '{}'::jsonb) || jsonb_build_object(
    'scale_migrated_from', v.old_tokens,
    'scale_migrated_to', v.new_tokens,
    'scale_migration', '50k_per_usd'
  )
from (
  values
    ('starter', 250, 250000),
    ('builder', 700, 600000),
    ('studio', 1600, 1250000)
) as v(pack_id, old_tokens, new_tokens)
where l.entry_type = 'purchase'
  and lower(coalesce(l.pack_id, '')) = v.pack_id
  and l.tokens_display = v.old_tokens;

-- Ledger purchases with classic old amounts (pack_id missing or mismatched)
update public.ai_token_ledger l
set
  tokens = case l.tokens_display
    when 250 then 250000
    when 700 then 600000
    when 1600 then 1250000
    else l.tokens
  end,
  tokens_display = case l.tokens_display
    when 250 then 250000
    when 700 then 600000
    when 1600 then 1250000
    else l.tokens_display
  end,
  pack_id = coalesce(
    nullif(trim(l.pack_id), ''),
    case l.tokens_display
      when 250 then 'starter'
      when 700 then 'builder'
      when 1600 then 'studio'
      else l.pack_id
    end
  ),
  meta = coalesce(l.meta, '{}'::jsonb) || jsonb_build_object(
    'scale_migrated_from', l.tokens_display,
    'scale_migration', '50k_per_usd'
  )
where l.entry_type = 'purchase'
  and l.tokens_display in (250, 700, 1600);

-- 4) Recompute balances + lifetime counters from corrected ledger
update public.ai_token_balances b
set
  balance = greatest(
    0,
    coalesce(
      (
        select sum(l.tokens)::integer
        from public.ai_token_ledger l
        where l.user_id = b.user_id
          and l.status in ('success', 'pending')
      ),
      0
    )
  ),
  lifetime_purchased = coalesce(
    (
      select sum(l.tokens_display)::integer
      from public.ai_token_ledger l
      where l.user_id = b.user_id
        and l.entry_type = 'purchase'
        and l.status = 'success'
    ),
    0
  ),
  lifetime_spent = coalesce(
    (
      select sum(l.tokens_display)::integer
      from public.ai_token_ledger l
      where l.user_id = b.user_id
        and l.entry_type = 'spend'
        and l.status = 'success'
    ),
    0
  ),
  lifetime_awarded = coalesce(
    (
      select sum(l.tokens_display)::integer
      from public.ai_token_ledger l
      where l.user_id = b.user_id
        and l.entry_type = 'award'
        and l.status = 'success'
    ),
    0
  ),
  updated_at = now();

-- Users with purchases but no balance row
insert into public.ai_token_balances (
  user_id, balance, lifetime_purchased, lifetime_spent, lifetime_awarded
)
select
  u.user_id,
  greatest(
    0,
    coalesce(
      (
        select sum(l.tokens)::integer
        from public.ai_token_ledger l
        where l.user_id = u.user_id
          and l.status in ('success', 'pending')
      ),
      0
    )
  ),
  coalesce(
    (
      select sum(l.tokens_display)::integer
      from public.ai_token_ledger l
      where l.user_id = u.user_id
        and l.entry_type = 'purchase'
        and l.status = 'success'
    ),
    0
  ),
  0,
  0
from (select distinct user_id from public.ai_token_purchases) u
on conflict (user_id) do update
set
  balance = excluded.balance,
  lifetime_purchased = excluded.lifetime_purchased,
  lifetime_spent = excluded.lifetime_spent,
  lifetime_awarded = excluded.lifetime_awarded,
  updated_at = now();

-- 5) Restore immutability
drop trigger if exists trg_ai_token_ledger_no_update on public.ai_token_ledger;
create trigger trg_ai_token_ledger_no_update
  before update or delete on public.ai_token_ledger
  for each row execute function public.ai_token_ledger_immutable();

notify pgrst, 'reload schema';
