-- =============================================================================
-- Badge / achievement system
-- Prerequisites: profiles, donations, stripe_subscriptions (optional), task_claims
-- Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists pinned_badge_key text;

comment on column public.profiles.pinned_badge_key is
  'Optional badge_key from user_badges shown next to the username site-wide.';

create table if not exists public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_key text not null,
  granted_at timestamptz not null default now(),
  source text default 'sync',
  primary key (user_id, badge_key)
);

create index if not exists idx_user_badges_user
  on public.user_badges (user_id);

create index if not exists idx_profiles_pinned_badge
  on public.profiles (pinned_badge_key)
  where pinned_badge_key is not null;

alter table public.user_badges enable row level security;

drop policy if exists "Anyone can read user badges" on public.user_badges;
create policy "Anyone can read user badges"
  on public.user_badges for select
  using (true);

-- No client writes; service role + security definer RPCs only

-- ---------------------------------------------------------------------------
-- Threshold helpers (mirror src/constants/badges.js keys)
-- ---------------------------------------------------------------------------
create or replace function public.badge_donation_thresholds_cents()
returns int[]
language sql
immutable
as $$
  select array[
    1000,      -- $10
    5000,      -- $50
    10000,     -- $100
    25000,     -- $250
    50000,     -- $500
    100000,    -- $1,000
    250000,    -- $2,500
    500000,    -- $5,000
    1000000,   -- $10,000
    2500000,   -- $25,000
    5000000,   -- $50,000
    10000000   -- $100,000
  ]::int[];
$$;

create or replace function public.badge_task_thresholds()
returns int[]
language sql
immutable
as $$
  select array[1, 5, 10, 25, 50, 75, 100, 150, 200, 250]::int[];
$$;

-- ---------------------------------------------------------------------------
-- Completed donation total for a user (lifetime)
-- ---------------------------------------------------------------------------
create or replace function public.user_donation_total_cents(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(coalesce(d.amount_cents, d.amount * 100, 0)), 0)::bigint
  from public.donations d
  where d.user_id = p_user_id
    and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
    and coalesce(d.amount_cents, d.amount * 100, 0) > 0;
$$;

create or replace function public.user_has_active_subscription(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;
  if to_regclass('public.stripe_subscriptions') is null then
    return false;
  end if;
  return exists (
    select 1
    from public.stripe_subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active', 'trialing')
  );
end;
$$;

create or replace function public.user_completed_task_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return 0;
  end if;
  -- Prefer existing anti-abuse helper when present
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'user_accepted_task_count'
  ) then
    return public.user_accepted_task_count(p_user_id);
  end if;
  if to_regclass('public.task_claims') is null then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.task_claims tc
    where tc.user_id = p_user_id
      and tc.status = 'Completed'
  );
end;
$$;

-- Released / completed project detection (matches projectsService.isProjectCompleted)
create or replace function public.project_is_released(p_status text, p_completed_at timestamptz)
returns boolean
language sql
immutable
as $$
  select
    p_completed_at is not null
    or lower(trim(coalesce(p_status, ''))) in (
      'completed',
      'released',
      'shipped',
      'live',
      'done',
      'launched'
    );
$$;

/**
 * True if user has credit on any released project:
 *  - project_contributions row
 *  - completed task claim on that project
 *  - idea attributed to that project (project_id slug/id match)
 */
