-- =============================================================================
-- Forge Marks + Community Awards (foundation)
-- Safe to re-run.
--
-- Marks are granted only from completed donations (signed-in user_id).
-- Rate is published and whole-gift (not marginal):
--   $1–24   → 100 Marks per $1
--   $25–49  → 110
--   $50–99  → 120
--   $100–249 → 130
--   $250–499 → 140
--   $500+   → 150
-- Marks never expire, cannot be withdrawn as cash, and cannot be transferred.
-- Giving an award spends Marks; the receiver gets an achievement, not Marks.
-- =============================================================================

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception
      'profiles table missing. Run supabase/sql/supabase_schema.sql first.';
  end if;
  if to_regclass('public.donations') is null then
    raise exception
      'donations table missing. Run supabase/sql/supabase_donations_stripe.sql first.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Balances
-- ---------------------------------------------------------------------------
create table if not exists public.forge_mark_balances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.forge_mark_balances is
  'Per-user Forge Marks. Earned from completed donations; spent on Community Awards. Never cash, never transferred.';

-- ---------------------------------------------------------------------------
-- Award catalog (working set; costs can be tuned before public launch)
-- ---------------------------------------------------------------------------
create table if not exists public.forge_award_tiers (
  id text primary key,
  name text not null,
  description text not null default '',
  marks_cost integer not null check (marks_cost > 0),
  sort_order integer not null default 0
);

insert into public.forge_award_tiers (id, name, description, marks_cost, sort_order)
values
  ('spark', 'Spark', 'A small public thank-you on a post.', 100, 10),
  ('hammer', 'Hammer', 'A solid community award.', 200, 20),
  ('anvil', 'Anvil', 'A standout award. Optional short message.', 500, 30),
  (
    'masterwork',
    'Masterwork',
    'The highest community award. Optional short message.',
    1000,
    40
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  marks_cost = excluded.marks_cost,
  sort_order = excluded.sort_order;

comment on table public.forge_award_tiers is
  'Published Community Award types and Mark costs. Snapshot onto forge_awards at grant time.';

-- ---------------------------------------------------------------------------
-- Award ledger (giver → receiver on a post/item)
-- ---------------------------------------------------------------------------
create table if not exists public.forge_awards (
  id uuid primary key default gen_random_uuid(),
  giver_id uuid not null references public.profiles (id) on delete restrict,
  receiver_id uuid not null references public.profiles (id) on delete restrict,
  award_tier text not null references public.forge_award_tiers (id),
  award_name text not null,
  marks_spent integer not null check (marks_spent > 0),
  target_type text not null default 'other',
  target_id text,
  target_url text,
  message text,
  created_at timestamptz not null default now(),
  constraint forge_awards_not_self check (giver_id <> receiver_id),
  constraint forge_awards_target_type_chk check (
    target_type in ('showcase', 'idea', 'official_media', 'comment', 'other')
  ),
  constraint forge_awards_message_len check (
    message is null or char_length(message) <= 280
  )
);

create index if not exists idx_forge_awards_receiver_created
  on public.forge_awards (receiver_id, created_at desc);

create index if not exists idx_forge_awards_giver_created
  on public.forge_awards (giver_id, created_at desc);

create index if not exists idx_forge_awards_target
  on public.forge_awards (target_type, target_id)
  where target_id is not null;

comment on table public.forge_awards is
  'Community Awards given with Forge Marks. Receiver gets a public achievement, not Marks.';

-- ---------------------------------------------------------------------------
-- Running totals by receiver + tier (profile achievements)
-- ---------------------------------------------------------------------------
create table if not exists public.forge_award_totals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  award_tier text not null references public.forge_award_tiers (id),
  award_name text not null,
  award_count integer not null default 0 check (award_count >= 0),
  marks_received integer not null default 0 check (marks_received >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, award_tier)
);

comment on table public.forge_award_totals is
  'Denormalized running totals of awards a user has received, by tier.';

-- ---------------------------------------------------------------------------
-- Marks movement ledger (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.forge_mark_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_type text not null,
  -- Signed delta: +credit / −debit
  marks integer not null,
  marks_display integer not null check (marks_display >= 0),
  donation_id bigint,
  award_id uuid references public.forge_awards (id) on delete set null,
  idempotency_key text,
  note text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint forge_mark_ledger_type_chk check (
    entry_type in (
      'donation_grant',
      'award_spend',
      'refund_clawback',
      'adjustment'
    )
  )
);

