-- Staff may block contacts from submitting more Get Involved applications.
-- Matches signed-in account, email, and/or Discord username. Safe to re-run.

create or replace function public.volunteer_apply_norm_email(raw text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(raw)), '');
$$;

create or replace function public.volunteer_apply_norm_discord(raw text)
returns text
language sql
immutable
as $$
  select nullif(
    lower(trim(both from regexp_replace(coalesce(raw, ''), '^@+', ''))),
    ''
  );
$$;

create table if not exists public.volunteer_apply_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  email text,
  discord_username text,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  constraint volunteer_apply_blocks_target_chk check (
    user_id is not null
    or (email is not null and length(trim(email)) > 0)
    or (discord_username is not null and length(trim(discord_username)) > 0)
  )
);

create index if not exists idx_volunteer_apply_blocks_active_user
  on public.volunteer_apply_blocks (user_id)
  where active and user_id is not null;
create index if not exists idx_volunteer_apply_blocks_active_email
  on public.volunteer_apply_blocks (email)
  where active and email is not null;
create index if not exists idx_volunteer_apply_blocks_active_discord
  on public.volunteer_apply_blocks (discord_username)
  where active and discord_username is not null;

comment on table public.volunteer_apply_blocks is
  'Staff block list for Get Involved applications. Private. Matches account, email, or Discord.';

create or replace function public.volunteer_apply_blocks_norm()
returns trigger
language plpgsql
as $$
begin
  new.email := public.volunteer_apply_norm_email(new.email);
  new.discord_username := public.volunteer_apply_norm_discord(new.discord_username);
  return new;
end;
$$;

drop trigger if exists trg_volunteer_apply_blocks_norm
  on public.volunteer_apply_blocks;
create trigger trg_volunteer_apply_blocks_norm
  before insert or update on public.volunteer_apply_blocks
  for each row
  execute function public.volunteer_apply_blocks_norm();

alter table public.volunteer_apply_blocks enable row level security;

revoke all on public.volunteer_apply_blocks from public, anon;
grant select, insert, update on public.volunteer_apply_blocks to authenticated;
grant all on public.volunteer_apply_blocks to service_role;

drop policy if exists volunteer_apply_blocks_select_staff on public.volunteer_apply_blocks;
create policy volunteer_apply_blocks_select_staff
  on public.volunteer_apply_blocks
  for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  );

drop policy if exists volunteer_apply_blocks_insert_staff on public.volunteer_apply_blocks;
create policy volunteer_apply_blocks_insert_staff
  on public.volunteer_apply_blocks
  for insert
  to authenticated
  with check (
    public.is_staff()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  );

drop policy if exists volunteer_apply_blocks_update_staff on public.volunteer_apply_blocks;
create policy volunteer_apply_blocks_update_staff
  on public.volunteer_apply_blocks
  for update
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  )
  with check (
    public.is_staff()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  );

create or replace function public.volunteer_apply_is_blocked(
  p_user_id uuid,
  p_email text,
  p_discord text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.volunteer_apply_blocks b
    where b.active
      and (
        (p_user_id is not null and b.user_id = p_user_id)
        or (
          public.volunteer_apply_norm_email(p_email) is not null
          and b.email = public.volunteer_apply_norm_email(p_email)
        )
        or (
          public.volunteer_apply_norm_discord(p_discord) is not null
          and b.discord_username = public.volunteer_apply_norm_discord(p_discord)
        )
      )
  );
$$;

revoke all on function public.volunteer_apply_is_blocked(uuid, text, text) from public;
grant execute on function public.volunteer_apply_is_blocked(uuid, text, text)
  to postgres, service_role;

create or replace function public.enforce_volunteer_apply_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.volunteer_apply_is_blocked(
    new.user_id,
    new.email,
    new.discord_username
  ) then
    raise exception 'VOLUNTEER_APPLY_BLOCKED'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_volunteer_apply_block on public.volunteer_applications;
create trigger trg_volunteer_apply_block
  before insert on public.volunteer_applications
  for each row
  execute function public.enforce_volunteer_apply_block();

create or replace function public.staff_block_volunteer_applicant(
  p_user_id uuid,
  p_email text,
  p_discord text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := public.volunteer_apply_norm_email(p_email);
  v_discord text := public.volunteer_apply_norm_discord(p_discord);
begin
  if not (
    public.is_staff()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.role, 'user') = 'founder'
    )
  ) then
    raise exception 'not authorized';
  end if;

  if p_user_id is null and v_email is null and v_discord is null then
    raise exception 'nothing to block';
  end if;

  insert into public.volunteer_apply_blocks (
    user_id,
    email,
    discord_username,
    reason,
    created_by
  )
  values (
    p_user_id,
    v_email,
    v_discord,
    nullif(trim(coalesce(p_reason, '')), ''),
    auth.uid()
  )
  returning id into v_id;

  update public.volunteer_applications
  set status = 'declined',
      updated_at = now()
  where status in ('new', 'reviewing')
    and (
      (p_user_id is not null and user_id = p_user_id)
      or (
        v_email is not null
        and public.volunteer_apply_norm_email(email) = v_email
      )
      or (
        v_discord is not null
        and public.volunteer_apply_norm_discord(discord_username) = v_discord
      )
    );

  return v_id;
end;
$$;

revoke all on function public.staff_block_volunteer_applicant(uuid, text, text, text) from public;
grant execute on function public.staff_block_volunteer_applicant(uuid, text, text, text)
  to authenticated;