create or replace function public.user_has_shipped_game(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;
  if to_regclass('public.projects') is null then
    return false;
  end if;

  -- Memorial / staff contributions
  if to_regclass('public.project_contributions') is not null then
    if exists (
      select 1
      from public.project_contributions pc
      join public.projects p on p.id = pc.project_id
      where pc.user_id = p_user_id
        and public.project_is_released(p.status, p.completed_at)
    ) then
      return true;
    end if;
  end if;

  -- Accepted task work on a released project
  if to_regclass('public.task_claims') is not null
     and to_regclass('public.tasks') is not null then
    if exists (
      select 1
      from public.task_claims tc
      join public.tasks t on t.id = tc.task_id
      join public.projects p on p.id = t.project_id
      where tc.user_id = p_user_id
        and tc.status = 'Completed'
        and public.project_is_released(p.status, p.completed_at)
    ) then
      return true;
    end if;
  end if;

  -- Ideas linked to a released project (by uuid or slug in ideas.project_id)
  if to_regclass('public.ideas') is not null then
    if exists (
      select 1
      from public.ideas i
      join public.projects p
        on p.id::text = nullif(trim(i.project_id::text), '')
        or lower(p.slug) = lower(nullif(trim(i.project_id::text), ''))
      where i.user_id = p_user_id
        and public.project_is_released(p.status, p.completed_at)
        and (
          i.status is null
          or lower(coalesce(i.status, '')) not in ('draft', 'archived', 'hidden', 'rejected')
        )
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

/**
 * Grant status_game_shipper to every credited user on a released project.
 * Called from project completion trigger + safe for re-run.
 */
create or replace function public.grant_game_shipper_for_project(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  n int := 0;
  v_released boolean := false;
  v_ids uuid[] := array[]::uuid[];
  v_extra uuid[];
  v_slug text;
begin
  if p_project_id is null or to_regclass('public.projects') is null then
    return jsonb_build_object('ok', false, 'error', 'missing_project');
  end if;

  select
    public.project_is_released(p.status, p.completed_at),
    p.slug
  into v_released, v_slug
  from public.projects p
  where p.id = p_project_id;

  if not coalesce(v_released, false) then
    return jsonb_build_object('ok', true, 'skipped', 'not_released', 'users', 0);
  end if;

  if to_regclass('public.project_contributions') is not null then
    execute $q$
      select coalesce(array_agg(distinct pc.user_id), array[]::uuid[])
      from public.project_contributions pc
      where pc.project_id = $1 and pc.user_id is not null
    $q$ into v_extra using p_project_id;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.task_claims') is not null
     and to_regclass('public.tasks') is not null then
    execute $q$
      select coalesce(array_agg(distinct tc.user_id), array[]::uuid[])
      from public.task_claims tc
      join public.tasks t on t.id = tc.task_id
      where t.project_id = $1
        and tc.user_id is not null
        and tc.status = 'Completed'
    $q$ into v_extra using p_project_id;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.ideas') is not null then
    execute $q$
      select coalesce(array_agg(distinct i.user_id), array[]::uuid[])
      from public.ideas i
      where i.user_id is not null
        and (
          i.project_id::text = $1::text
          or lower(nullif(trim(i.project_id::text), '')) = lower(nullif(trim($2), ''))
        )
        and (
          i.status is null
          or lower(coalesce(i.status, '')) not in ('draft', 'archived', 'hidden', 'rejected')
        )
    $q$ into v_extra using p_project_id, coalesce(v_slug, '');
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  select coalesce(array_agg(distinct u), array[]::uuid[])
  into v_ids
  from unnest(v_ids) as u
  where u is not null;

  foreach v_uid in array v_ids
  loop
    insert into public.user_badges (user_id, badge_key, source)
    values (v_uid, 'status_game_shipper', 'project_release')
    on conflict (user_id, badge_key) do nothing;
    perform public.sync_user_badges(v_uid);
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'project_id', p_project_id, 'users', n);
end;
$$;

grant execute on function public.grant_game_shipper_for_project(uuid) to service_role;
grant execute on function public.grant_game_shipper_for_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_user_badges — idempotent recompute
-- ---------------------------------------------------------------------------
create or replace function public.sync_user_badges(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint := 0;
  v_tasks int := 0;
  v_has_sub boolean := false;
  v_has_donor boolean := false;
  v_has_ship boolean := false;
  v_thr int;
  v_key text;
  v_want text[] := array[]::text[];
  v_granted text[] := array[]::text[];
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;

  v_total := public.user_donation_total_cents(p_user_id);
  v_tasks := public.user_completed_task_count(p_user_id);
  v_has_sub := public.user_has_active_subscription(p_user_id);
  v_has_donor := v_total > 0;
  v_has_ship := public.user_has_shipped_game(p_user_id);

  if v_has_donor then
    v_want := array_append(v_want, 'status_donor');
  end if;

  if v_has_sub then
    v_want := array_append(v_want, 'status_active_subscriber');
  end if;

  if v_has_ship then
    v_want := array_append(v_want, 'status_game_shipper');
  end if;

  foreach v_thr in array public.badge_donation_thresholds_cents()
  loop
    if v_total >= v_thr then
      -- key: donation_<dollars> e.g. donation_10, donation_1000
      v_key := 'donation_' || (v_thr / 100)::text;
      v_want := array_append(v_want, v_key);
    end if;
  end loop;

  foreach v_thr in array public.badge_task_thresholds()
  loop
    if v_tasks >= v_thr then
      v_want := array_append(v_want, 'tasks_' || v_thr::text);
    end if;
  end loop;

  -- Grant missing
  if cardinality(v_want) > 0 then
    insert into public.user_badges (user_id, badge_key, source)
    select p_user_id, unnest(v_want), 'sync'
    on conflict (user_id, badge_key) do nothing;
  end if;

  -- Revoke Active Subscriber only when no longer eligible
  if not v_has_sub then
    delete from public.user_badges
    where user_id = p_user_id
      and badge_key = 'status_active_subscriber';
  end if;

  -- Clear invalid pin
  update public.profiles p
  set pinned_badge_key = null
  where p.id = p_user_id
    and p.pinned_badge_key is not null
    and not exists (
      select 1 from public.user_badges ub
      where ub.user_id = p_user_id
        and ub.badge_key = p.pinned_badge_key
    );

  select coalesce(array_agg(ub.badge_key order by ub.badge_key), array[]::text[])
  into v_granted
  from public.user_badges ub
  where ub.user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'granted', to_jsonb(v_granted),
    'total_cents', v_total,
    'tasks_completed', v_tasks,
    'has_active_sub', v_has_sub,
    'has_donor', v_has_donor,
    'has_shipped_game', v_has_ship
  );
end;
$$;

revoke all on function public.sync_user_badges(uuid) from public;
grant execute on function public.sync_user_badges(uuid) to authenticated;
grant execute on function public.sync_user_badges(uuid) to service_role;

-- Allow self-sync or service role
create or replace function public.sync_my_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  return public.sync_user_badges(auth.uid());
end;
$$;

grant execute on function public.sync_my_badges() to authenticated;

-- ---------------------------------------------------------------------------
-- Public read
-- ---------------------------------------------------------------------------
create or replace function public.get_public_user_badges(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pinned text;
  v_badges jsonb;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'badges', '[]'::jsonb,
      'pinned_badge_key', null
    );
  end if;

  select p.pinned_badge_key into v_pinned
  from public.profiles p
  where p.id = p_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', ub.badge_key,
        'granted_at', ub.granted_at
      )
      order by ub.granted_at asc
    ),
    '[]'::jsonb
  )
  into v_badges
  from public.user_badges ub
  where ub.user_id = p_user_id;

  return jsonb_build_object(
    'badges', v_badges,
    'pinned_badge_key', v_pinned
  );
