-- =============================================================================
-- Hybrid idea tags: curated core + user-suggested + promotion rules
-- =============================================================================
-- Publicly selectable when:
--   status IN ('curated', 'approved')
--   OR (status = 'suggested' AND usage_count >= 9)
-- Never when status = 'hidden'.
--
-- ideas.tags remains free-text (comma-separated display names) for compatibility.
-- This catalog drives the picker / filter list and admin tools.
-- =============================================================================

-- Promotion threshold (keep in sync with src/constants/ideaTags.js)
-- Used in views / RPCs below as 9.

create table if not exists public.idea_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  status text not null default 'suggested'
    check (status in ('curated', 'suggested', 'approved', 'hidden')),
  usage_count integer not null default 0 check (usage_count >= 0),
  suggested_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  hidden_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint idea_tags_slug_unique unique (slug)
);

create index if not exists idea_tags_status_idx on public.idea_tags (status);
create index if not exists idea_tags_usage_idx on public.idea_tags (usage_count desc);
create index if not exists idea_tags_name_lower_idx on public.idea_tags (lower(name));

comment on table public.idea_tags is
  'Hybrid tag catalog for Ideas: curated, suggested, approved, hidden + usage counts.';

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.normalize_idea_tag_slug(raw text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  s := lower(trim(coalesce(raw, '')));
  s := regexp_replace(s, '^#+', '');
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := trim(both '-' from s);
  if length(s) < 1 then
    return null;
  end if;
  if length(s) > 48 then
    s := left(s, 48);
    s := trim(both '-' from s);
  end if;
  return s;
end;
$$;

create or replace function public.normalize_idea_tag_name(raw text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  s := trim(both from coalesce(raw, ''));
  s := regexp_replace(s, '^#+', '');
  s := regexp_replace(s, '\s+', ' ', 'g');
  if length(s) < 1 then
    return null;
  end if;
  if length(s) > 40 then
    s := left(s, 40);
  end if;
  return s;
end;
$$;

create or replace function public.idea_tag_is_publicly_selectable(
  p_status text,
  p_usage integer
)
returns boolean
language sql
immutable
as $$
  select
    p_status is distinct from 'hidden'
    and (
      p_status in ('curated', 'approved')
      or (p_status = 'suggested' and coalesce(p_usage, 0) >= 9)
    );
$$;

create or replace function public.set_idea_tags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists idea_tags_set_updated_at on public.idea_tags;
create trigger idea_tags_set_updated_at
  before update on public.idea_tags
  for each row
  execute function public.set_idea_tags_updated_at();

-- -----------------------------------------------------------------------------
-- Staff gate (profiles.role)
-- -----------------------------------------------------------------------------

create or replace function public.is_idea_tag_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, 'user')) in ('admin', 'moderator', 'project_lead')
  );
$$;

create or replace function public.is_idea_tag_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, 'user')) = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.idea_tags enable row level security;

drop policy if exists idea_tags_select_public on public.idea_tags;
create policy idea_tags_select_public
  on public.idea_tags
  for select
  to authenticated, anon
  using (
    public.idea_tag_is_publicly_selectable(status, usage_count)
    or public.is_idea_tag_staff()
    or (suggested_by is not null and suggested_by = auth.uid())
  );

-- Authenticated users may insert suggested tags only
drop policy if exists idea_tags_insert_suggested on public.idea_tags;
create policy idea_tags_insert_suggested
  on public.idea_tags
  for insert
  to authenticated
  with check (
    status = 'suggested'
    and (suggested_by is null or suggested_by = auth.uid())
  );

-- Staff may update / delete; owners cannot promote themselves
drop policy if exists idea_tags_update_staff on public.idea_tags;
create policy idea_tags_update_staff
  on public.idea_tags
  for update
  to authenticated
  using (public.is_idea_tag_staff())
  with check (public.is_idea_tag_staff());

drop policy if exists idea_tags_delete_staff on public.idea_tags;
create policy idea_tags_delete_staff
  on public.idea_tags
  for delete
  to authenticated
  using (public.is_idea_tag_admin() or public.is_idea_tag_staff());

-- -----------------------------------------------------------------------------
-- Public list view (stable for clients)
-- -----------------------------------------------------------------------------

create or replace view public.idea_tags_public
with (security_invoker = true)
as
select
  id,
  slug,
  name,
  status,
  usage_count,
  created_at,
  updated_at
