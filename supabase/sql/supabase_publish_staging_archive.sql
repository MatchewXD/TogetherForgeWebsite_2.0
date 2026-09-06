-- Publish then remove from Staging (archive staging copies).
-- Run after supabase_task_board_scope.sql. Safe to re-run.

alter table if exists public.tasks
  add column if not exists archived_at timestamptz;

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
  v_archived_count int := 0;
  v_n int := 0;
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

  -- Staging cards that now have a public copy leave the staging board.
  -- Archive the clicked subtree (not delete). Keep a parent Epic on Staging
  -- when unpublished siblings still need it.
  update public.tasks t
  set archived_at = coalesce(t.archived_at, now())
  where t.id = any (v_ids)
    and t.archived_at is null
    and coalesce(t.board_scope, 'public') = 'staging'
    and t.published_task_id is not null
    and t.id is distinct from v_root.parent_task_id;
  get diagnostics v_archived_count = row_count;

  if v_root.parent_task_id is not null then
    if not exists (
      select 1
      from public.tasks c
      where c.parent_task_id = v_root.parent_task_id
        and c.archived_at is null
        and coalesce(c.board_scope, 'public') = 'staging'
    ) then
      update public.tasks t
      set archived_at = coalesce(t.archived_at, now())
      where t.id = v_root.parent_task_id
        and t.archived_at is null
        and coalesce(t.board_scope, 'public') = 'staging'
        and t.published_task_id is not null;
      get diagnostics v_n = row_count;
      v_archived_count := v_archived_count + coalesce(v_n, 0);
    end if;
  end if;

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
        'archived_count', v_archived_count,
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
    'archived_count', v_archived_count,
    'created', v_created,
    'skipped', v_skipped
  );
end;
$$;

grant execute on function public.publish_staging_task(uuid) to authenticated;

comment on function public.publish_staging_task(uuid) is
  'Staff: copy a Staging Epic or Medium (and nested tasks) onto the public board, then archive those Staging rows so they leave the staging board. Staff Only is preserved.';
