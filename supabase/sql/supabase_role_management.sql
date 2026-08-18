-- Together Forge: Founder role + basic Role Management
-- Run after supabase_moderation.sql (needs profiles.role).
-- Safe to re-run.
--
-- Product roles going forward: user (default) | moderator | founder
-- Legacy values (admin, project_lead, contributor) still count as staff
-- where they already did, but only a Founder can assign roles.
--
-- First Founder (SQL Editor, once):
--   update public.profiles set role = 'founder' where username = 'YOUR_USERNAME';

-- ---------------------------------------------------------------------------
-- Staff helpers: include founder
-- ---------------------------------------------------------------------------
create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') = 'founder'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') in (
        'moderator', 'admin', 'project_lead', 'founder'
      )
  );
$$;

create or replace function public.is_project_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and coalesce(role, 'user') in (
        'admin', 'moderator', 'project_lead', 'founder'
      )
  );
$$;

-- Optional helper from supabase_task_limit_bypass.sql
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'user_bypasses_task_limits'
  ) then
    execute $f$
      create or replace function public.user_bypasses_task_limits(
        p_user_id uuid default auth.uid()
      )
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $fn$
        select coalesce((
          select
            coalesce(p.task_limit_bypass, false)
            or coalesce(p.role, 'user') in (
              'admin', 'moderator', 'project_lead', 'founder'
            )
          from public.profiles p
          where p.id = p_user_id
        ), false);
      $fn$;
    $f$;
  end if;
end $$;

comment on function public.is_founder() is
  'True when the signed-in profile.role is founder.';
comment on function public.is_staff() is
  'True for moderator, admin, project_lead, or founder.';
comment on function public.is_project_staff() is
  'True for admin, moderator, project_lead, or founder.';

grant execute on function public.is_founder() to anon, authenticated, service_role;
grant execute on function public.is_staff() to anon, authenticated, service_role;
grant execute on function public.is_project_staff() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- At most one Founder
-- ---------------------------------------------------------------------------
create unique index if not exists idx_profiles_one_founder
  on public.profiles (role)
  where role = 'founder';

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.role_change_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  old_role text,
  new_role text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_role_change_log_created
  on public.role_change_log (created_at desc);

create index if not exists idx_role_change_log_user
  on public.role_change_log (user_id, created_at desc);

comment on table public.role_change_log is
  'Who changed a profile role, from which role, to which role, and when. Written only by set_user_role().';

alter table public.role_change_log enable row level security;

drop policy if exists "Founders can read role change log" on public.role_change_log;
create policy "Founders can read role change log"
  on public.role_change_log for select
  to authenticated
  using (public.is_founder());

grant select on table public.role_change_log to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Block direct role UPDATEs from signed-in clients (staff profile policy
-- previously allowed any staff member to set profiles.role).
-- SQL Editor / service_role (auth.uid() is null) can still set the first Founder.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_direct_role_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if auth.uid() is not null
       and current_setting('app.allow_role_change', true) is distinct from 'on'
    then
      raise exception 'Role can only be changed by a Founder via Role Management'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_direct_role_change on public.profiles;
create trigger trg_prevent_direct_role_change
  before update on public.profiles
  for each row
  execute function public.prevent_direct_role_change();

-- ---------------------------------------------------------------------------
-- Founder-only role assignment
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(
  p_user_id uuid,
  p_new_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_old_role text;
  v_new_role text := lower(trim(coalesce(p_new_role, '')));
  v_username text;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;

  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if v_new_role not in ('user', 'moderator', 'founder') then
    raise exception 'Role must be user, moderator, or founder';
  end if;

  select coalesce(role, 'user') into v_actor_role
  from public.profiles
  where id = v_actor;

  if v_actor_role is distinct from 'founder' then
    raise exception 'Only a Founder can change roles';
  end if;

  if p_user_id = v_actor then
    raise exception 'You cannot change your own role';
  end if;

  select coalesce(role, 'user'), username
    into v_old_role, v_username
  from public.profiles
  where id = p_user_id;

  if v_old_role is null then
    raise exception 'User not found';
  end if;

  if v_old_role = v_new_role then
    return jsonb_build_object(
      'id', p_user_id,
      'username', v_username,
      'role', v_old_role
    );
  end if;

  if v_old_role = 'founder' then
    raise exception 'The Founder role cannot be changed here';
  end if;

  if v_new_role = 'founder'
     and exists (
       select 1 from public.profiles
       where role = 'founder'
         and id is distinct from p_user_id
     )
  then
    raise exception 'There can only be one Founder';
  end if;

  perform set_config('app.allow_role_change', 'on', true);

  update public.profiles
  set role = v_new_role
  where id = p_user_id;

  insert into public.role_change_log (user_id, changed_by, old_role, new_role)
  values (p_user_id, v_actor, v_old_role, v_new_role);

  return jsonb_build_object(
    'id', p_user_id,
    'username', v_username,
    'role', v_new_role,
    'old_role', v_old_role
  );
end;
$$;

comment on function public.set_user_role(uuid, text) is
  'Founder-only. Sets a profile role to user, moderator, or founder and writes role_change_log.';

grant execute on function public.set_user_role(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
