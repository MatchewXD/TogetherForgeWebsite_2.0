-- =============================================================================
-- MFA "remember this device" for 30 days.
-- Stores only a SHA-256 hash of a client-held token. Staff/users cannot read
-- other people's rows. Safe to re-run.
-- =============================================================================

create table if not exists public.mfa_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint mfa_trusted_devices_hash_len check (char_length(token_hash) between 32 and 128),
  constraint mfa_trusted_devices_unique unique (user_id, token_hash)
);

create index if not exists idx_mfa_trusted_devices_user_exp
  on public.mfa_trusted_devices (user_id, expires_at);

comment on table public.mfa_trusted_devices is
  'Hashed MFA remember-this-device tokens. Skip TOTP on this browser until expires_at.';

alter table public.mfa_trusted_devices enable row level security;

grant select, insert, delete, update on public.mfa_trusted_devices to authenticated;

drop policy if exists "Users manage own trusted MFA devices" on public.mfa_trusted_devices;
create policy "Users manage own trusted MFA devices"
  on public.mfa_trusted_devices
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.mfa_remember_device(p_token_hash text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text := lower(btrim(coalesce(p_token_hash, '')));
  v_exp timestamptz := now() + interval '30 days';
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  if char_length(v_hash) < 32 or char_length(v_hash) > 128 then
    raise exception 'Invalid device token.';
  end if;

  delete from public.mfa_trusted_devices
  where user_id = v_uid and expires_at <= now();

  insert into public.mfa_trusted_devices (user_id, token_hash, expires_at, last_used_at)
  values (v_uid, v_hash, v_exp, now())
  on conflict (user_id, token_hash) do update
    set expires_at = excluded.expires_at,
        last_used_at = now();

  delete from public.mfa_trusted_devices
  where id in (
    select id from public.mfa_trusted_devices
    where user_id = v_uid
    order by created_at desc
    offset 10
  );

  return jsonb_build_object('ok', true, 'expires_at', v_exp);
end;
$$;

create or replace function public.mfa_device_is_trusted(p_token_hash text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text := lower(btrim(coalesce(p_token_hash, '')));
  v_n int := 0;
begin
  if v_uid is null or char_length(v_hash) < 32 then
    return false;
  end if;

  update public.mfa_trusted_devices
  set last_used_at = now()
  where user_id = v_uid
    and token_hash = v_hash
    and expires_at > now();

  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function public.mfa_forget_devices()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  delete from public.mfa_trusted_devices where user_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.mfa_remember_device(text) to authenticated;
grant execute on function public.mfa_device_is_trusted(text) to authenticated;
grant execute on function public.mfa_forget_devices() to authenticated;

notify pgrst, 'reload schema';
