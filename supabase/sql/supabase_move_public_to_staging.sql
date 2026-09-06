-- =============================================================================
-- Staff: move a Public Epic or Medium (and nested work) back to Staging.
-- Restores archived staging twins when they exist; otherwise copies to Staging
-- (or flips board_scope in place when the whole public subtree can move).
-- Public cards then leave the public board (archived, or flipped to staging).
-- Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_move_public_to_staging.sql
-- =============================================================================

alter table if exists public.tasks
  add column if not exists archived_at timestamptz;

create index if not exists idx_tasks_published_task_id
  on public.tasks (published_task_id)
  where published_task_id is not null;

create or replace function public.move_public_task_to_staging(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_root public.tasks%rowtype;
  v_src public.tasks%rowtype;
  v_twin public.tasks%rowtype;
  v_copy public.tasks%rowtype;
  v_parent public.tasks%rowtype;
  v_depth int := 0;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_staging_parent uuid;
  v_map jsonb := '{}'::jsonb;
  v_restored int := 0;
  v_created int := 0;
  v_flipped int := 0;
  v_archived int := 0;
  v_n int := 0;
  v_has_twin boolean := false;
  v_extra_siblings boolean := false;
  v_in_place boolean := false;
  v_triggers_off boolean := false;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_project_staff() then
    raise exception 'Only staff can move public tasks back to Staging';
  end if;

  select * into v_root from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if coalesce(v_root.board_scope, 'public') is distinct from 'public' then
    raise exception 'Only Public tasks can be moved to Staging';
  end if;

  if v_root.archived_at is not null then
    raise exception 'That task is not on the public board';
  end if;

  begin
    v_depth := public.task_nesting_depth(p_task_id);
  exception when undefined_function then
    v_depth := case when v_root.parent_task_id is null then 0 else 1 end;
  end;

  if v_depth > 1 then
    raise exception 'Move a Medium or Epic. Small tasks go with their parent.';
  end if;

  v_ids := array_append(v_ids, p_task_id);
  for v_id in
    with recursive tree as (
      select id from public.tasks where id = p_task_id
      union all
      select c.id
      from public.tasks c
      join tree t on c.parent_task_id = t.id
      where coalesce(c.board_scope, 'public') = 'public'
        and c.archived_at is null
    )
    select id from tree where id is distinct from p_task_id
  loop
    v_ids := array_append(v_ids, v_id);
  end loop;

  select exists (
    select 1
    from public.tasks s
    where s.published_task_id = any (v_ids)
      and coalesce(s.board_scope, 'public') = 'staging'
  ) into v_has_twin;

  if v_root.parent_task_id is not null then
    select exists (
      select 1
      from public.tasks c
      where c.parent_task_id = v_root.parent_task_id
        and c.archived_at is null
        and coalesce(c.board_scope, 'public') = 'public'
        and not (c.id = any (v_ids))
    ) into v_extra_siblings;
  end if;

  v_in_place := (not v_has_twin) and (not v_extra_siblings);

  -- Release claims on public cards that will leave the public board.
  update public.task_claims
  set
    status = 'Returned',
    notes = trim(both from coalesce(notes, '') || E'\n' ||
      '[returned: task moved back to Staging]')
  where task_id = any (v_ids)
    and status in ('Active', 'PendingReview');

  begin
    update public.claim_join_requests
    set
      status = 'cancelled',
      resolved_at = coalesce(resolved_at, now()),
      resolved_by = v_uid
    where task_id = any (v_ids)
      and status = 'pending';
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  if v_in_place then
    begin
      execute 'alter table public.tasks disable trigger trg_protect_task_board_scope';
      execute 'alter table public.tasks disable trigger trg_enforce_task_parent';
      v_triggers_off := true;
    exception when undefined_object then
      v_triggers_off := false;
    end;

    update public.tasks
    set
      board_scope = 'staging',
      published_task_id = null,
      published_at = null,
      archived_at = null,
      status = case
        when status = 'InReview' then 'ToDo'
        else status
      end
    where id = any (v_ids);
    get diagnostics v_flipped = row_count;

    if v_root.parent_task_id is not null
       and not v_extra_siblings then
      update public.tasks
      set
        board_scope = 'staging',
        published_task_id = null,
        published_at = null,
        archived_at = null
      where id = v_root.parent_task_id
        and archived_at is null
        and coalesce(board_scope, 'public') = 'public';
      get diagnostics v_n = row_count;
      v_flipped := v_flipped + coalesce(v_n, 0);
    end if;

    if v_triggers_off then
      execute 'alter table public.tasks enable trigger trg_enforce_task_parent';
      execute 'alter table public.tasks enable trigger trg_protect_task_board_scope';
      v_triggers_off := false;
    end if;
  else
    -- Ensure a Staging parent Epic exists when moving a Medium.
    if v_root.parent_task_id is not null then
      select * into v_parent
      from public.tasks
      where id = v_root.parent_task_id;

      select * into v_twin
      from public.tasks
      where published_task_id = v_parent.id
        and coalesce(board_scope, 'public') = 'staging'
      order by archived_at nulls first
      limit 1;

      if found then
        update public.tasks
        set
          archived_at = null,
          board_scope = 'staging',
          title = v_parent.title,
          description = v_parent.description,
          category = v_parent.category,
          staff_only = coalesce(v_parent.staff_only, false),
          sort_order = coalesce(v_parent.sort_order, sort_order)
        where id = v_twin.id
        returning * into v_twin;
        v_staging_parent := v_twin.id;
        v_restored := v_restored + 1;
      else
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
          v_parent.project_id,
          null,
          v_parent.title,
          v_parent.description,
          v_parent.category,
          v_parent.difficulty,
          'ToDo',
          v_parent.estimated_effort,
          coalesce(v_parent.subtasks, '[]'::jsonb),
          v_uid,
          'staging',
          coalesce(v_parent.staff_only, false),
          coalesce(v_parent.sort_order, 0),
          false
        )
        returning * into v_copy;
        v_staging_parent := v_copy.id;
        v_created := v_created + 1;
      end if;

      v_map := v_map || jsonb_build_object(v_parent.id::text, v_staging_parent::text);
    end if;

    for v_src in
      select *
      from public.tasks t
      where t.id = any (v_ids)
      order by public.task_nesting_depth(t.id), t.sort_order, t.created_at, t.id
    loop
      v_staging_parent := null;
      if v_src.parent_task_id is not null then
        v_staging_parent := nullif(v_map ->> v_src.parent_task_id::text, '')::uuid;
      end if;

      select * into v_twin
      from public.tasks
      where published_task_id = v_src.id
        and coalesce(board_scope, 'public') = 'staging'
      order by archived_at nulls first
      limit 1;

      if found then
        update public.tasks
        set
          archived_at = null,
          board_scope = 'staging',
          parent_task_id = coalesce(v_staging_parent, parent_task_id),
          title = v_src.title,
          description = v_src.description,
          category = v_src.category,
          staff_only = coalesce(v_src.staff_only, false),
          subtasks = coalesce(v_src.subtasks, subtasks),
          sort_order = coalesce(v_src.sort_order, sort_order),
          status = case
            when v_src.status = 'InReview' then 'ToDo'
            else v_src.status
          end,
          published_task_id = null,
          published_at = null
        where id = v_twin.id
        returning * into v_twin;
        v_map := v_map || jsonb_build_object(v_src.id::text, v_twin.id::text);
        v_restored := v_restored + 1;
      else
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
          v_staging_parent,
          v_src.title,
          v_src.description,
          v_src.category,
          v_src.difficulty,
          case when v_src.status = 'InReview' then 'ToDo' else v_src.status end,
          v_src.estimated_effort,
          coalesce(v_src.subtasks, '[]'::jsonb),
          v_uid,
          'staging',
          coalesce(v_src.staff_only, false),
          coalesce(v_src.sort_order, 0),
          false
        )
        returning * into v_copy;
        v_map := v_map || jsonb_build_object(v_src.id::text, v_copy.id::text);
        v_created := v_created + 1;
      end if;

      update public.tasks
      set archived_at = coalesce(archived_at, now())
      where id = v_src.id
        and archived_at is null;
      get diagnostics v_n = row_count;
      v_archived := v_archived + coalesce(v_n, 0);
    end loop;

    if v_root.parent_task_id is not null and not v_extra_siblings then
      update public.tasks
      set archived_at = coalesce(archived_at, now())
      where id = v_root.parent_task_id
        and archived_at is null
        and coalesce(board_scope, 'public') = 'public';
      get diagnostics v_n = row_count;
      v_archived := v_archived + coalesce(v_n, 0);
    end if;
  end if;

  begin
    insert into public.activity_log (
      project_id, user_id, action, target_type, target_id, target_title, metadata
    ) values (
      v_root.project_id,
      v_uid,
      'moved_to_staging',
      'task',
      coalesce(nullif(v_map ->> p_task_id::text, '')::uuid, p_task_id),
      v_root.title,
      jsonb_build_object(
        'public_task_id', p_task_id,
        'restored_count', v_restored,
        'created_count', v_created,
        'flipped_count', v_flipped,
        'archived_count', v_archived
      )
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'public_task_id', p_task_id,
    'staging_task_id', coalesce(
      nullif(v_map ->> p_task_id::text, '')::uuid,
      case when v_in_place then p_task_id else null end
    ),
    'restored_count', v_restored,
    'created_count', v_created,
    'flipped_count', v_flipped,
    'archived_count', v_archived
  );
exception
  when others then
    if v_triggers_off then
      begin
        execute 'alter table public.tasks enable trigger trg_enforce_task_parent';
      exception when others then null;
      end;
      begin
        execute 'alter table public.tasks enable trigger trg_protect_task_board_scope';
      exception when others then null;
      end;
    end if;
    raise;
end;
$$;

grant execute on function public.move_public_task_to_staging(uuid) to authenticated;

comment on function public.move_public_task_to_staging(uuid) is
  'Staff: move a Public Epic or Medium (and nested tasks) back to Staging. Public copies leave the public board. Active claims are returned.';
