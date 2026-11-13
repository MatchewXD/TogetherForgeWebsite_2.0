-- ============================================================================
-- Profiles hardening
-- ============================================================================
-- Fixes four problems with public.profiles:
--
--   1. Privacy. The "Public can read usernames" policy exposes every column to
--      anyone holding the anon key, including email and moderation_note.
--        -> profiles.email is no longer stored (auth.users is the source of
--           truth) and moderation_note moves to a staff-only table.
--   2. Self-service privilege. "Users can update own profile" let a user set
--      their own task_limit_bypass / moderation_status.
--        -> signed-in clients can no longer change those columns unless staff.
--   3. Signup escalation. The role guard only covered UPDATE, so a new user
--      could INSERT their own profile row with role = 'founder'.
--        -> client inserts always get role 'user' and default flags.
--   4. Staff credit hijack. Pending staff credits were matched against the
--      client-writable profiles.email.
--        -> matching now uses the confirmed email in auth.users only.
--
-- Existing writers keep working unchanged: the client may still send
-- profiles.email or moderation_note, and the conduct RPCs may still write
-- moderation_note. Triggers reroute or discard the values.
--
-- Safe to re-run. Run on STAGING first, then production.
-- Requires: supabase_schema.sql, supabase_moderation.sql,
--           supabase_role_management.sql. Staff credit functions are replaced
--           only where supabase_staff_credit.sql has been applied.
-- ============================================================================

-- Columns this script guards (no-ops where they already exist)
alter table public.profiles
  add column if not exists task_limit_bypass boolean not null default false;
alter table public.profiles
  add column if not exists moderation_status text default 'active';
alter table public.profiles
  add column if not exists moderation_note text;