end;
$$;

grant execute on function public.get_public_user_badges(uuid) to anon;
grant execute on function public.get_public_user_badges(uuid) to authenticated;
grant execute on function public.get_public_user_badges(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Pin (owner only)
-- ---------------------------------------------------------------------------
create or replace function public.set_my_pinned_badge(p_badge_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key text := nullif(trim(p_badge_key), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_key is null then
    update public.profiles
    set pinned_badge_key = null
    where id = v_uid;
    return jsonb_build_object('ok', true, 'pinned_badge_key', null);
  end if;

  if not exists (
    select 1 from public.user_badges ub
    where ub.user_id = v_uid and ub.badge_key = v_key
  ) then
    return jsonb_build_object('ok', false, 'error', 'badge_not_owned');
  end if;

  update public.profiles
  set pinned_badge_key = v_key
  where id = v_uid;

  return jsonb_build_object('ok', true, 'pinned_badge_key', v_key);
end;
$$;

grant execute on function public.set_my_pinned_badge(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill (run once after deploy as service role / SQL editor)
-- ---------------------------------------------------------------------------
create or replace function public.backfill_all_user_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  n int := 0;
  v_ids uuid[] := array[]::uuid[];
  v_extra uuid[];
begin
  select coalesce(array_agg(distinct d.user_id), array[]::uuid[])
  into v_ids
  from public.donations d
  where d.user_id is not null;

  if to_regclass('public.stripe_subscriptions') is not null then
    execute $q$
      select coalesce(array_agg(distinct s.user_id), array[]::uuid[])
      from public.stripe_subscriptions s
      where s.user_id is not null
    $q$ into v_extra;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.task_claims') is not null then
    execute $q$
      select coalesce(array_agg(distinct t.user_id), array[]::uuid[])
      from public.task_claims t
      where t.user_id is not null and t.status = 'Completed'
    $q$ into v_extra;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  select coalesce(array_agg(distinct u), array[]::uuid[])
  into v_ids
  from unnest(v_ids) as u
  where u is not null;

  foreach v_uid in array v_ids
  loop
    perform public.sync_user_badges(v_uid);
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'users_synced', n);
end;
$$;

grant execute on function public.backfill_all_user_badges() to service_role;

-- ---------------------------------------------------------------------------
-- Task completion trigger
-- ---------------------------------------------------------------------------
create or replace function public.trg_sync_badges_on_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.user_id is not null and NEW.status = 'Completed' then
      perform public.sync_user_badges(NEW.user_id);
    end if;
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if NEW.user_id is not null
       and (
         NEW.status = 'Completed'
         or (OLD.status = 'Completed' and NEW.status is distinct from OLD.status)
       )
    then
      perform public.sync_user_badges(NEW.user_id);
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_badges_on_claim on public.task_claims;
do $$
begin
  if to_regclass('public.task_claims') is not null then
    create trigger trg_sync_badges_on_claim
      after insert or update of status on public.task_claims
      for each row
      execute function public.trg_sync_badges_on_claim();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Donation insert/update trigger (webhook also calls sync)
-- ---------------------------------------------------------------------------
create or replace function public.trg_sync_badges_on_donation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.user_id is not null then
    perform public.sync_user_badges(NEW.user_id);
  end if;
  if TG_OP = 'UPDATE' and OLD.user_id is not null and OLD.user_id is distinct from NEW.user_id then
    perform public.sync_user_badges(OLD.user_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_badges_on_donation on public.donations;
do $$
begin
  if to_regclass('public.donations') is not null then
    create trigger trg_sync_badges_on_donation
      after insert or update of status, amount_cents, amount, user_id
      on public.donations
      for each row
      execute function public.trg_sync_badges_on_donation();
  end if;
end $$;

-- Subscription status changes
create or replace function public.trg_sync_badges_on_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.user_id is not null then
    perform public.sync_user_badges(NEW.user_id);
  end if;
  if TG_OP = 'UPDATE' and OLD.user_id is not null and OLD.user_id is distinct from NEW.user_id then
    perform public.sync_user_badges(OLD.user_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_badges_on_subscription on public.stripe_subscriptions;
do $$
begin
  if to_regclass('public.stripe_subscriptions') is not null then
    create trigger trg_sync_badges_on_subscription
      after insert or update of status, user_id
      on public.stripe_subscriptions
      for each row
      execute function public.trg_sync_badges_on_subscription();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Project release → Game Shipper for all credited contributors
-- ---------------------------------------------------------------------------
create or replace function public.trg_grant_game_shipper_on_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_released boolean;
  v_was_released boolean;
begin
  v_now_released := public.project_is_released(NEW.status, NEW.completed_at);
  if TG_OP = 'INSERT' then
    if v_now_released then
      perform public.grant_game_shipper_for_project(NEW.id);
    end if;
    return NEW;
  end if;

  v_was_released := public.project_is_released(OLD.status, OLD.completed_at);
  -- Newly released (or re-completed after edit)
  if v_now_released and (
    not v_was_released
    or NEW.status is distinct from OLD.status
    or NEW.completed_at is distinct from OLD.completed_at
  ) then
    perform public.grant_game_shipper_for_project(NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_grant_game_shipper_on_project on public.projects;
do $$
begin
  if to_regclass('public.projects') is not null then
    create trigger trg_grant_game_shipper_on_project
      after insert or update of status, completed_at
      on public.projects
      for each row
      execute function public.trg_grant_game_shipper_on_project();
  end if;
end $$;