do $$
begin
  if to_regclass('public.donations') is not null then
    begin
      alter table public.forge_mark_ledger
        add constraint forge_mark_ledger_donation_fkey
        foreign key (donation_id) references public.donations (id)
        on delete set null;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

create unique index if not exists idx_forge_mark_ledger_idempotency
  on public.forge_mark_ledger (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_forge_mark_ledger_donation_grant
  on public.forge_mark_ledger (donation_id)
  where entry_type = 'donation_grant' and donation_id is not null;

create unique index if not exists idx_forge_mark_ledger_donation_clawback
  on public.forge_mark_ledger (donation_id)
  where entry_type = 'refund_clawback' and donation_id is not null;

create index if not exists idx_forge_mark_ledger_user_created
  on public.forge_mark_ledger (user_id, created_at desc);

comment on table public.forge_mark_ledger is
  'Immutable Forge Marks movements. Donation grants are idempotent per donation_id.';

create or replace function public.forge_mark_ledger_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forge_mark_ledger is append-only';
end;
$$;

drop trigger if exists trg_forge_mark_ledger_no_update on public.forge_mark_ledger;
create trigger trg_forge_mark_ledger_no_update
  before update or delete on public.forge_mark_ledger
  for each row execute function public.forge_mark_ledger_immutable();

-- ---------------------------------------------------------------------------
-- Rate + grant helpers
-- ---------------------------------------------------------------------------
create or replace function public.forge_marks_for_amount_cents(p_amount_cents integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_amount_cents, 0) <= 0 then 0
    when p_amount_cents >= 50000 then ((p_amount_cents::bigint * 150) / 100)::integer
    when p_amount_cents >= 25000 then ((p_amount_cents::bigint * 140) / 100)::integer
    when p_amount_cents >= 10000 then ((p_amount_cents::bigint * 130) / 100)::integer
    when p_amount_cents >= 5000 then ((p_amount_cents::bigint * 120) / 100)::integer
    when p_amount_cents >= 2500 then ((p_amount_cents::bigint * 110) / 100)::integer
    else ((p_amount_cents::bigint * 100) / 100)::integer
  end;
$$;

comment on function public.forge_marks_for_amount_cents(integer) is
  'Whole-gift Marks for a donation in cents. Integer division matches floor.';

create or replace function public.ensure_forge_mark_balance(p_user_id uuid)
returns public.forge_mark_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.forge_mark_balances;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;
  insert into public.forge_mark_balances (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
  select * into row from public.forge_mark_balances where user_id = p_user_id;
  return row;
end;
$$;

revoke all on function public.ensure_forge_mark_balance(uuid) from public;
grant execute on function public.ensure_forge_mark_balance(uuid) to service_role;

create or replace function public.grant_forge_marks_from_donation(p_donation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  cents integer;
  marks integer;
  existing uuid;
  ledger_id uuid;
begin
  if p_donation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_donation');
  end if;

  select
    id,
    user_id,
    coalesce(amount_cents, case when amount is not null then amount * 100 end, 0) as cents,
    coalesce(status, 'completed') as status
  into d
  from public.donations
  where id = p_donation_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'donation_not_found');
  end if;

  if d.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  if lower(trim(d.status)) not in ('completed', 'paid', 'succeeded') then
    return jsonb_build_object('ok', false, 'reason', 'not_completed', 'status', d.status);
  end if;

  cents := greatest(coalesce(d.cents, 0), 0);
  marks := public.forge_marks_for_amount_cents(cents);
  if marks <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'zero_marks', 'cents', cents);
  end if;

  select id into existing
  from public.forge_mark_ledger
  where donation_id = p_donation_id
    and entry_type = 'donation_grant'
  limit 1;
  if existing is not null then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'ledger_id', existing,
      'marks', marks
    );
  end if;

  perform public.ensure_forge_mark_balance(d.user_id);

  insert into public.forge_mark_ledger (
    user_id,
    entry_type,
    marks,
    marks_display,
    donation_id,
    idempotency_key,
    note,
    meta
  ) values (
    d.user_id,
    'donation_grant',
    marks,
    marks,
    p_donation_id,
    'donation-grant:' || p_donation_id::text,
    'Completed donation',
    jsonb_build_object(
      'amount_cents', cents,
      'marks_per_dollar', case
        when cents >= 50000 then 150
        when cents >= 25000 then 140
        when cents >= 10000 then 130
        when cents >= 5000 then 120
        when cents >= 2500 then 110
        else 100
      end
    )
  )
  returning id into ledger_id;

  update public.forge_mark_balances
  set
    balance = balance + marks,
    lifetime_earned = lifetime_earned + marks,
    updated_at = now()
  where user_id = d.user_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'ledger_id', ledger_id,
    'marks', marks,
    'user_id', d.user_id
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true, 'marks', marks);
end;
$$;

