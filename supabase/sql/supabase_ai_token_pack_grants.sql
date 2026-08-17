-- =============================================================================
-- Canonical AI token pack grants (50,000 tokens per $1)
-- Safe to re-run.
--
-- Cards / checkout / fulfillment must all use:
--   starter $5  → 250,000
--   builder $12 → 600,000
--   studio  $25 → 1,250,000
--
-- Fixes purchases that were credited at the legacy scale (250 / 700 / 1600).
-- =============================================================================

create or replace function public.canonical_ai_token_pack_tokens(
  p_pack_id text,
  p_amount_cents integer default null
)
returns integer
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(p_pack_id, ''))) = 'starter' then 250000
    when lower(trim(coalesce(p_pack_id, ''))) = 'builder' then 600000
    when lower(trim(coalesce(p_pack_id, ''))) = 'studio' then 1250000
    when coalesce(p_amount_cents, 0) >= 2500 then 1250000
    when coalesce(p_amount_cents, 0) >= 1200 then 600000
    when coalesce(p_amount_cents, 0) >= 500 then 250000
    else 0
  end;
$$;

comment on function public.canonical_ai_token_pack_tokens(text, integer) is
  'Published pack sizes. Never grant the legacy 250/700/1600 amounts.';

create or replace function public.grant_ai_token_pack_purchase(
  p_user_id uuid,
  p_pack_id text,
  p_amount_cents integer default null,
  p_stripe_session_id text default null,
  p_stripe_payment_intent text default null,
  p_stripe_customer_id text default null,
  p_purchase_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tokens integer;
  v_pack text := lower(trim(coalesce(p_pack_id, '')));
  v_already integer := 0;
  v_delta integer;
  v_key text;
  v_ledger public.ai_token_ledger;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'user required');
  end if;

  v_tokens := public.canonical_ai_token_pack_tokens(v_pack, p_amount_cents);
  if v_tokens <= 0 then
    return jsonb_build_object('ok', false, 'error', 'unknown pack');
  end if;

  if p_stripe_session_id is not null and trim(p_stripe_session_id) <> '' then
    select coalesce(sum(tokens_display), 0) into v_already
    from public.ai_token_ledger
    where user_id = p_user_id
      and stripe_session_id = trim(p_stripe_session_id)
      and entry_type in ('purchase', 'adjustment')
      and status = 'success';
    v_key := 'purchase:session:' || trim(p_stripe_session_id);
  elsif p_stripe_payment_intent is not null
        and trim(p_stripe_payment_intent) <> '' then
    select coalesce(sum(tokens_display), 0) into v_already
    from public.ai_token_ledger
    where user_id = p_user_id
      and stripe_payment_intent = trim(p_stripe_payment_intent)
      and entry_type in ('purchase', 'adjustment')
      and status = 'success';
    v_key := 'purchase:pi:' || trim(p_stripe_payment_intent);
  else
    v_key := null;
  end if;

  v_delta := v_tokens - coalesce(v_already, 0);
  if v_delta <= 0 then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'tokens', v_tokens,
      'already', v_already
    );
  end if;

  v_ledger := public.credit_ai_tokens(
    p_user_id,
    v_delta,
    case when v_already > 0 then 'adjustment' else 'purchase' end,
    'success',
    case
      when v_already > 0 then
        'Token pack scale correction (+'
        || v_delta::text
        || ' tokens)'
      else
        initcap(v_pack) || ' pack purchase'
    end,
    v_pack,
    p_purchase_id,
    case when v_already > 0 then 'scale_migration' else 'stripe' end,
    coalesce(p_stripe_session_id, p_stripe_payment_intent),
    p_stripe_session_id,
    p_stripe_payment_intent,
    case
      when v_already > 0 and v_key is not null then v_key || ':topup:' || v_tokens::text
      else v_key
    end,
    jsonb_build_object(
      'pack_id', v_pack,
      'amount_cents', p_amount_cents,
      'tokens', v_tokens,
      'delta', v_delta,
      'already', v_already
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'tokens', v_tokens,
    'credited', v_delta,
    'ledger_id', v_ledger.id
  );
end;
$$;

revoke all on function public.grant_ai_token_pack_purchase(
  uuid, text, integer, text, text, text, uuid
) from public;
grant execute on function public.grant_ai_token_pack_purchase(
  uuid, text, integer, text, text, text, uuid
) to service_role;

-- Top up any completed purchase that was granted at the old scale
do $$
declare
  r record;
  want integer;
  have integer;
begin
  if to_regclass('public.ai_token_purchases') is null then
    return;
  end if;
  if to_regclass('public.ai_token_ledger') is null then
    return;
  end if;

  for r in
    select
      p.id,
      p.user_id,
      p.pack_id,
      p.amount_cents,
      p.stripe_session_id,
      p.stripe_payment_intent,
      p.stripe_customer_id
    from public.ai_token_purchases p
    where p.user_id is not null
      and coalesce(p.status, '') in ('completed', 'pending')
  loop
    want := public.canonical_ai_token_pack_tokens(r.pack_id, r.amount_cents);
    if want <= 0 then
      continue;
    end if;

    select coalesce(sum(l.tokens_display), 0) into have
    from public.ai_token_ledger l
    where l.user_id = r.user_id
      and l.entry_type in ('purchase', 'adjustment')
      and l.status = 'success'
      and (
        (r.stripe_session_id is not null
          and l.stripe_session_id = r.stripe_session_id)
        or (r.stripe_payment_intent is not null
          and l.stripe_payment_intent = r.stripe_payment_intent)
        or (r.stripe_session_id is null
          and r.stripe_payment_intent is null
          and l.purchase_id = r.id)
      );

    if have < want then
      perform public.grant_ai_token_pack_purchase(
        r.user_id,
        r.pack_id,
        r.amount_cents,
        r.stripe_session_id,
        r.stripe_payment_intent,
        r.stripe_customer_id,
        r.id
      );
      update public.ai_token_purchases
      set
        tokens_granted = want,
        status = 'completed',
        completed_at = coalesce(completed_at, now())
      where id = r.id;
    elsif have >= want and coalesce(
      (select tokens_granted from public.ai_token_purchases where id = r.id),
      0
    ) < want then
      update public.ai_token_purchases
      set tokens_granted = want
      where id = r.id;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
