-- =============================================================================
-- Contributions memorial: credits that never disappear with live data
-- Self-contained: creates project_contributions if missing, then hardens it.
-- Prerequisites: profiles + projects tables (from tasks/schema SQL).
-- Safe to re-run.
--
-- Goals:
--  * Completing / archiving a project does NOT erase credits
--  * Deleting a project does NOT cascade-wipe credits (FK → SET NULL + title snapshot)
--  * Task completions auto-record durable development credits
--  * Showcase approvals can record durable marketing credits (via RPC)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Base table (same as supabase_project_contributions.sql) if missing
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception
      'profiles table missing. Run supabase/sql/supabase_schema.sql (or your base profiles migration) first.';
  end if;
  if to_regclass('public.projects') is null then
    raise exception
      'projects table missing. Run supabase/sql/supabase_tasks_schema.sql first.';
  end if;
end $$;

create table if not exists project_contributions (
  id uuid primary key default gen_random_uuid(),
  -- Nullable so credits can survive project deletion / site-wide credits
  project_id uuid references projects(id) on delete set null,
  -- Account holder (required for development / marketing / community)
  user_id uuid references profiles(id) on delete set null,
  -- Guest display name (donations only when user_id is null)
  display_name text,
  -- Top-level section: donations | development | marketing | community
  category text not null
    check (category in ('donations', 'development', 'marketing', 'community')),
  subcategory text,
  is_anonymous boolean not null default false,
  amount_cents integer
    check (amount_cents is null or amount_cents >= 0),
  role_label text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_contributions_account_rule check (
    category = 'donations'
    or user_id is not null
  )
);

create index if not exists idx_project_contributions_project
  on project_contributions (project_id, category, sort_order);

create index if not exists idx_project_contributions_user
  on project_contributions (user_id)
  where user_id is not null;

alter table if exists donations
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists idx_donations_project
  on donations (project_id)
  where project_id is not null;

alter table project_contributions enable row level security;

-- Staff write policies (public read applied below with archived_at filter)
do $$
begin
  drop policy if exists "Staff can insert project contributions" on project_contributions;
  create policy "Staff can insert project contributions"
    on project_contributions for insert
    to authenticated
    with check (public.is_project_staff());

  drop policy if exists "Staff can update project contributions" on project_contributions;
  create policy "Staff can update project contributions"
    on project_contributions for update
    to authenticated
    using (public.is_project_staff());

  drop policy if exists "Staff can delete project contributions" on project_contributions;
  create policy "Staff can delete project contributions"
    on project_contributions for delete
    to authenticated
    using (public.is_project_staff());
exception
  when undefined_function then
    raise notice 'is_project_staff() missing — staff policies skipped. Run moderation/tasks staff helpers first.';
  when others then
    raise notice 'staff policies skipped: %', sqlerrm;
end $$;

comment on table project_contributions is
  'Permanent public credits. Memorial ledger for Contributors pages.';

-- ---------------------------------------------------------------------------
-- Schema: snapshots + source key (idempotent upserts)
-- ---------------------------------------------------------------------------
alter table if exists project_contributions
  add column if not exists source_key text;

alter table if exists project_contributions
  add column if not exists project_title_snapshot text;

alter table if exists project_contributions
  add column if not exists username_snapshot text;

comment on column project_contributions.source_key is
  'Stable idempotency key, e.g. task-claim:{id}, showcase:{id}, manual:{id}';
comment on column project_contributions.project_title_snapshot is
  'Project title at credit time — survives project rename/delete';
comment on column project_contributions.username_snapshot is
  'Username / display name at credit time';

-- Unique source keys (nulls allowed for legacy rows)
create unique index if not exists idx_project_contributions_source_key
  on project_contributions (source_key)
  where source_key is not null;

-- Allow site-wide credits (e.g. Showcase with no project)
alter table project_contributions
  alter column project_id drop not null;

-- Soft-archive instead of hard delete for memorial integrity
alter table if exists project_contributions
  add column if not exists archived_at timestamptz;

comment on column project_contributions.archived_at is
  'When set, credit is hidden from public memorial (staff only). Prefer never archive.';

-- Replace cascade-on-project-delete with SET NULL so credits remain
do $$
declare
  conname text;
begin
  select c.conname into conname
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  where t.relname = 'project_contributions'
    and c.contype = 'f'
    and pg_get_constraintdef(c.oid) ilike '%project_id%';
  if conname is not null then
    execute format(
      'alter table project_contributions drop constraint %I',
      conname
    );
  end if;
exception
  when others then
    raise notice 'project_id FK drop skipped: %', sqlerrm;
