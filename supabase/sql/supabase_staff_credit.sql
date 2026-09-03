-- Staff Grant Credit: off-site help gets the same public memorial credit as a task.
-- Does not complete tasks or touch donation ledgers. Safe to re-run.
--
-- Staging check:
--   1. Apply this file.
--   2. Sign in as staff → Moderator → Grant Credit.
--   3. Credit an existing member on Tether; confirm they appear on
--      /projects/tether/contributors and their profile with "Staff credited".
--   4. Credit a pending email; public list shows Pending account, no email.

create extension if not exists pgcrypto with schema extensions;

-- Allow pending staff credits (no user yet) on the public memorial table.
alter table public.project_contributions
  drop constraint if exists project_contributions_account_rule;

alter table public.project_contributions
  add constraint project_contributions_account_rule check (
    category = 'donations'
    or user_id is not null
    or source_key like 'staff-credit:%'
  );

create table if not exists public.staff_credit_grants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  contribution_id uuid references public.project_contributions (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  pending_email text,
  pending_email_hash text,
  grant_category text not null,
  memorial_category text not null,
  memorial_subcategory text,
  public_line text not null,
  private_note text,
  points integer,
  badge_key text,
  credited_on date not null default current_date,
  allow_duplicate boolean not null default false,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint staff_credit_grants_line_len check (
    char_length(trim(public_line)) between 3 and 160
  ),
  constraint staff_credit_grants_note_len check (
    private_note is null or char_length(private_note) <= 500
  ),
  constraint staff_credit_grants_points_chk check (
    points is null or points >= 0
  ),
  constraint staff_credit_grants_subject_chk check (
    user_id is not null or pending_email_hash is not null
  ),
  constraint staff_credit_grants_category_chk check (
    grant_category in (
      'community_moderation',
      'playtest',
      'content',
      'documentation',
      'offsite_development',
      'organizing',
      'other'
    )
  )
);

create index if not exists idx_staff_credit_grants_project
  on public.staff_credit_grants (project_id, revoked_at);

create index if not exists idx_staff_credit_grants_user
  on public.staff_credit_grants (user_id)
  where user_id is not null;

create index if not exists idx_staff_credit_grants_email_hash
  on public.staff_credit_grants (pending_email_hash)
  where pending_email_hash is not null and revoked_at is null;

create table if not exists public.staff_credit_audit (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.staff_credit_grants (id) on delete cascade,
  action text not null check (action in ('grant', 'edit', 'revoke')),
  actor_id uuid references public.profiles (id) on delete set null,
  reason text,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_credit_audit_grant
  on public.staff_credit_audit (grant_id, created_at desc);

alter table public.staff_credit_grants enable row level security;
alter table public.staff_credit_audit enable row level security;

revoke all on public.staff_credit_grants from public, anon, authenticated;
revoke all on public.staff_credit_audit from public, anon, authenticated;
grant all on public.staff_credit_grants to postgres, service_role;
grant all on public.staff_credit_audit to postgres, service_role;

drop policy if exists "Staff read credit grants" on public.staff_credit_grants;
drop policy if exists "Staff write credit grants" on public.staff_credit_grants;
drop policy if exists "Staff read credit audit" on public.staff_credit_audit;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_staff'
  ) then
    create policy "Staff read credit grants"
      on public.staff_credit_grants for select
      to authenticated
      using (public.is_staff());

    create policy "Staff write credit grants"
      on public.staff_credit_grants for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());

    create policy "Staff read credit audit"
      on public.staff_credit_audit for select
      to authenticated
      using (public.is_staff());
  end if;
end $$;

grant select on public.staff_credit_grants to authenticated;
grant select on public.staff_credit_audit to authenticated;

create or replace function public.staff_credit_email_hash(p_email text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := lower(trim(coalesce(p_email, '')));
  if v = '' or v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return null;
  end if;
  return encode(extensions.digest(convert_to(v, 'utf8'), 'sha256'), 'hex');
end;
$$;

create or replace function public.search_members_for_credit(p_query text, p_limit integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
      select p.id, p.username, p.email, p.avatar_url, p.pinned_badge_key
      from public.profiles p
      where p.username ilike '%' || v_q || '%'
         or coalesce(p.email, '') ilike '%' || v_q || '%'
      order by p.username nulls last
      limit v_limit
    ) p
  ), '[]'::jsonb);
end;
$$;