from public.idea_tags
where public.idea_tag_is_publicly_selectable(status, usage_count)
order by usage_count desc, lower(name) asc;

grant select on public.idea_tags_public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Ensure tag (create suggested if missing) — used when ideas save
-- -----------------------------------------------------------------------------

create or replace function public.ensure_idea_tag(
  p_name text,
  p_as_curated boolean default false
)
returns public.idea_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_slug text;
  v_row public.idea_tags;
  v_status text;
begin
  v_name := public.normalize_idea_tag_name(p_name);
  v_slug := public.normalize_idea_tag_slug(v_name);
  if v_slug is null then
    raise exception 'Invalid tag name';
  end if;

  select * into v_row from public.idea_tags where slug = v_slug limit 1;
  if found then
    return v_row;
  end if;

  v_status := case when p_as_curated then 'curated' else 'suggested' end;

  insert into public.idea_tags (slug, name, status, suggested_by)
  values (
    v_slug,
    v_name,
    v_status,
    case when p_as_curated then null else auth.uid() end
  )
  on conflict (slug) do update
    set name = excluded.name
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.ensure_idea_tag(text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Recompute usage_count from ideas.tags free-text
-- -----------------------------------------------------------------------------

create or replace function public.recompute_idea_tag_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  parts text[];
  part text;
  v_slug text;
  v_name text;
  touched integer := 0;
begin
  -- Zero all first
  update public.idea_tags set usage_count = 0;

  for r in
    select tags from public.ideas
    where tags is not null and length(trim(tags)) > 0
  loop
    parts := regexp_split_to_array(r.tags, '[,;#|]+');
    foreach part in array parts
    loop
      v_name := public.normalize_idea_tag_name(part);
      v_slug := public.normalize_idea_tag_slug(v_name);
      if v_slug is null then
        continue;
      end if;

      update public.idea_tags t
      set usage_count = t.usage_count + 1
      where t.slug = v_slug;

      if not found then
        -- Create catalog row for existing free-text tags (suggested)
        insert into public.idea_tags (slug, name, status, usage_count)
        values (v_slug, v_name, 'suggested', 1)
        on conflict (slug) do update
          set usage_count = public.idea_tags.usage_count + 1;
      end if;

      touched := touched + 1;
    end loop;
  end loop;

  -- Auto-promote suggested tags that crossed the threshold (optional; selectable
  -- already works via usage_count >= 9 without changing status)
  return touched;
end;
$$;

grant execute on function public.recompute_idea_tag_usage() to authenticated;

-- Bump usage for a set of tag names (delta +1 or recompute-safe apply)
create or replace function public.bump_idea_tag_usage(p_names text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n text;
  v_name text;
  v_slug text;
begin
  if p_names is null then
    return;
  end if;
  foreach n in array p_names
  loop
    v_name := public.normalize_idea_tag_name(n);
    v_slug := public.normalize_idea_tag_slug(v_name);
    if v_slug is null then
      continue;
    end if;
    insert into public.idea_tags (slug, name, status, usage_count, suggested_by)
    values (v_slug, v_name, 'suggested', 1, auth.uid())
    on conflict (slug) do update
      set usage_count = public.idea_tags.usage_count + 1;
  end loop;
end;
$$;

grant execute on function public.bump_idea_tag_usage(text[]) to authenticated;

-- Full sync after idea save: ensure tags exist, then recompute all usage
-- (simple + correct; idea volume is modest)
create or replace function public.sync_idea_tags_after_save(p_tag_names text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n text;
begin
  if p_tag_names is not null then
    foreach n in array p_tag_names
    loop
      begin
        perform public.ensure_idea_tag(n, false);
      exception when others then
        null;
      end;
    end loop;
  end if;
  perform public.recompute_idea_tag_usage();
end;
$$;

grant execute on function public.sync_idea_tags_after_save(text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Admin / staff RPCs
-- -----------------------------------------------------------------------------

create or replace function public.admin_approve_idea_tag(p_id uuid)
returns public.idea_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.idea_tags;
begin
  if not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;

  update public.idea_tags
  set
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    hidden_at = null
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Tag not found';
  end if;
  return v_row;
end;
$$;

grant execute on function public.admin_approve_idea_tag(uuid) to authenticated;

create or replace function public.admin_hide_idea_tag(p_id uuid)
returns public.idea_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.idea_tags;
begin
  if not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;

  update public.idea_tags
  set status = 'hidden', hidden_at = now()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Tag not found';
  end if;
  return v_row;
end;
$$;

grant execute on function public.admin_hide_idea_tag(uuid) to authenticated;

create or replace function public.admin_unhide_idea_tag(p_id uuid)
returns public.idea_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.idea_tags;
begin
  if not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;

  update public.idea_tags
  set
    status = case
      when status = 'hidden' and approved_at is not null then 'approved'
      when status = 'hidden' then 'suggested'
      else status
    end,
    hidden_at = null
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Tag not found';
  end if;
  return v_row;
end;
$$;

grant execute on function public.admin_unhide_idea_tag(uuid) to authenticated;

create or replace function public.admin_rename_idea_tag(p_id uuid, p_new_name text)
returns public.idea_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.idea_tags;
  v_new_name text;
  v_new_slug text;
  v_row public.idea_tags;
  r record;
  parts text[];
  rebuilt text[];
  part text;
  pslug text;
begin
  if not public.is_idea_tag_admin() and not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;

  select * into v_old from public.idea_tags where id = p_id;
  if not found then
    raise exception 'Tag not found';
  end if;

  v_new_name := public.normalize_idea_tag_name(p_new_name);
  v_new_slug := public.normalize_idea_tag_slug(v_new_name);
  if v_new_slug is null then
    raise exception 'Invalid tag name';
  end if;

  if exists (
    select 1 from public.idea_tags
    where slug = v_new_slug and id <> p_id
  ) then
    raise exception 'A tag with that name already exists. Merge instead.';
  end if;

  -- Rewrite free-text tags on ideas
  for r in
    select id, tags from public.ideas
    where tags is not null and length(trim(tags)) > 0
  loop
    parts := regexp_split_to_array(r.tags, '[,;#|]+');
    rebuilt := array[]::text[];
    foreach part in array parts
    loop
      pslug := public.normalize_idea_tag_slug(part);
      if pslug is null then
        continue;
      end if;
      if pslug = v_old.slug then
        rebuilt := array_append(rebuilt, v_new_name);
      else
        rebuilt := array_append(rebuilt, public.normalize_idea_tag_name(part));
      end if;
    end loop;
    update public.ideas
    set tags = array_to_string(rebuilt, ', ')
    where id = r.id;
  end loop;

  update public.idea_tags
  set slug = v_new_slug, name = v_new_name
  where id = p_id
  returning * into v_row;

  perform public.recompute_idea_tag_usage();
  return v_row;
end;
$$;

grant execute on function public.admin_rename_idea_tag(uuid, text) to authenticated;

create or replace function public.admin_merge_idea_tags(
  p_source_id uuid,
  p_target_id uuid
)
returns public.idea_tags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.idea_tags;
  v_tgt public.idea_tags;
  r record;
  parts text[];
  rebuilt text[];
  part text;
  pslug text;
  seen text[];
begin
  if not public.is_idea_tag_admin() and not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;
  if p_source_id = p_target_id then
    raise exception 'Source and target must differ';
  end if;

  select * into v_src from public.idea_tags where id = p_source_id;
  if not found then raise exception 'Source tag not found'; end if;
  select * into v_tgt from public.idea_tags where id = p_target_id;
  if not found then raise exception 'Target tag not found'; end if;

  for r in
    select id, tags from public.ideas
    where tags is not null and length(trim(tags)) > 0
  loop
    parts := regexp_split_to_array(r.tags, '[,;#|]+');
    rebuilt := array[]::text[];
    seen := array[]::text[];
    foreach part in array parts
    loop
      pslug := public.normalize_idea_tag_slug(part);
      if pslug is null then continue; end if;
      if pslug = v_src.slug then
        pslug := v_tgt.slug;
        part := v_tgt.name;
      else
        part := public.normalize_idea_tag_name(part);
      end if;
      if pslug = any (seen) then continue; end if;
      seen := array_append(seen, pslug);
      rebuilt := array_append(rebuilt, part);
    end loop;
    update public.ideas
    set tags = array_to_string(rebuilt, ', ')
    where id = r.id;
  end loop;

  -- Prefer stronger status on target
  update public.idea_tags
  set status = case
    when v_tgt.status = 'curated' or v_src.status = 'curated' then 'curated'
    when v_tgt.status = 'approved' or v_src.status = 'approved' then 'approved'
    when v_tgt.status = 'hidden' and v_src.status = 'hidden' then 'hidden'
    else v_tgt.status
  end
  where id = p_target_id
  returning * into v_tgt;

  delete from public.idea_tags where id = p_source_id;
  perform public.recompute_idea_tag_usage();

  select * into v_tgt from public.idea_tags where id = p_target_id;
  return v_tgt;
end;
$$;

grant execute on function public.admin_merge_idea_tags(uuid, uuid) to authenticated;

create or replace function public.admin_delete_idea_tag(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.idea_tags;
  r record;
  parts text[];
  rebuilt text[];
  part text;
  pslug text;
begin
  if not public.is_idea_tag_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_row from public.idea_tags where id = p_id;
  if not found then raise exception 'Tag not found'; end if;

  -- Strip from ideas
  for r in
    select id, tags from public.ideas
    where tags is not null and length(trim(tags)) > 0
  loop
    parts := regexp_split_to_array(r.tags, '[,;#|]+');
    rebuilt := array[]::text[];
    foreach part in array parts
    loop
      pslug := public.normalize_idea_tag_slug(part);
      if pslug is null or pslug = v_row.slug then
        continue;
      end if;
      rebuilt := array_append(rebuilt, public.normalize_idea_tag_name(part));
    end loop;
    update public.ideas
    set tags = nullif(array_to_string(rebuilt, ', '), '')
    where id = r.id;
  end loop;

  delete from public.idea_tags where id = p_id;
end;
$$;

grant execute on function public.admin_delete_idea_tag(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Seed curated core tags (idempotent)
-- -----------------------------------------------------------------------------

insert into public.idea_tags (slug, name, status, usage_count) values
  ('co-op', 'co-op', 'curated', 0),
  ('multiplayer', 'multiplayer', 'curated', 0),
  ('singleplayer', 'singleplayer', 'curated', 0),
  ('pve', 'PvE', 'curated', 0),
  ('pvp', 'PvP', 'curated', 0),
  ('horror', 'horror', 'curated', 0),
  ('puzzle', 'puzzle', 'curated', 0),
  ('action', 'action', 'curated', 0),
  ('adventure', 'adventure', 'curated', 0),
  ('rpg', 'RPG', 'curated', 0),
  ('roguelike', 'roguelike', 'curated', 0),
  ('strategy', 'strategy', 'curated', 0),
  ('simulation', 'simulation', 'curated', 0),
  ('sandbox', 'sandbox', 'curated', 0),
  ('story-rich', 'story-rich', 'curated', 0),
  ('atmospheric', 'atmospheric', 'curated', 0),
  ('pixel-art', 'pixel-art', 'curated', 0),
  ('3d', '3D', 'curated', 0),
  ('2d', '2D', 'curated', 0),
  ('twitch', 'Twitch', 'curated', 0),
  ('streamer', 'streamer', 'curated', 0),
  ('community', 'community', 'curated', 0),
  ('survival', 'survival', 'curated', 0),
  ('crafting', 'crafting', 'curated', 0),
  ('building', 'building', 'curated', 0),
  ('exploration', 'exploration', 'curated', 0),
  ('stealth', 'stealth', 'curated', 0),
  ('platformer', 'platformer', 'curated', 0),
  ('shooter', 'shooter', 'curated', 0),
  ('open-world', 'open-world', 'curated', 0),
  ('narrative', 'narrative', 'curated', 0),
  ('procedural', 'procedural', 'curated', 0),
  ('physics', 'physics', 'curated', 0),
  ('tactical', 'tactical', 'curated', 0),
  ('casual', 'casual', 'curated', 0),
  ('hardcore', 'hardcore', 'curated', 0),
  ('vr', 'VR', 'curated', 0),
  ('local-multiplayer', 'local multiplayer', 'curated', 0),
  ('asymmetric', 'asymmetric', 'curated', 0),
  ('sci-fi', 'sci-fi', 'curated', 0),
  ('fantasy', 'fantasy', 'curated', 0)
on conflict (slug) do update
  set
    status = case
      when public.idea_tags.status = 'hidden' then public.idea_tags.status
      else 'curated'
    end,
    name = excluded.name;

-- Backfill usage from existing ideas
select public.recompute_idea_tag_usage();
