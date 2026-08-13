-- =============================================================================
-- AI Token economy (Phase 1 foundation)
-- Completely separate from donations / subscriptions tables.
-- Safe to re-run.
-- =============================================================================

-- ── Balances (one row per user) ───────────────────────────────────────────────
create table if not exists public.ai_token_balances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_purchased integer not null default 0 check (lifetime_purchased >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  lifetime_awarded integer not null default 0 check (lifetime_awarded >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_token_balances is
  'Per-user AI token balance. Separate from donations.';

-- ── Immutable ledger ─────────────────────────────────────────────────────────
-- Append-only financial + usage history. Internal cost columns exist but must
-- never be exposed via user-facing views/RPCs.
create table if not exists public.ai_token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- purchase | spend | refund | award | adjustment
  entry_type text not null,
  -- Signed delta: positive credits balance, negative debits
  tokens integer not null,
  -- Absolute tokens shown to user for this event (always >= 0)
  tokens_display integer not null check (tokens_display >= 0),
  status text not null default 'success',
  -- Short user-visible summary (e.g. "Idea Structuring", "Starter pack")
  prompt_summary text,
  -- Future AI action key (idea_structure, gap_fill, …); null for purchases
  action_key text,
  pack_id text,
  -- Link purchase / refund rows without mixing into donations table
  purchase_id uuid,
  -- Future donor thank-you tokens (nullable reference only)
  source text,
  source_ref text,
  -- INTERNAL ONLY — never select these in user-facing RPCs/views
  provider text,
  model text,
  api_cost_usd_micros bigint not null default 0 check (api_cost_usd_micros >= 0),
  margin_usd_micros bigint not null default 0,
  stripe_session_id text,
  stripe_payment_intent text,
  idempotency_key text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_token_ledger_entry_type_chk check (
    entry_type in ('purchase', 'spend', 'refund', 'award', 'adjustment')
  ),
  constraint ai_token_ledger_status_chk check (
    status in ('success', 'failed', 'pending', 'refunded', 'cancelled')
  )
);

create unique index if not exists idx_ai_token_ledger_idempotency
  on public.ai_token_ledger (idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_ai_token_ledger_user_created
  on public.ai_token_ledger (user_id, created_at desc);

create index if not exists idx_ai_token_ledger_session
  on public.ai_token_ledger (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists idx_ai_token_ledger_type_created
  on public.ai_token_ledger (entry_type, created_at desc);

comment on table public.ai_token_ledger is
  'Immutable AI token movements. Cost/margin columns are internal-only.';

-- Block UPDATE/DELETE for normal roles (immutability)
create or replace function public.ai_token_ledger_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ai_token_ledger is append-only';
end;
$$;

drop trigger if exists trg_ai_token_ledger_no_update on public.ai_token_ledger;
create trigger trg_ai_token_ledger_no_update
  before update or delete on public.ai_token_ledger
  for each row execute function public.ai_token_ledger_immutable();

-- ── Purchases (Stripe token packs — NOT donations) ───────────────────────────
create table if not exists public.ai_token_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_id text not null,
  tokens_granted integer not null check (tokens_granted > 0),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  status text not null default 'pending',
  stripe_session_id text,
  stripe_payment_intent text,
  stripe_customer_id text,
  label text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_token_purchases_status_chk check (
    status in ('pending', 'completed', 'failed', 'refunded', 'cancelled')
  )
);

create unique index if not exists idx_ai_token_purchases_session
  on public.ai_token_purchases (stripe_session_id)
  where stripe_session_id is not null;

create unique index if not exists idx_ai_token_purchases_pi
  on public.ai_token_purchases (stripe_payment_intent)
  where stripe_payment_intent is not null;

create index if not exists idx_ai_token_purchases_user_created
  on public.ai_token_purchases (user_id, created_at desc);

comment on table public.ai_token_purchases is
  'AI token pack purchases via Stripe. Separate from public.donations.';

-- FK from ledger.purchase_id (added after purchases table exists)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'ai_token_ledger_purchase_id_fkey'
      and table_schema = 'public'
  ) then
    alter table public.ai_token_ledger
      add constraint ai_token_ledger_purchase_id_fkey
      foreign key (purchase_id) references public.ai_token_purchases (id)
      on delete set null;
  end if;
end $$;

-- ── Generation attempt log (debug + studio cost tracking) ────────────────────
create table if not exists public.ai_generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action_key text not null,
  status text not null,
  prompt_summary text,
  tokens_charged integer not null default 0 check (tokens_charged >= 0),
  -- INTERNAL
  provider text,
  model text,
  api_cost_usd_micros bigint not null default 0 check (api_cost_usd_micros >= 0),
  latency_ms integer,
  error_code text,
  error_message text,
  request_id text,
  ledger_id uuid references public.ai_token_ledger (id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_generation_log_status_chk check (
    status in (
      'success',
      'failed',
      'rate_limited',
      'spend_capped',
      'insufficient_tokens',
      'disabled',
      'cancelled'
    )
  )
);

create index if not exists idx_ai_generation_log_created
  on public.ai_generation_log (created_at desc);

create index if not exists idx_ai_generation_log_user_created
  on public.ai_generation_log (user_id, created_at desc);

create index if not exists idx_ai_generation_log_status_created
  on public.ai_generation_log (status, created_at desc);

comment on table public.ai_generation_log is
  'Internal AI generation attempts for debugging and studio spend caps.';

-- ── Platform config (singleton) ──────────────────────────────────────────────
create table if not exists public.ai_platform_config (
  id integer primary key default 1 check (id = 1),
  services_enabled boolean not null default true,
  disabled_reason text,
  -- Studio-side API spend protection (USD cents of estimated/real provider cost)
  daily_spend_cap_cents integer not null default 5000 check (daily_spend_cap_cents >= 0),
  monthly_spend_cap_cents integer not null default 100000 check (monthly_spend_cap_cents >= 0),
  -- Soft per-user request caps (enforced in app + functions; also stored for ops)
  user_hourly_request_cap integer not null default 30,
  user_daily_request_cap integer not null default 100,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.ai_platform_config (id)
values (1)
on conflict (id) do nothing;

comment on table public.ai_platform_config is
  'AI platform kill-switch and studio spend caps (ops).';

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.ai_token_balances enable row level security;
alter table public.ai_token_ledger enable row level security;
alter table public.ai_token_purchases enable row level security;
alter table public.ai_generation_log enable row level security;
alter table public.ai_platform_config enable row level security;

drop policy if exists "Users read own ai token balance" on public.ai_token_balances;
create policy "Users read own ai token balance"
  on public.ai_token_balances for select
  to authenticated
  using (auth.uid() = user_id);

-- No direct user insert/update on balances (RPCs / service_role only)

drop policy if exists "Users read own ai token purchases" on public.ai_token_purchases;
create policy "Users read own ai token purchases"
  on public.ai_token_purchases for select
  to authenticated
  using (auth.uid() = user_id);

-- Ledger: users must not read raw table (has cost columns). Use safe view/RPC.
-- service_role bypasses RLS.

drop policy if exists "No direct user select ai generation log" on public.ai_generation_log;
-- no user policies → authenticated cannot read generation log

drop policy if exists "Authenticated read ai platform enabled flag" on public.ai_platform_config;
create policy "Authenticated read ai platform enabled flag"
  on public.ai_platform_config for select
  to authenticated
  using (true);

-- ── Safe user-facing ledger view (no cost/margin/provider internals) ──────────
-- security_invoker=false (default): runs with view owner rights so users can read
-- only the projected columns without SELECT on the raw ledger table.
create or replace view public.ai_token_ledger_user as
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
where user_id = auth.uid();

comment on view public.ai_token_ledger_user is
  'User-visible AI token history. Never exposes API cost or margins.';

-- ── Helper: ensure balance row ───────────────────────────────────────────────
create or replace function public.ensure_ai_token_balance(p_user_id uuid)
returns public.ai_token_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.ai_token_balances;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;
  insert into public.ai_token_balances (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
  select * into row from public.ai_token_balances where user_id = p_user_id;
  return row;
end;
$$;

revoke all on function public.ensure_ai_token_balance(uuid) from public;
grant execute on function public.ensure_ai_token_balance(uuid) to service_role;

-- ── Credit tokens (purchase / award / adjustment) ────────────────────────────
create or replace function public.credit_ai_tokens(
  p_user_id uuid,
  p_tokens integer,
  p_entry_type text,
  p_status text default 'success',
  p_prompt_summary text default null,
  p_pack_id text default null,
  p_purchase_id uuid default null,
  p_source text default null,
  p_source_ref text default null,
  p_stripe_session_id text default null,
  p_stripe_payment_intent text default null,
  p_idempotency_key text default null,
  p_meta jsonb default '{}'::jsonb
)
returns public.ai_token_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  ledger_row public.ai_token_ledger;
  existing public.ai_token_ledger;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;
  if p_tokens is null or p_tokens <= 0 then
    raise exception 'tokens must be positive';
  end if;
  if p_entry_type not in ('purchase', 'award', 'adjustment', 'refund') then
    raise exception 'invalid entry_type for credit';
  end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.ai_token_ledger
    where idempotency_key = p_idempotency_key
    limit 1;
    if found then
      return existing;
    end if;
  end if;

  perform public.ensure_ai_token_balance(p_user_id);

  insert into public.ai_token_ledger (
    user_id, entry_type, tokens, tokens_display, status, prompt_summary,
    pack_id, purchase_id, source, source_ref,
    stripe_session_id, stripe_payment_intent, idempotency_key, meta
  ) values (
    p_user_id, p_entry_type, p_tokens, p_tokens, coalesce(p_status, 'success'),
    p_prompt_summary, p_pack_id, p_purchase_id, p_source, p_source_ref,
    p_stripe_session_id, p_stripe_payment_intent, p_idempotency_key,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning * into ledger_row;

  update public.ai_token_balances
  set
    balance = balance + p_tokens,
    lifetime_purchased = lifetime_purchased
      + case when p_entry_type = 'purchase' then p_tokens else 0 end,
    lifetime_awarded = lifetime_awarded
      + case when p_entry_type = 'award' then p_tokens else 0 end,
    updated_at = now()
  where user_id = p_user_id;

  return ledger_row;
end;
$$;

revoke all on function public.credit_ai_tokens(
  uuid, integer, text, text, text, text, uuid, text, text, text, text, text, jsonb
) from public;
grant execute on function public.credit_ai_tokens(
  uuid, integer, text, text, text, text, uuid, text, text, text, text, text, jsonb
) to service_role;

-- ── Try debit tokens (for future AI services) ────────────────────────────────
create or replace function public.try_debit_ai_tokens(
  p_user_id uuid,
  p_tokens integer,
  p_action_key text,
  p_prompt_summary text default null,
  p_provider text default null,
  p_model text default null,
  p_api_cost_usd_micros bigint default 0,
  p_margin_usd_micros bigint default 0,
  p_idempotency_key text default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
  ledger_row public.ai_token_ledger;
  existing public.ai_token_ledger;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED');
  end if;
  if p_tokens is null or p_tokens <= 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_TOKENS');
  end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.ai_token_ledger
    where idempotency_key = p_idempotency_key
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'ledger_id', existing.id,
        'tokens', existing.tokens_display,
        'balance_after', (
          select balance from public.ai_token_balances where user_id = p_user_id
        )
      );
    end if;
  end if;

  perform public.ensure_ai_token_balance(p_user_id);

  select balance into bal
  from public.ai_token_balances
  where user_id = p_user_id
  for update;

  if bal is null or bal < p_tokens then
    return jsonb_build_object(
      'ok', false,
      'code', 'INSUFFICIENT_TOKENS',
      'balance', coalesce(bal, 0),
      'required', p_tokens
    );
  end if;

  insert into public.ai_token_ledger (
    user_id, entry_type, tokens, tokens_display, status, prompt_summary,
    action_key, provider, model, api_cost_usd_micros, margin_usd_micros,
    idempotency_key, meta
  ) values (
    p_user_id, 'spend', -p_tokens, p_tokens, 'success', p_prompt_summary,
    p_action_key, p_provider, p_model,
    coalesce(p_api_cost_usd_micros, 0),
    coalesce(p_margin_usd_micros, 0),
    p_idempotency_key,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning * into ledger_row;

  update public.ai_token_balances
  set
    balance = balance - p_tokens,
    lifetime_spent = lifetime_spent + p_tokens,
    updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'ledger_id', ledger_row.id,
    'tokens', p_tokens,
    'balance_after', bal - p_tokens
  );
end;
$$;

revoke all on function public.try_debit_ai_tokens(
  uuid, integer, text, text, text, text, bigint, bigint, text, jsonb
) from public;
grant execute on function public.try_debit_ai_tokens(
  uuid, integer, text, text, text, text, bigint, bigint, text, jsonb
) to service_role;

-- ── Partial debit (hybrid additional) — never below zero ─────────────────────
-- Debits min(p_tokens, balance). Returns tokens=0 ok if balance is 0.
create or replace function public.try_debit_ai_tokens_up_to(
  p_user_id uuid,
  p_tokens integer,
  p_action_key text,
  p_prompt_summary text default null,
  p_provider text default null,
  p_model text default null,
  p_api_cost_usd_micros bigint default 0,
  p_margin_usd_micros bigint default 0,
  p_idempotency_key text default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
  debit integer;
  ledger_row public.ai_token_ledger;
  existing public.ai_token_ledger;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED');
  end if;
  if p_tokens is null or p_tokens < 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_TOKENS');
  end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.ai_token_ledger
    where idempotency_key = p_idempotency_key
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'ledger_id', existing.id,
        'tokens', existing.tokens_display,
        'balance_after', (
          select balance from public.ai_token_balances where user_id = p_user_id
        )
      );
    end if;
  end if;

  perform public.ensure_ai_token_balance(p_user_id);

  select balance into bal
  from public.ai_token_balances
  where user_id = p_user_id
  for update;

  bal := coalesce(bal, 0);
  debit := least(p_tokens, bal);

  if debit <= 0 then
    return jsonb_build_object(
      'ok', true,
      'tokens', 0,
      'balance_after', bal,
      'partial', true,
      'skipped', true
    );
  end if;

  insert into public.ai_token_ledger (
    user_id, entry_type, tokens, tokens_display, status, prompt_summary,
    action_key, provider, model, api_cost_usd_micros, margin_usd_micros,
    idempotency_key, meta
  ) values (
    p_user_id, 'spend', -debit, debit, 'success', p_prompt_summary,
    p_action_key, p_provider, p_model,
    coalesce(p_api_cost_usd_micros, 0),
    coalesce(p_margin_usd_micros, 0),
    p_idempotency_key,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning * into ledger_row;

  update public.ai_token_balances
  set
    balance = balance - debit,
    lifetime_spent = lifetime_spent + debit,
    updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'ledger_id', ledger_row.id,
    'tokens', debit,
    'balance_after', bal - debit,
    'partial', debit < p_tokens,
    'requested', p_tokens
  );
end;
$$;

revoke all on function public.try_debit_ai_tokens_up_to(
  uuid, integer, text, text, text, text, bigint, bigint, text, jsonb
) from public;
grant execute on function public.try_debit_ai_tokens_up_to(
  uuid, integer, text, text, text, text, bigint, bigint, text, jsonb
) to service_role;

-- ── User RPCs (safe fields only) ─────────────────────────────────────────────
create or replace function public.get_my_ai_token_balance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.ai_token_balances;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  row := public.ensure_ai_token_balance(uid);
  return jsonb_build_object(
    'balance', row.balance,
    'lifetime_purchased', row.lifetime_purchased,
    'lifetime_spent', row.lifetime_spent,
    'lifetime_awarded', row.lifetime_awarded,
    'updated_at', row.updated_at
  );
end;
$$;

revoke all on function public.get_my_ai_token_balance() from public;
grant execute on function public.get_my_ai_token_balance() to authenticated;

create or replace function public.get_my_ai_token_ledger(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      id,
      entry_type,
      tokens_display as tokens,
      status,
      prompt_summary,
      action_key,
      pack_id,
      created_at
    from public.ai_token_ledger
    where user_id = uid
    order by created_at desc
    limit lim
  ) x;
  return result;
end;
$$;

revoke all on function public.get_my_ai_token_ledger(integer) from public;
grant execute on function public.get_my_ai_token_ledger(integer) to authenticated;

create or replace function public.get_my_ai_token_purchases(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      id,
      pack_id,
      tokens_granted,
      amount_cents,
      currency,
      status,
      label,
      completed_at,
      created_at
    from public.ai_token_purchases
    where user_id = uid
    order by created_at desc
    limit lim
  ) x;
  return result;
end;
$$;

revoke all on function public.get_my_ai_token_purchases(integer) from public;
grant execute on function public.get_my_ai_token_purchases(integer) to authenticated;

-- Public-safe AI service availability (no cost internals)
create or replace function public.get_ai_service_availability()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.ai_platform_config;
  day_micros bigint;
  month_micros bigint;
  day_cap_micros bigint;
  month_cap_micros bigint;
  day_hit boolean := false;
  month_hit boolean := false;
  enabled boolean := true;
  reason text := null;
  message text := null;
begin
  select * into cfg from public.ai_platform_config where id = 1;
  if not found then
    cfg.services_enabled := true;
    cfg.daily_spend_cap_cents := 5000;
    cfg.monthly_spend_cap_cents := 100000;
  end if;

  day_cap_micros := greatest(coalesce(cfg.daily_spend_cap_cents, 0), 0)::bigint * 10000;
  month_cap_micros := greatest(coalesce(cfg.monthly_spend_cap_cents, 0), 0)::bigint * 10000;

  select coalesce(sum(api_cost_usd_micros), 0) into day_micros
  from public.ai_generation_log
  where created_at >= date_trunc('day', now() at time zone 'utc')
    and status = 'success';

  select coalesce(sum(api_cost_usd_micros), 0) into month_micros
  from public.ai_generation_log
  where created_at >= date_trunc('month', now() at time zone 'utc')
    and status = 'success';

  if day_cap_micros > 0 and day_micros >= day_cap_micros then
    day_hit := true;
  end if;
  if month_cap_micros > 0 and month_micros >= month_cap_micros then
    month_hit := true;
  end if;

  if not coalesce(cfg.services_enabled, true) then
    enabled := false;
    reason := 'manually_disabled';
    message := coalesce(
      nullif(trim(cfg.disabled_reason), ''),
      'AI services are temporarily unavailable. Please try again later.'
    );
  elsif day_hit or month_hit then
    enabled := false;
    reason := case when day_hit then 'daily_spend_cap' else 'monthly_spend_cap' end;
    message :=
      'AI services are temporarily unavailable due to usage limits. Please try again later.';
  else
    enabled := true;
    reason := null;
    message := null;
  end if;

  return jsonb_build_object(
    'enabled', enabled,
    'reason', reason,
    'message', message,
    'user_hourly_request_cap', coalesce(cfg.user_hourly_request_cap, 30),
    'user_daily_request_cap', coalesce(cfg.user_daily_request_cap, 100)
  );
end;
$$;

revoke all on function public.get_ai_service_availability() from public;
grant execute on function public.get_ai_service_availability() to authenticated, anon, service_role;

-- Studio spend micros (service_role / internal)
create or replace function public.get_ai_studio_spend_micros(p_period text default 'day')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  total bigint;
begin
  if p_period = 'month' then
    select coalesce(sum(api_cost_usd_micros), 0) into total
    from public.ai_generation_log
    where created_at >= date_trunc('month', now() at time zone 'utc')
      and status = 'success';
  else
    select coalesce(sum(api_cost_usd_micros), 0) into total
    from public.ai_generation_log
    where created_at >= date_trunc('day', now() at time zone 'utc')
      and status = 'success';
  end if;
  return total;
end;
$$;

revoke all on function public.get_ai_studio_spend_micros(text) from public;
grant execute on function public.get_ai_studio_spend_micros(text) to service_role;

-- ── Grants ───────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

grant select on public.ai_token_balances to authenticated, service_role;
grant select, insert, update on public.ai_token_balances to service_role;

grant select on public.ai_token_purchases to authenticated, service_role;
grant select, insert, update on public.ai_token_purchases to service_role;

-- Raw ledger: service only (users use RPC / safe view)
grant select, insert on public.ai_token_ledger to service_role;

grant select, insert, update on public.ai_generation_log to service_role;

grant select on public.ai_platform_config to authenticated, service_role;
grant select, insert, update on public.ai_platform_config to service_role;

grant select on public.ai_token_ledger_user to authenticated;

notify pgrst, 'reload schema';
