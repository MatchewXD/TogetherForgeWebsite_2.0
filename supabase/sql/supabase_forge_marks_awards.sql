-- =============================================================================
-- Community Awards placement (Spark / Hammer / Anvil / Masterwork)
-- Run after supabase_forge_marks.sql. Safe to re-run.
-- =============================================================================

do $$
begin
  if to_regclass('public.forge_award_tiers') is null then
    raise exception
      'forge_award_tiers missing. Run supabase/sql/supabase_forge_marks.sql first.';
  end if;
end $$;

alter table public.forge_award_tiers
  add column if not exists allows_message boolean not null default false;

insert into public.forge_award_tiers (
  id, name, description, marks_cost, sort_order, allows_message
)
values
  ('spark', 'Spark', 'A small public thank-you on a post.', 100, 10, false),
  ('hammer', 'Hammer', 'A solid community award.', 200, 20, false),
  (
    'anvil',
    'Anvil',
    'A standout award. Optional short message.',
    500,
    30,
    true
  ),
  (
    'masterwork',
    'Masterwork',
    'The highest community award. Optional short message.',
    1000,
    40,
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  marks_cost = excluded.marks_cost,
  sort_order = excluded.sort_order,
  allows_message = excluded.allows_message;

-- Drop unused placeholder tiers from the foundation seed
delete from public.forge_award_tiers t
where t.id in ('cheer', 'highlight', 'spotlight')
  and not exists (
    select 1 from public.forge_awards a where a.award_tier = t.id
  );

-- One Spark/Hammer/Anvil/Masterwork per giver per post (simplest anti-repeat rule)
create unique index if not exists idx_forge_awards_giver_tier_target
  on public.forge_awards (giver_id, award_tier, target_type, target_id)
  where target_id is not null;

alter table public.forge_awards
  drop constraint if exists forge_awards_message_len;
alter table public.forge_awards
  add constraint forge_awards_message_len check (
    message is null or char_length(message) <= 140
  );

-- Replace foundation giver-supplied receiver RPC
drop function if exists public.give_forge_award(
  uuid, text, text, text, text, text
);

-- Resolve receiver from the post; spend Marks; write award + totals.
create or replace function public.place_forge_award(
  p_tier_id text,
  p_target_type text,
  p_target_id text,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  giver uuid := auth.uid();
  tier public.forge_award_tiers;
  receiver uuid;
  target_url text;
  msg text;
  ttype text;
  tid text;
  idea_status text;
  award_row public.forge_awards;
  bal integer;
begin
  if giver is null then
    raise exception 'Sign in to place a Community Award';
  end if;

  ttype := lower(trim(coalesce(p_target_type, '')));
  tid := nullif(trim(coalesce(p_target_id, '')), '');
  if ttype not in ('showcase', 'idea') then
    raise exception 'Awards can only be placed on Showcase posts or ideas';
  end if;
  if tid is null then
    raise exception 'Post is required';
  end if;

  select * into tier
  from public.forge_award_tiers
  where id = lower(trim(coalesce(p_tier_id, '')));
  if not found then
    raise exception 'Unknown award';
  end if;

  msg := nullif(trim(coalesce(p_message, '')), '');
  if msg is not null and not coalesce(tier.allows_message, false) then
    raise exception 'This award does not include a message';
  end if;
  if msg is not null and char_length(msg) > 140 then
    raise exception 'Message must be 140 characters or fewer';
  end if;

  if ttype = 'showcase' then
    if to_regclass('public.community_showcase_posts') is null then
      raise exception 'Showcase is not available';
    end if;
    select creator_user_id
      into receiver
    from public.community_showcase_posts
    where id::text = tid
      and status = 'approved'
    limit 1;
    if receiver is null then
      raise exception 'This Showcase post cannot receive awards';
    end if;
    target_url := '/showcase#showcase-' || tid;
  else
    if to_regclass('public.ideas') is null then
      raise exception 'Ideas are not available';
    end if;
    select user_id, status
      into receiver, idea_status
    from public.ideas
    where id::text = tid
    limit 1;
    if receiver is null then
      raise exception 'This idea cannot receive awards';
    end if;
    if lower(trim(coalesce(idea_status, ''))) = 'draft' then
      raise exception 'Draft ideas cannot receive awards';
    end if;
    target_url := '/ideas/' || tid;
  end if;

  if giver = receiver then
    raise exception 'You cannot award your own post';
  end if;

  if not exists (select 1 from public.profiles p where p.id = giver) then
    raise exception 'Set a username on your profile before placing awards';
  end if;
  if not exists (select 1 from public.profiles p where p.id = receiver) then
    raise exception 'This post has no public profile to credit';
  end if;

  if exists (
    select 1
    from public.forge_awards
    where giver_id = giver
      and award_tier = tier.id
      and target_type = ttype
      and target_id = tid
  ) then
    raise exception 'You already placed a % on this post', tier.name;
  end if;

  perform public.ensure_forge_mark_balance(giver);

  select balance into bal
  from public.forge_mark_balances
  where user_id = giver
  for update;

  if coalesce(bal, 0) < tier.marks_cost then
    raise exception 'Not enough Forge Marks';
  end if;

  insert into public.forge_awards (
    giver_id,
    receiver_id,
    award_tier,
    award_name,
    marks_spent,
    target_type,
    target_id,
    target_url,
    message
  ) values (
    giver,
    receiver,
    tier.id,
    tier.name,
    tier.marks_cost,
    ttype,
    tid,
    target_url,
    msg
  )
  returning * into award_row;

  insert into public.forge_mark_ledger (
    user_id,
    entry_type,
    marks,
    marks_display,
    award_id,
    idempotency_key,
    note
  ) values (
    giver,
    'award_spend',
    -tier.marks_cost,
    tier.marks_cost,
    award_row.id,
    'award-spend:' || award_row.id::text,
    'Community Award: ' || tier.name
  );

  update public.forge_mark_balances
  set
    balance = balance - tier.marks_cost,
    lifetime_spent = lifetime_spent + tier.marks_cost,
    updated_at = now()
  where user_id = giver
    and balance >= tier.marks_cost;

  if not found then
    raise exception 'Not enough Forge Marks';
  end if;

  insert into public.forge_award_totals (
    user_id, award_tier, award_name, award_count, marks_received, updated_at
  ) values (
    receiver, tier.id, tier.name, 1, tier.marks_cost, now()
  )
  on conflict (user_id, award_tier) do update
  set
    award_name = excluded.award_name,
    award_count = public.forge_award_totals.award_count + 1,
    marks_received = public.forge_award_totals.marks_received
      + excluded.marks_received,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'award_id', award_row.id,
    'marks_spent', tier.marks_cost,
    'tier', tier.id,
    'tier_name', tier.name,
    'receiver_id', receiver,
    'target_type', ttype,
    'target_id', tid,
    'target_url', target_url,
    'message', msg,
    'created_at', award_row.created_at
  );
end;
$$;

revoke all on function public.place_forge_award(text, text, text, text) from public;
grant execute on function public.place_forge_award(text, text, text, text)
  to authenticated;

create or replace function public.list_forge_awards_for_targets(
  p_target_type text,
  p_target_ids text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ttype text := lower(trim(coalesce(p_target_type, '')));
  result jsonb;
begin
  if ttype not in ('showcase', 'idea') then
    return '[]'::jsonb;
  end if;
  if p_target_ids is null or cardinality(p_target_ids) = 0 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc), '[]'::jsonb)
  into result
  from (
    select
      a.id,
      a.giver_id,
      a.receiver_id,
      a.award_tier,
      a.award_name,
      a.marks_spent,
      a.target_type,
      a.target_id,
      a.target_url,
      a.message,
      a.created_at,
      p.username as giver_username,
      p.avatar_url as giver_avatar_url,
      p.pinned_badge_key as giver_pinned_badge_key
    from public.forge_awards a
    left join public.profiles p on p.id = a.giver_id
    where a.target_type = ttype
      and a.target_id = any (p_target_ids)
    order by a.created_at asc
    limit 500
  ) x;

  return result;
end;
$$;

revoke all on function public.list_forge_awards_for_targets(text, text[])
  from public;
grant execute on function public.list_forge_awards_for_targets(text, text[])
  to anon, authenticated;

-- Include giver username on public profile achievement list
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
      a.id,
      a.award_tier,
      a.award_name,
      a.marks_spent,
      a.target_type,
      a.target_id,
      a.target_url,
      a.message,
      a.created_at,
      p.username as giver_username
    from public.forge_awards a
    left join public.profiles p on p.id = a.giver_id
    where a.receiver_id = p_user_id
    order by a.created_at desc
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

notify pgrst, 'reload schema';
