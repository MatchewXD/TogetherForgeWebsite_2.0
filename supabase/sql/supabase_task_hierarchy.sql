-- =============================================================================
-- Together Forge — Task hierarchy (Epic → Medium → Small)
-- Run after supabase_tasks_schema.sql
-- Safe to re-run
-- =============================================================================
--
-- Adds parent_task_id (self-FK), max 3 nesting levels (depth 0..2),
-- same-project enforcement, and optional parent progress rollup helpers.
-- Existing tasks.subtasks jsonb checklist is unchanged (quick checklists).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Column + indexes
-- ---------------------------------------------------------------------------
alter table tasks
  add column if not exists parent_task_id uuid references tasks(id) on delete cascade;

create index if not exists idx_tasks_parent on tasks (parent_task_id);
create index if not exists idx_tasks_project_parent on tasks (project_id, parent_task_id);

comment on column tasks.parent_task_id is
  'Optional parent task. Null = top-level (kanban root). Max depth 0..2 (3 levels).';

-- ---------------------------------------------------------------------------
-- 2. Depth helper (root = 0)
-- ---------------------------------------------------------------------------
create or replace function public.task_nesting_depth(p_task_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid := p_task_id;
  v_parent uuid;
  v_depth integer := 0;
begin
  if p_task_id is null then
    return 0;
  end if;

  loop
    select parent_task_id into v_parent from tasks where id = v_id;
    if not found then
      return v_depth;
    end if;
    if v_parent is null then
      return v_depth;
    end if;
    v_depth := v_depth + 1;
    if v_depth > 10 then
      -- safety against cycles
      return v_depth;
    end if;
    v_id := v_parent;
  end loop;
end;
$$;

grant execute on function public.task_nesting_depth(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Enforce parent rules on insert/update
-- ---------------------------------------------------------------------------
create or replace function public.enforce_task_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent tasks%rowtype;
  v_parent_depth integer;
  v_walk uuid;
  v_guard integer := 0;
begin
  if new.parent_task_id is null then
    return new;
  end if;

  if new.parent_task_id = new.id then
    raise exception 'Task cannot be its own parent';
  end if;

  select * into v_parent from tasks where id = new.parent_task_id;
  if not found then
    raise exception 'Parent task not found';
  end if;

  if v_parent.project_id is distinct from new.project_id then
    raise exception 'Parent task must belong to the same project';
  end if;

  -- Cycle check: walk ancestors of parent; none may be new.id
  v_walk := new.parent_task_id;
  while v_walk is not null loop
    if v_walk = new.id then
      raise exception 'Task hierarchy cycle detected';
    end if;
    select parent_task_id into v_walk from tasks where id = v_walk;
    v_guard := v_guard + 1;
    if v_guard > 10 then
      raise exception 'Task hierarchy too deep or cyclic';
    end if;
  end loop;

  -- Max 3 levels: parent depth can be 0 or 1 only (child becomes 1 or 2)
  v_parent_depth := public.task_nesting_depth(new.parent_task_id);
  if v_parent_depth >= 2 then
    raise exception 'Maximum nesting is 3 levels (Epic → Medium → Small). Cannot add under a Small task.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_task_parent on tasks;
create trigger trg_enforce_task_parent
  before insert or update of parent_task_id, project_id
  on tasks
  for each row
  execute function public.enforce_task_parent();

-- ---------------------------------------------------------------------------
-- 4. Child completion rollup (for optional server-side progress)
--    Returns percent of *direct* children that are Completed.
-- ---------------------------------------------------------------------------
create or replace function public.task_child_progress_percent(p_task_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when count(*) = 0 then null
        else round(
          100.0 * count(*) filter (where status = 'Completed') / count(*)
        )::integer
      end
      from tasks
      where parent_task_id = p_task_id
    ),
    null
  );
$$;

grant execute on function public.task_child_progress_percent(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. When a child status changes, touch parent's claim progress if active
--    (keeps parent claim bar in sync for volunteers who claimed the parent).
-- ---------------------------------------------------------------------------
create or replace function public.sync_parent_claim_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_id uuid;
  v_pct integer;
begin
  v_parent_id := coalesce(new.parent_task_id, old.parent_task_id);
  if v_parent_id is null then
    return coalesce(new, old);
  end if;

  v_pct := public.task_child_progress_percent(v_parent_id);
  if v_pct is null then
    return coalesce(new, old);
  end if;

  update task_claims
  set
    progress_percent = v_pct,
    last_activity_at = now()
  where task_id = v_parent_id
    and status = 'Active';

  -- Bubble one level (epic progress from medium tasks)
  update task_claims tc
  set
    progress_percent = public.task_child_progress_percent(t.parent_task_id),
    last_activity_at = now()
  from tasks t
  where t.id = v_parent_id
    and t.parent_task_id is not null
    and tc.task_id = t.parent_task_id
    and tc.status = 'Active'
    and public.task_child_progress_percent(t.parent_task_id) is not null;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_parent_claim_progress on tasks;
create trigger trg_sync_parent_claim_progress
  after insert or update of status, parent_task_id or delete
  on tasks
  for each row
  execute function public.sync_parent_claim_progress();

-- ---------------------------------------------------------------------------
-- Note on RLS
-- Existing policies already cover hierarchy:
--   - Public read tasks
--   - Staff insert/update/delete tasks (including parent_task_id)
--   - Claimants update claimed tasks
-- No extra policies required for parent_task_id.
-- =============================================================================