revoke all on function public.grant_forge_marks_from_donation(bigint) from public;
grant execute on function public.grant_forge_marks_from_donation(bigint)
  to service_role;

create or replace function public.clawback_forge_marks_for_donation(p_donation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_row public.forge_mark_ledger;
  bal integer;
  take integer;
  ledger_id uuid;
begin
  if p_donation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_donation');
  end if;

  select * into grant_row
  from public.forge_mark_ledger
  where donation_id = p_donation_id
    and entry_type = 'donation_grant'
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'reason', 'no_grant');
  end if;

  if exists (
    select 1 from public.forge_mark_ledger
    where donation_id = p_donation_id
      and entry_type = 'refund_clawback'
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  perform public.ensure_forge_mark_balance(grant_row.user_id);
  select balance into bal
  from public.forge_mark_balances
  where user_id = grant_row.user_id
  for update;

  take := least(greatest(grant_row.marks_display, 0), greatest(bal, 0));
  if take <= 0 then
    return jsonb_build_object('ok', true, 'clawed', 0, 'reason', 'nothing_to_claw');
  end if;

  insert into public.forge_mark_ledger (
    user_id,
    entry_type,
    marks,
    marks_display,
    donation_id,
    idempotency_key,
    note
  ) values (
    grant_row.user_id,
    'refund_clawback',
    -take,
    take,
    p_donation_id,
    'donation-clawback:' || p_donation_id::text,
    'Refund / failed donation'
  )
  returning id into ledger_id;

  update public.forge_mark_balances
  set
    balance = balance - take,
    updated_at = now()
  where user_id = grant_row.user_id
    and balance >= take;

  return jsonb_build_object('ok', true, 'clawed', take, 'ledger_id', ledger_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

revoke all on function public.clawback_forge_marks_for_donation(bigint) from public;
grant execute on function public.clawback_forge_marks_for_donation(bigint)
  to service_role;

-- Trigger: completed donation → grant; refunded/failed → claw back remaining
create or replace function public.trg_donation_forge_marks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
begin
  st := lower(trim(coalesce(new.status, 'completed')));
  if new.user_id is not null
     and st in ('completed', 'paid', 'succeeded') then
    perform public.grant_forge_marks_from_donation(new.id);
  elsif st in ('refunded', 'failed', 'canceled', 'cancelled') then
    perform public.clawback_forge_marks_for_donation(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_donation_forge_marks on public.donations;
create trigger trg_donation_forge_marks
  after insert or update of status, user_id, amount_cents, amount
  on public.donations
  for each row
  execute function public.trg_donation_forge_marks();

-- Placement RPC lives in supabase_forge_marks_awards.sql (place_forge_award).
-- Drop the old giver-supplied-receiver function so re-running this file
-- cannot resurrect it (it skipped unique/target/message rules).
drop function if exists public.give_forge_award(
  uuid, text, text, text, text, text
);

-- ---------------------------------------------------------------------------
-- Read RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_my_forge_marks()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.forge_mark_balances;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  row := public.ensure_forge_mark_balance(uid);
  return jsonb_build_object(
    'balance', row.balance,
    'lifetime_earned', row.lifetime_earned,
    'lifetime_spent', row.lifetime_spent,
    'updated_at', row.updated_at
  );
end;
$$;

revoke all on function public.get_my_forge_marks() from public;
grant execute on function public.get_my_forge_marks() to authenticated;

create or replace function public.get_my_forge_mark_ledger(p_limit integer default 50)
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
      marks_display as marks,
      marks as marks_delta,
      donation_id,
      award_id,
      note,
      created_at
    from public.forge_mark_ledger
    where user_id = uid
    order by created_at desc
    limit lim
  ) x;
  return result;
end;
$$;

revoke all on function public.get_my_forge_mark_ledger(integer) from public;
grant execute on function public.get_my_forge_mark_ledger(integer) to authenticated;

create or replace function public.get_public_forge_marks_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  bal public.forge_mark_balances;
  awards jsonb;
  totals jsonb;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'balance', 0,
      'lifetime_earned', 0,
      'lifetime_spent', 0,
      'awards', '[]'::jsonb,
      'totals_by_tier', '[]'::jsonb
    );
  end if;

  select * into bal from public.forge_mark_balances where user_id = p_user_id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into awards
  from (
    select
      id,
      award_tier,
      award_name,
      marks_spent,
      target_type,
      target_id,
      target_url,
      message,
      created_at
    from public.forge_awards
    where receiver_id = p_user_id
    order by created_at desc
  ) x;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'award_tier', t.award_tier,
        'award_name', t.award_name,
        'award_count', t.award_count,
        'marks_received', t.marks_received
      )
      order by t.sort_order, t.award_name
    ),
    '[]'::jsonb
  )
  into totals
  from (
    select
      tot.award_tier,
      tot.award_name,
      tot.award_count,
      tot.marks_received,
      coalesce(tier.sort_order, 999) as sort_order
    from public.forge_award_totals tot
    left join public.forge_award_tiers tier on tier.id = tot.award_tier
    where tot.user_id = p_user_id
  ) t;

  return jsonb_build_object(
    'balance', coalesce(bal.balance, 0),
    'lifetime_earned', coalesce(bal.lifetime_earned, 0),
    'lifetime_spent', coalesce(bal.lifetime_spent, 0),
    'awards', awards,
    'totals_by_tier', totals
  );