create or replace function public.grant_staff_credit(
  p_user_id uuid default null,
  p_pending_email text default null,
  p_project_id uuid default null,
  p_grant_category text default 'other',
  p_public_line text default '',
  p_private_note text default null,
  p_points integer default null,
  p_badge_key text default null,
  p_credited_on date default current_date,
  p_allow_duplicate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_line text;
  v_note text;
  v_cat text;
  v_mem_cat text;
  v_mem_sub text;
  v_email text;
  v_hash text;
  v_title text;
  v_username text;
  v_grant_id uuid;
  v_contrib_id uuid;
  v_dup uuid;
  v_when timestamptz;
begin
  if not public.is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;

  v_line := trim(coalesce(p_public_line, ''));
  if char_length(v_line) < 3 or char_length(v_line) > 160 then
    raise exception 'Public credit line must be 3–160 characters.';
  end if;
  v_note := nullif(trim(coalesce(p_private_note, '')), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Staff note is too long.';
  end if;

  v_cat := trim(coalesce(p_grant_category, 'other'));
  v_mem_cat := case v_cat
    when 'content' then 'marketing'
    when 'documentation' then 'development'
    when 'offsite_development' then 'development'
    else 'community'
  end;
  v_mem_sub := case v_cat
    when 'community_moderation' then 'Moderation'
    when 'playtest' then 'Playtesting'
    when 'content' then 'Content Creation'
    when 'documentation' then 'Writing'
    when 'offsite_development' then 'Other'
    when 'organizing' then 'Organizing'
    else 'Other'
  end;

  v_email := lower(trim(coalesce(p_pending_email, '')));
  if v_email = '' then v_email := null; end if;
  v_hash := public.staff_credit_email_hash(v_email);

  if p_user_id is null and v_hash is null then
    raise exception 'Pick a member or enter an email.';
  end if;
  if p_user_id is not null then
    v_email := null;
    v_hash := null;
    select username into v_username from public.profiles where id = p_user_id;
    if v_username is null and not exists (select 1 from public.profiles where id = p_user_id) then
      raise exception 'That member was not found.';
    end if;
  end if;

  if p_project_id is not null then
    select coalesce(title, slug) into v_title from public.projects where id = p_project_id;
    if v_title is null then
      raise exception 'That project was not found.';
    end if;
  else
    v_title := 'Together Forge';
  end if;

  if not coalesce(p_allow_duplicate, false) then
    select id into v_dup
    from public.staff_credit_grants
    where revoked_at is null
      and grant_category = v_cat
      and lower(public_line) = lower(v_line)
      and coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(p_project_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (
        (p_user_id is not null and user_id = p_user_id)
        or (v_hash is not null and pending_email_hash = v_hash)
      )
    limit 1;
    if v_dup is not null then
      return jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'existingId', v_dup);
    end if;
  end if;

  v_when := coalesce(p_credited_on, current_date)::timestamptz;
  v_grant_id := gen_random_uuid();

  insert into public.project_contributions (
    project_id, user_id, display_name, category, subcategory,
    role_label, source_key, project_title_snapshot, username_snapshot, created_at
  ) values (
    p_project_id,
    p_user_id,
    case when p_user_id is null then v_line else coalesce(v_username, 'Contributor') end,
    v_mem_cat,
    v_mem_sub,
    v_line,
    'staff-credit:' || v_grant_id::text,
    v_title,
    v_username,
    v_when
  )
  returning id into v_contrib_id;

  insert into public.staff_credit_grants (
    id, project_id, contribution_id, user_id, pending_email, pending_email_hash,
    grant_category, memorial_category, memorial_subcategory, public_line, private_note,
    points, badge_key, credited_on, allow_duplicate, created_by, updated_by
  ) values (
    v_grant_id, p_project_id, v_contrib_id, p_user_id, v_email, v_hash,
    v_cat, v_mem_cat, v_mem_sub, v_line, v_note,
    p_points, nullif(trim(coalesce(p_badge_key, '')), ''),
    coalesce(p_credited_on, current_date),
    coalesce(p_allow_duplicate, false), v_uid, v_uid
  );

  if p_user_id is not null and nullif(trim(coalesce(p_badge_key, '')), '') is not null then
    insert into public.user_badges (user_id, badge_key, source)
    values (p_user_id, trim(p_badge_key), 'staff_credit')
    on conflict (user_id, badge_key) do nothing;
  end if;

  insert into public.staff_credit_audit (grant_id, action, actor_id, snapshot)
  values (
    v_grant_id, 'grant', v_uid,
    jsonb_build_object(
      'project_id', p_project_id,
      'user_id', p_user_id,
      'pending_email', v_email,
      'grant_category', v_cat,
      'public_line', v_line,
      'points', p_points,
      'badge_key', nullif(trim(coalesce(p_badge_key, '')), ''),
      'credited_on', coalesce(p_credited_on, current_date)
    )
  );

  return jsonb_build_object('ok', true, 'id', v_grant_id, 'contributionId', v_contrib_id);
end;
$$;

create or replace function public.update_staff_credit(
  p_id uuid,
  p_grant_category text default null,
  p_public_line text default null,
  p_private_note text default null,
  p_points integer default null,
  p_badge_key text default null,
  p_credited_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g public.staff_credit_grants%rowtype;
  v_line text;
  v_cat text;
  v_mem_cat text;
  v_mem_sub text;
begin
  if not public.is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;
  select * into g from public.staff_credit_grants where id = p_id;
  if g.id is null then
    raise exception 'Credit grant not found.';
  end if;
  if g.revoked_at is not null then
    raise exception 'That credit was revoked.';
  end if;

  v_line := coalesce(nullif(trim(coalesce(p_public_line, '')), ''), g.public_line);
  if char_length(v_line) < 3 or char_length(v_line) > 160 then
    raise exception 'Public credit line must be 3–160 characters.';
  end if;
  v_cat := coalesce(nullif(trim(coalesce(p_grant_category, '')), ''), g.grant_category);
  v_mem_cat := case v_cat
    when 'content' then 'marketing'
    when 'documentation' then 'development'
    when 'offsite_development' then 'development'
    else 'community'
  end;
  v_mem_sub := case v_cat
    when 'community_moderation' then 'Moderation'
    when 'playtest' then 'Playtesting'
    when 'content' then 'Content Creation'
    when 'documentation' then 'Writing'
    when 'organizing' then 'Organizing'
    else 'Other'
  end;

  update public.staff_credit_grants set
    grant_category = v_cat,
    memorial_category = v_mem_cat,
    memorial_subcategory = v_mem_sub,
    public_line = v_line,
    private_note = case
      when p_private_note is null then private_note
      else nullif(trim(p_private_note), '')
    end,
    points = case
      when p_points is null then points
      when p_points <= 0 then null
      else p_points
    end,
    badge_key = case
      when p_badge_key is null then badge_key
      else nullif(trim(p_badge_key), '')
    end,
    credited_on = coalesce(p_credited_on, credited_on),
    updated_at = now(),
    updated_by = v_uid
  where id = p_id;

  if g.contribution_id is not null then
    update public.project_contributions set
      category = v_mem_cat,
      subcategory = v_mem_sub,
      role_label = v_line,
      display_name = case when g.user_id is null then v_line else display_name end,
      created_at = coalesce(p_credited_on, g.credited_on)::timestamptz,
      updated_at = now()
    where id = g.contribution_id;
  end if;

  if g.user_id is not null and nullif(trim(coalesce(p_badge_key, g.badge_key, '')), '') is not null then
    insert into public.user_badges (user_id, badge_key, source)
    values (g.user_id, coalesce(nullif(trim(p_badge_key), ''), g.badge_key), 'staff_credit')
    on conflict (user_id, badge_key) do nothing;
  end if;

  insert into public.staff_credit_audit (grant_id, action, actor_id, snapshot)
  values (p_id, 'edit', v_uid, jsonb_build_object(
    'public_line', v_line,
    'grant_category', v_cat,
    'points', coalesce(p_points, g.points),
    'badge_key', coalesce(nullif(trim(coalesce(p_badge_key, '')), ''), g.badge_key)
  ));

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.revoke_staff_credit(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g public.staff_credit_grants%rowtype;
  v_reason text;
begin
  if not public.is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;
  v_reason := trim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 then
    raise exception 'Add a private reason for the revoke.';
  end if;
  select * into g from public.staff_credit_grants where id = p_id;
  if g.id is null then
    raise exception 'Credit grant not found.';
  end if;
  if g.revoked_at is not null then
    return jsonb_build_object('ok', true, 'id', p_id, 'already', true);
  end if;

  update public.staff_credit_grants set
    revoked_at = now(),
    revoked_by = v_uid,
    revoke_reason = v_reason,
    updated_at = now(),
    updated_by = v_uid
  where id = p_id;

  if g.contribution_id is not null then
    update public.project_contributions
    set archived_at = now(), updated_at = now()
    where id = g.contribution_id;
  end if;

  insert into public.staff_credit_audit (grant_id, action, actor_id, reason, snapshot)
  values (p_id, 'revoke', v_uid, v_reason, jsonb_build_object(
    'public_line', g.public_line,
    'user_id', g.user_id,
    'project_id', g.project_id
  ));

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.bind_staff_credits_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_hash text;
  r public.staff_credit_grants%rowtype;
begin
  v_email := lower(trim(coalesce(NEW.email, '')));
  if v_email = '' then
    select lower(trim(email)) into v_email from auth.users where id = NEW.id;
  end if;
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
$$;

drop trigger if exists trg_bind_staff_credits on public.profiles;
create trigger trg_bind_staff_credits
  after insert or update of email, username on public.profiles
  for each row
  execute function public.bind_staff_credits_for_profile();

revoke all on function public.staff_credit_email_hash(text) from public;
revoke all on function public.search_members_for_credit(text, integer) from public;
revoke all on function public.grant_staff_credit(uuid, text, uuid, text, text, text, integer, text, date, boolean) from public;
revoke all on function public.update_staff_credit(uuid, text, text, text, integer, text, date) from public;
revoke all on function public.revoke_staff_credit(uuid, text) from public;

grant execute on function public.search_members_for_credit(text, integer)
  to authenticated;
grant execute on function public.grant_staff_credit(uuid, text, uuid, text, text, text, integer, text, date, boolean)
  to authenticated;
grant execute on function public.update_staff_credit(uuid, text, text, text, integer, text, date)
  to authenticated;
grant execute on function public.revoke_staff_credit(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