-- ---------------------------------------------------------------------------
-- 1. Staff-only private profile data
-- ---------------------------------------------------------------------------
create table if not exists public.profile_private (
  user_id uuid primary key references auth.users (id) on delete cascade,
  moderation_note text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.profile_private is
  'Staff-only profile data that must never be publicly readable. Written by the trg_profiles_20_private trigger; read through staff_profile_private().';

alter table public.profile_private enable row level security;
-- No policies on purpose: only SECURITY DEFINER functions and service_role.
revoke all on table public.profile_private from anon, authenticated;
grant all on table public.profile_private to service_role;

-- ---------------------------------------------------------------------------
-- 2. Guard privileged columns against direct client writes
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user is 'authenticated' / 'anon' for a
-- direct PostgREST write, but the function owner inside SECURITY DEFINER RPCs
-- (set_user_role, conduct review, ...) and 'postgres' / 'service_role' for
-- the SQL editor and Edge Functions. Only direct client writes are restricted.
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'user';
    new.task_limit_bypass := false;
    new.moderation_status := 'active';
    new.moderation_note := null;
    return new;
  end if;

  -- UPDATE: staff may moderate through the dashboard; nobody else may touch
  -- these columns. Values are reverted silently so normal profile saves that
  -- echo the whole row back keep working.
  if not public.is_staff() then
    new.task_limit_bypass := old.task_limit_bypass;
    new.moderation_status := old.moderation_status;
    new.moderation_note := old.moderation_note;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_10_guard on public.profiles;
create trigger trg_profiles_10_guard
  before insert or update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();

-- ---------------------------------------------------------------------------
-- 3. Keep private values out of the publicly readable row
-- ---------------------------------------------------------------------------
-- Runs after the guard (triggers fire in name order). SECURITY DEFINER so it
-- can write profile_private, which clients cannot touch.
create or replace function public.profiles_divert_private_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Email lives in auth.users only.
  new.email := null;

  if tg_op = 'UPDATE' then
    if new.moderation_note is not null
       or new.moderation_status is distinct from old.moderation_status
    then
      insert into public.profile_private (user_id, moderation_note, updated_at, updated_by)
      values (new.id, new.moderation_note, now(), auth.uid())
      on conflict (user_id) do update set
        moderation_note = excluded.moderation_note,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
    end if;
  end if;

  new.moderation_note := null;
  return new;
end;
$$;

revoke all on function public.profiles_divert_private_columns() from public, anon, authenticated;

drop trigger if exists trg_profiles_20_private on public.profiles;
create trigger trg_profiles_20_private
  before insert or update on public.profiles
  for each row
  execute function public.profiles_divert_private_columns();

comment on column public.profiles.email is
  'Deprecated and always NULL (publicly readable table). Use auth.users.email; staff read it through staff_profile_private().';
comment on column public.profiles.moderation_note is
  'Always NULL here (publicly readable table). Writes are rerouted to profile_private; staff read it through staff_profile_private().';

-- ---------------------------------------------------------------------------
-- 4. Staff read path for email + moderation note
-- ---------------------------------------------------------------------------
create or replace function public.staff_profile_private(p_user_ids uuid[] default null)
returns table (user_id uuid, email text, moderation_note text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, u.email::text, pp.moderation_note
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.profile_private pp on pp.user_id = p.id
  where public.is_staff()
    and (p_user_ids is null or p.id = any (p_user_ids));
$$;

revoke all on function public.staff_profile_private(uuid[]) from public, anon;
grant execute on function public.staff_profile_private(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Staff credit: match on the confirmed auth email, never profiles.email
-- ---------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.staff_credit_grants') is null then
    raise notice 'staff_credit_grants not found: skipping staff credit functions';
    return;
  end if;

  execute $fn$
    create or replace function public.search_members_for_credit(p_query text, p_limit integer default 8)
    returns jsonb
    language plpgsql
    stable
    security definer
    set search_path = public
    as $body$
    declare
      v_q text;
      v_limit int;
    begin
      if not public.is_staff() then
        raise exception 'STAFF_ONLY' using errcode = '42501';
      end if;
      v_q := trim(coalesce(p_query, ''));
      if char_length(v_q) < 2 then
        return '[]'::jsonb;
      end if;
      v_limit := least(greatest(coalesce(p_limit, 8), 1), 20);
      v_q := replace(replace(v_q, '%', ''), '_', '');

      return coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'username', p.username,
          'email', p.email,
          'avatarUrl', p.avatar_url,
          'pinnedBadgeKey', p.pinned_badge_key
        ) order by p.username)
        from (
          select p.id, p.username, u.email::text as email, p.avatar_url, p.pinned_badge_key
          from public.profiles p
          left join auth.users u on u.id = p.id
          where p.username ilike '%' || v_q || '%'
             or coalesce(u.email::text, '') ilike '%' || v_q || '%'
          order by p.username nulls last
          limit v_limit
        ) p
      ), '[]'::jsonb);
    end;
    $body$;
  $fn$;

  execute $fn$
    create or replace function public.bind_staff_credits_for_profile()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      v_email text;
      v_hash text;
      r public.staff_credit_grants%rowtype;
    begin
      -- Confirmed sign-in email only. profiles.email is client-writable
      -- history and must never decide who receives a pending credit.
      select lower(trim(u.email::text)) into v_email
      from auth.users u
      where u.id = NEW.id
        and u.email_confirmed_at is not null;

      v_hash := public.staff_credit_email_hash(v_email);
      if v_hash is null then
        return NEW;
      end if;

      for r in
        select * from public.staff_credit_grants
        where revoked_at is null
          and user_id is null
          and pending_email_hash = v_hash
      loop
        update public.staff_credit_grants set
          user_id = NEW.id,
          pending_email = null,
          pending_email_hash = null,
          updated_at = now()
        where id = r.id;

        if r.contribution_id is not null then
          update public.project_contributions set
            user_id = NEW.id,
            display_name = coalesce(NEW.username, display_name),
            username_snapshot = coalesce(NEW.username, username_snapshot),
            updated_at = now()
          where id = r.contribution_id;
        end if;

        if r.badge_key is not null then
          insert into public.user_badges (user_id, badge_key, source)
          values (NEW.id, r.badge_key, 'staff_credit')
          on conflict (user_id, badge_key) do nothing;
        end if;
      end loop;
      return NEW;
    end;
    $body$;
  $fn$;
end;
$do$;

-- ---------------------------------------------------------------------------
-- 6. Backfill existing rows (the triggers above do the moving)
-- ---------------------------------------------------------------------------
-- Moves each existing note into profile_private and clears the public copy.
update public.profiles
set moderation_note = moderation_note
where moderation_note is not null;

-- Clears stored emails. Nothing is lost: auth.users keeps every address.
update public.profiles
set email = null
where email is not null;

-- ---------------------------------------------------------------------------
-- 7. Verify (each should return 0)
-- ---------------------------------------------------------------------------
-- select count(*) from public.profiles where email is not null;
-- select count(*) from public.profiles where moderation_note is not null;
