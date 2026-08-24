-- =============================================================================
-- Task Board scope: Public vs Staging
-- Staging is a staff-only preparation board. Volunteers never see those tasks.
-- Publish copies an Epic or Medium (and nested work) onto the public board.
--
-- Run AFTER supabase_task_staff_only.sql
-- Safe to re-run.
-- =============================================================================

alter table if exists public.tasks
  add column if not exists board_scope text not null default 'public';

alter table if exists public.tasks
  drop constraint if exists tasks_board_scope_check;

alter table if exists public.tasks
  add constraint tasks_board_scope_check
  check (board_scope in ('public', 'staging'));

alter table if exists public.tasks
  add column if not exists sort_order integer not null default 0;

alter table if exists public.tasks
  add column if not exists published_task_id uuid references public.tasks(id) on delete set null;

alter table if exists public.tasks
  add column if not exists published_at timestamptz;

create index if not exists idx_tasks_project_board_scope
  on public.tasks (project_id, board_scope, parent_task_id, sort_order);

comment on column public.tasks.board_scope is
  'public = live volunteer board; staging = staff-only preparation (never shown to volunteers).';
comment on column public.tasks.sort_order is
  'Sibling order within a parent (or among top-level tasks). Lower sorts first.';
comment on column public.tasks.published_task_id is
  'When this Staging task has been published, the matching public task id.';
comment on column public.tasks.published_at is
  'When this Staging task was last published to the public board.';

-- ---------------------------------------------------------------------------
-- RLS: volunteers see public rows only; staff can also read staging
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read tasks" on public.tasks;
drop policy if exists "Public can read public tasks" on public.tasks;
create policy "Public can read public tasks" on public.tasks
  for select
  using (coalesce(board_scope, 'public') = 'public');

drop policy if exists "Staff can read staging tasks" on public.tasks;
create policy "Staff can read staging tasks" on public.tasks
  for select
  using (public.is_project_staff());

-- ---------------------------------------------------------------------------
-- Parent must live on the same board (Staging vs Public)
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

  if coalesce(v_parent.board_scope, 'public')
     is distinct from coalesce(new.board_scope, 'public') then
    raise exception 'Parent task must be on the same board (Staging or Public)';
  end if;

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

  v_parent_depth := public.task_nesting_depth(new.parent_task_id);
  if v_parent_depth >= 2 then
    raise exception 'Maximum nesting is 3 levels (Epic → Medium → Small). Cannot add under a Small task.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_task_parent on public.tasks;
create trigger trg_enforce_task_parent
  before insert or update of parent_task_id, project_id, board_scope
  on public.tasks
  for each row
  execute function public.enforce_task_parent();

-- ---------------------------------------------------------------------------
-- Do not move rows between Staging and Public (publish copies instead)
-- ---------------------------------------------------------------------------
create or replace function public.protect_task_board_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(new.board_scope, 'public')
         is distinct from coalesce(old.board_scope, 'public') then
    raise exception 'Cannot move a task between Staging and Public. Publish from Staging to create live copies.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_task_board_scope on public.tasks;
create trigger trg_protect_task_board_scope
  before update of board_scope on public.tasks
  for each row
  execute function public.protect_task_board_scope();

-- ---------------------------------------------------------------------------
-- Staging tasks cannot be claimed (anyone)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_no_staging_task_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tasks t
    where t.id = new.task_id
      and coalesce(t.board_scope, 'public') = 'staging'
  ) then
    raise exception 'STAGING_TASK: Staging tasks cannot be claimed. Publish them to the public board first.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_no_staging_task_claim on public.task_claims;
create trigger trg_enforce_no_staging_task_claim
  before insert on public.task_claims
  for each row
  execute function public.enforce_no_staging_task_claim();

create or replace function public.enforce_no_staging_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tasks t
    where t.id = new.task_id
      and coalesce(t.board_scope, 'public') = 'staging'
  ) then
    raise exception 'STAGING_TASK: Staging tasks cannot be joined. Publish them to the public board first.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_no_staging_join_request on public.claim_join_requests;
create trigger trg_enforce_no_staging_join_request
  before insert on public.claim_join_requests
  for each row
  execute function public.enforce_no_staging_join_request();

