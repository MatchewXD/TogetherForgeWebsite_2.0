-- =============================================================================
-- Identity gate: accept GitHub as a valid SSO provider (with Discord / Google)
-- Run after supabase_task_anti_abuse.sql. Safe to re-run.
-- Enable GitHub under Supabase Dashboard → Authentication → Providers.
-- =============================================================================

create or replace function public.user_meets_identity_gate(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email_ok boolean := false;
  v_sso_ok boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  select (u.email_confirmed_at is not null)
  into v_email_ok
  from auth.users u
  where u.id = p_user_id;

  if not coalesce(v_email_ok, false) then
    return false;
  end if;

  select exists (
    select 1
    from auth.identities i
    where i.user_id = p_user_id
      and lower(i.provider) in ('discord', 'google', 'github')
  ) into v_sso_ok;

  return coalesce(v_sso_ok, false);
end;
$$;

create or replace function public.user_identity_gate_status(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email_ok boolean := false;
  v_sso_ok boolean := false;
  v_providers text[] := array[]::text[];
begin
  if p_user_id is null then
    return jsonb_build_object(
      'signed_in', false,
      'email_verified', false,
      'has_sso', false,
      'meets_gate', false,
      'providers', '[]'::jsonb
    );
  end if;

  select (u.email_confirmed_at is not null)
  into v_email_ok
  from auth.users u
  where u.id = p_user_id;

  select coalesce(array_agg(lower(i.provider) order by i.provider), array[]::text[])
  into v_providers
  from auth.identities i
  where i.user_id = p_user_id;

  v_sso_ok := exists (
    select 1 from unnest(v_providers) p
    where p in ('discord', 'google', 'github')
  );

  return jsonb_build_object(
    'signed_in', true,
    'email_verified', coalesce(v_email_ok, false),
    'has_sso', v_sso_ok,
    'meets_gate', coalesce(v_email_ok, false) and v_sso_ok,
    'providers', to_jsonb(v_providers)
  );
end;
$$;

grant execute on function public.user_meets_identity_gate(uuid) to authenticated, anon;
grant execute on function public.user_identity_gate_status(uuid) to authenticated, anon;