end $$;

alter table project_contributions
  drop constraint if exists project_contributions_project_id_fkey;

alter table project_contributions
  add constraint project_contributions_project_id_fkey
  foreign key (project_id) references projects(id) on delete set null;

-- Backfill title snapshots from live projects where missing
update project_contributions pc
set project_title_snapshot = coalesce(
  pc.project_title_snapshot,
  p.title,
  p.slug
)
from projects p
where pc.project_id = p.id
  and (pc.project_title_snapshot is null or trim(pc.project_title_snapshot) = '');

-- Public read: hide archived only
drop policy if exists "Public can read project contributions" on project_contributions;
create policy "Public can read project contributions"
  on project_contributions for select
  using (archived_at is null);

-- Staff still full read including archived
drop policy if exists "Staff can read all project contributions" on project_contributions;
create policy "Staff can read all project contributions"
  on project_contributions for select
  to authenticated
  using (public.is_project_staff());

-- Prefer soft-archive over hard delete (staff may still delete spam)
-- (existing staff insert/update/delete policies remain)

-- ---------------------------------------------------------------------------
-- RPC: ensure a durable contribution row (idempotent by source_key)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_project_contribution(
  p_project_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_category text,
  p_subcategory text default null,
  p_role_label text default null,
  p_source_key text default null,
  p_project_title text default null,
  p_username text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_title text;
  v_display text;
  v_username text;
begin
  if p_category is null
     or p_category not in ('donations', 'development', 'marketing', 'community') then
    raise exception 'Invalid contribution category';
  end if;

  -- Non-donation rows need a user
  if p_category <> 'donations' and p_user_id is null then
    raise exception 'Account required for this contribution category';
  end if;

  v_display := nullif(trim(coalesce(p_display_name, '')), '');
  v_username := nullif(trim(coalesce(p_username, '')), '');

  if v_display is null and p_user_id is not null then
    select coalesce(nullif(trim(username), ''), 'Contributor')
      into v_display
    from profiles
    where id = p_user_id;
  end if;
  v_display := coalesce(v_display, 'Contributor');

  if v_username is null and p_user_id is not null then
    select nullif(trim(username), '') into v_username
    from profiles where id = p_user_id;
  end if;

  v_title := nullif(trim(coalesce(p_project_title, '')), '');
  if v_title is null and p_project_id is not null then
    select coalesce(nullif(trim(title), ''), nullif(trim(slug), ''), 'Project')
      into v_title
    from projects
    where id = p_project_id;
  end if;

  if p_source_key is not null and trim(p_source_key) <> '' then
    select id into v_id
    from project_contributions
    where source_key = trim(p_source_key)
    limit 1;

    if v_id is not null then
      -- Refresh snapshots if empty; never drop the credit
      update project_contributions
      set
        display_name = coalesce(nullif(trim(display_name), ''), v_display),
        username_snapshot = coalesce(username_snapshot, v_username),
        project_title_snapshot = coalesce(project_title_snapshot, v_title),
        project_id = coalesce(project_id, p_project_id),
        archived_at = null,
        updated_at = now()
      where id = v_id;
      return v_id;
    end if;
  end if;

  insert into project_contributions (
    project_id,
    user_id,
    display_name,
    category,
    subcategory,
    role_label,
    source_key,
    project_title_snapshot,
    username_snapshot,
    is_anonymous,
    sort_order
  ) values (
    p_project_id,
    p_user_id,
    v_display,
    p_category,
    nullif(trim(coalesce(p_subcategory, '')), ''),
    nullif(trim(coalesce(p_role_label, '')), ''),
    nullif(trim(coalesce(p_source_key, '')), ''),
    v_title,
    v_username,
    false,
    0
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ensure_project_contribution(
  uuid, uuid, text, text, text, text, text, text, text
) from public;
grant execute on function public.ensure_project_contribution(
  uuid, uuid, text, text, text, text, text, text, text
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Auto-record development credit when a task claim is Completed
-- ---------------------------------------------------------------------------
create or replace function public.trg_task_claim_memorial_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_category text;
  v_sub text;
  v_title text;
  v_username text;
begin
  if upper(trim(coalesce(new.status, ''))) <> 'COMPLETED' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and upper(trim(coalesce(old.status, ''))) = 'COMPLETED' then
    return new;
  end if;
  if new.user_id is null then
    return new;
  end if;

  select t.project_id, t.category
    into v_project_id, v_category
  from tasks t
  where t.id = new.task_id;

  if v_project_id is null then
    return new;
  end if;

  -- Map common task categories to development subcategories
  v_sub := case lower(trim(coalesce(v_category, '')))
    when 'code' then 'Coding'
    when 'coding' then 'Coding'
    when 'art' then 'Art'
    when 'art / visual design' then 'Art'
    when 'design' then 'Design'
    when 'models' then 'Models'
    when 'model' then 'Models'
    when 'audio' then 'Audio'
    when 'sound' then 'Audio'
    when 'writing' then 'Writing'
    when 'qa' then 'QA / Testing'
    when 'testing' then 'QA / Testing'
    when 'qa / testing' then 'QA / Testing'
    when 'server' then 'Server Design'
    when 'server design' then 'Server Design'
    else 'Other'
  end;

  select coalesce(nullif(trim(title), ''), nullif(trim(slug), ''), 'Project')
    into v_title
  from projects
  where id = v_project_id;

  select nullif(trim(username), '') into v_username
  from profiles where id = new.user_id;

  perform public.ensure_project_contribution(
    v_project_id,
    new.user_id,
    coalesce(v_username, 'Contributor'),
    'development',
    v_sub,
    null,
    'task-claim:' || new.id::text,
    v_title,
    v_username
  );

  return new;
end;
$$;

-- Trigger + backfill only if task tables exist
do $$
begin
  if to_regclass('public.task_claims') is null
     or to_regclass('public.tasks') is null then
    raise notice 'tasks/task_claims missing — memorial trigger/backfill skipped';
    return;
  end if;

  drop trigger if exists trg_task_claim_memorial_credit on task_claims;
  create trigger trg_task_claim_memorial_credit
    after insert or update of status on task_claims
    for each row
    execute function public.trg_task_claim_memorial_credit();

  insert into project_contributions (
    project_id,
    user_id,
    display_name,
    category,
    subcategory,
    source_key,
    project_title_snapshot,
    username_snapshot,
    is_anonymous,
    sort_order
  )
  select distinct on (c.id)
    t.project_id,
    c.user_id,
    coalesce(nullif(trim(p.username), ''), 'Contributor'),
    'development',
    case lower(trim(coalesce(t.category, '')))
      when 'code' then 'Coding'
      when 'coding' then 'Coding'
      when 'art' then 'Art'
      when 'art / visual design' then 'Art'
      when 'design' then 'Design'
      when 'models' then 'Models'
      when 'model' then 'Models'
      when 'audio' then 'Audio'
      when 'sound' then 'Audio'
      when 'writing' then 'Writing'
      when 'qa' then 'QA / Testing'
      when 'testing' then 'QA / Testing'
      when 'qa / testing' then 'QA / Testing'
      when 'server' then 'Server Design'
      when 'server design' then 'Server Design'
      else 'Other'
    end,
    'task-claim:' || c.id::text,
    coalesce(nullif(trim(pr.title), ''), nullif(trim(pr.slug), ''), 'Project'),
    nullif(trim(p.username), ''),
    false,
    0
  from task_claims c
  join tasks t on t.id = c.task_id
  left join profiles p on p.id = c.user_id
  left join projects pr on pr.id = t.project_id
  where upper(trim(c.status)) = 'COMPLETED'
    and c.user_id is not null
    and t.project_id is not null
    and not exists (
      select 1 from project_contributions pc
      where pc.source_key = 'task-claim:' || c.id::text
    );

  insert into project_contributions (
    project_id,
    user_id,
    display_name,
    category,
    subcategory,
    source_key,
    project_title_snapshot,
    username_snapshot,
    is_anonymous,
    sort_order
  )
  select distinct on (c.id)
    t.project_id,
    c.user_id,
    coalesce(nullif(trim(p.username), ''), 'Contributor'),
    'development',
    case lower(trim(coalesce(t.category, '')))
      when 'code' then 'Coding'
      when 'coding' then 'Coding'
      when 'art' then 'Art'
      else 'Other'
    end,
    'task-claim:' || c.id::text,
    coalesce(nullif(trim(pr.title), ''), nullif(trim(pr.slug), ''), 'Project'),
    nullif(trim(p.username), ''),
    false,
    0
  from tasks t
  join task_claims c on c.task_id = t.id and c.user_id is not null
  left join profiles p on p.id = c.user_id
  left join projects pr on pr.id = t.project_id
  where upper(trim(t.status)) = 'COMPLETED'
    and t.project_id is not null
    and not exists (
      select 1 from project_contributions pc
      where pc.source_key = 'task-claim:' || c.id::text
    );
exception
  when others then
    raise notice 'task memorial trigger/backfill skipped: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