end;
$$;

revoke all on function public.get_public_forge_marks_profile(uuid) from public;
grant execute on function public.get_public_forge_marks_profile(uuid)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.forge_mark_balances enable row level security;
alter table public.forge_mark_ledger enable row level security;
alter table public.forge_award_tiers enable row level security;
alter table public.forge_awards enable row level security;
alter table public.forge_award_totals enable row level security;

drop policy if exists "Users can read own forge mark balance" on public.forge_mark_balances;
create policy "Users can read own forge mark balance"
  on public.forge_mark_balances for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own forge mark ledger" on public.forge_mark_ledger;
create policy "Users can read own forge mark ledger"
  on public.forge_mark_ledger for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Public can read forge award tiers" on public.forge_award_tiers;
create policy "Public can read forge award tiers"
  on public.forge_award_tiers for select
  using (true);

drop policy if exists "Public can read forge awards" on public.forge_awards;
create policy "Public can read forge awards"
  on public.forge_awards for select
  using (true);

drop policy if exists "Public can read forge award totals" on public.forge_award_totals;
create policy "Public can read forge award totals"
  on public.forge_award_totals for select
  using (true);

grant select on table public.forge_mark_balances to authenticated, service_role;
grant select on table public.forge_mark_ledger to authenticated, service_role;
grant select on table public.forge_award_tiers to anon, authenticated, service_role;
grant select on table public.forge_awards to anon, authenticated, service_role;
grant select on table public.forge_award_totals to anon, authenticated, service_role;

grant insert, update, delete on table public.forge_mark_balances to service_role;
grant insert, update, delete on table public.forge_mark_ledger to service_role;
grant insert, update, delete on table public.forge_awards to service_role;
grant insert, update, delete on table public.forge_award_totals to service_role;

-- ---------------------------------------------------------------------------
-- Backfill completed donations that already exist
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select id
    from public.donations
    where user_id is not null
      and lower(trim(coalesce(status, 'completed'))) in (
        'completed', 'paid', 'succeeded'
      )
  loop
    perform public.grant_forge_marks_from_donation(r.id);
  end loop;
end $$;

notify pgrst, 'reload schema';