-- ---------------------------------------------------------------------------
-- Publish a Staging Epic or Medium (and nested work) onto the public board
-- ---------------------------------------------------------------------------
create or replace function public.publish_staging_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_root tasks%rowtype;
  v_src tasks%rowtype;
  v_copy tasks%rowtype;
  v_parent tasks%rowtype;
  v_depth int := 0;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_public_parent uuid;
  v_map jsonb := '{}'::jsonb;
  v_created jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_created_count int := 0;
  v_dep record;
  v_from uuid;
  v_to uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_project_staff() then
    raise exception 'Only staff can publish staging tasks';
  end if;

  select * into v_root from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if coalesce(v_root.board_scope, 'public') is distinct from 'staging' then
    raise exception 'Only Staging tasks can be published';
  end if;

  begin
    v_depth := public.task_nesting_depth(p_task_id);
  exception when undefined_function then
    v_depth := case when v_root.parent_task_id is null then 0 else 1 end;
  end;

  if v_depth > 1 then
    raise exception 'Publish a Medium or Epic. Small tasks go with their parent.';
  end if;

  -- Medium: also publish the parent Epic (without unpublished siblings)
  if v_root.parent_task_id is not null then
    v_ids := array_append(v_ids, v_root.parent_task_id);
  end if;

  v_ids := array_append(v_ids, p_task_id);

  for v_id in
    with recursive tree as (
      select id from public.tasks where id = p_task_id
      union all
      select c.id
      from public.tasks c
      join tree t on c.parent_task_id = t.id
      where coalesce(c.board_scope, 'public') = 'staging'
    )
    select id from tree where id is distinct from p_task_id
  loop
    v_ids := array_append(v_ids, v_id);
  end loop;

  for v_src in
    select *
    from public.tasks t
    where t.id = any (v_ids)
    order by public.task_nesting_depth(t.id), t.sort_order, t.created_at, t.id
  loop
    if coalesce(v_src.board_scope, 'public') is distinct from 'staging' then
      continue;
    end if;

    if v_src.published_task_id is not null then
      select * into v_copy from public.tasks
      where id = v_src.published_task_id
        and coalesce(board_scope, 'public') = 'public';
      if found then
        v_map := v_map || jsonb_build_object(v_src.id::text, v_copy.id::text);
        v_skipped := v_skipped || jsonb_build_array(
          jsonb_build_object(
            'staging_id', v_src.id,
            'public_id', v_copy.id,
            'title', v_src.title
          )
        );
        continue;
      end if;
    end if;

    v_public_parent := null;
    if v_src.parent_task_id is not null then
      v_public_parent := nullif(v_map ->> v_src.parent_task_id::text, '')::uuid;
    end if;

    insert into public.tasks (
      project_id,
      parent_task_id,
      title,
      description,
      category,
      difficulty,
      status,
      estimated_effort,
      subtasks,
      created_by,
      board_scope,
      staff_only,
      sort_order,
      dependency_override
    ) values (
      v_src.project_id,
      v_public_parent,
      v_src.title,
      v_src.description,
      v_src.category,
      v_src.difficulty,
      'ToDo',
      v_src.estimated_effort,
      coalesce(v_src.subtasks, '[]'::jsonb),
      v_uid,
      'public',
      coalesce(v_src.staff_only, false),
      coalesce(v_src.sort_order, 0),
      false
    )
    returning * into v_copy;

    v_map := v_map || jsonb_build_object(v_src.id::text, v_copy.id::text);
    v_created := v_created || jsonb_build_array(
      jsonb_build_object(
        'staging_id', v_src.id,
        'public_id', v_copy.id,
        'title', v_src.title,
        'staff_only', coalesce(v_copy.staff_only, false)
      )
    );
    v_created_count := v_created_count + 1;

    update public.tasks
    set published_task_id = v_copy.id,
        published_at = now()
    where id = v_src.id;
  end loop;

  -- Copy blocked-by edges when both ends published in this tree
  begin
    for v_dep in
      select d.task_id, d.blocks_on_task_id
      from public.task_dependencies d
      where d.task_id = any (v_ids)
        and d.blocks_on_task_id = any (v_ids)
    loop
      v_from := nullif(v_map ->> v_dep.task_id::text, '')::uuid;
      v_to := nullif(v_map ->> v_dep.blocks_on_task_id::text, '')::uuid;
      if v_from is null or v_to is null then
        continue;
      end if;
      insert into public.task_dependencies (task_id, blocks_on_task_id)
      values (v_from, v_to)
      on conflict (task_id, blocks_on_task_id) do nothing;
    end loop;
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  begin
    insert into activity_log (
      project_id, user_id, action, target_type, target_id, target_title, metadata
    ) values (
      v_root.project_id,
      v_uid,
      'published',
      'task',
      coalesce(nullif(v_map ->> p_task_id::text, '')::uuid, p_task_id),
      v_root.title,
      jsonb_build_object(
        'staging_task_id', p_task_id,
        'created_count', v_created_count,
        'staff_only', coalesce(v_root.staff_only, false)
      )
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'staging_task_id', p_task_id,
    'public_task_id', nullif(v_map ->> p_task_id::text, '')::uuid,
    'created_count', v_created_count,
    'created', v_created,
    'skipped', v_skipped
  );
end;
$$;

grant execute on function public.publish_staging_task(uuid) to authenticated;

comment on function public.publish_staging_task(uuid) is
  'Staff: copy a Staging Epic or Medium (and nested tasks) onto the public board. Staff Only is preserved. Staging rows stay in Staging.';
