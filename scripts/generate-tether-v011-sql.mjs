/**
 * Writes supabase/sql/supabase_tether_task_tree_v011.sql from the v0.11 tree.
 * Staging-only upsert for Tether-4 and Tether-5. Does not write public rows.
 * Run: node scripts/generate-tether-v011-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TETHER_V011_PROJECT_SLUG,
  TETHER_V011_TASKS,
  TETHER_V011_VERSION,
  buildTetherV011Description,
  tetherV011Difficulty,
  tetherV011StaffOnly,
  tetherV011Subtasks,
  tetherV011Title,
} from '../src/data/tetherTaskTreeV011.js';

function sqlStr(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return sqlStr(JSON.stringify(value));
}

const rows = TETHER_V011_TASKS.map((task) => {
  const title = tetherV011Title(task);
  if (title.length > 120) {
    throw new Error(`Title over 120 chars: ${title}`);
  }
  const desc = buildTetherV011Description(task);
  if (desc.length > 2000) {
    throw new Error(`Description over 2000 chars: ${task.code} (${desc.length})`);
  }
  if (task.state === 'Parked') {
    throw new Error(`Parked is not allowed in v0.11: ${task.code}`);
  }
  if (String(task.code).startsWith('Tether-11')) {
    throw new Error(`Epic 11 is out of this pass: ${task.code}`);
  }
  return {
    code: task.code,
    parentCode: task.parentCode,
    title,
    description: desc,
    category: task.skill,
    difficulty: tetherV011Difficulty(task.size),
    estimatedEffort: task.size,
    staffOnly: tetherV011StaffOnly(task),
    sortOrder: task.sortOrder,
    blockedByCode: task.blockedByCode || null,
    subtasks: tetherV011Subtasks(task),
  };
});

const values = rows
  .map(
    (r) =>
      `    (${sqlStr(r.code)}, ${sqlStr(r.parentCode)}, ${sqlStr(r.title)}, ${sqlStr(r.description)}, ${sqlStr(r.category)}, ${sqlStr(r.difficulty)}, ${sqlStr(r.estimatedEffort)}, ${r.staffOnly ? 'true' : 'false'}, ${r.sortOrder}, ${sqlStr(r.blockedByCode)}, ${sqlJson(r.subtasks)}::jsonb)`
  )
  .join(',\n');

const sql = `-- Tether-4 and Tether-5 from Tether_Task_Breakdown_${TETHER_V011_VERSION} → staging board only.
-- Upsert by title / ID prefix. Does not publish. Does not write public rows.
-- Does not add Epic 11. Does not nest Tether-5 under Tether-4.
-- Snatch is the first enemy (5.1). Latch is 5.2. Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v011.sql

do $$
declare
  v_project uuid;
  v_row record;
  v_id uuid;
  v_parent uuid;
  v_created int := 0;
  v_updated int := 0;
  v_archived_dupes int := 0;
begin
  select id into v_project
  from public.projects
  where slug = ${sqlStr(TETHER_V011_PROJECT_SLUG)}
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found (slug=${TETHER_V011_PROJECT_SLUG}).';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;

  create temporary table if not exists tmp_tether_v011 (
    code text primary key,
    parent_code text,
    title text not null,
    description text,
    category text,
    difficulty text,
    estimated_effort text,
    staff_only boolean not null,
    sort_order integer not null,
    blocked_by_code text,
    subtasks jsonb not null default '[]'::jsonb
  ) on commit drop;

  delete from tmp_tether_v011;

  insert into tmp_tether_v011 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_code, subtasks
  ) values
${values};

  -- Parents before children: epics, then mediums, then smalls.
  for v_row in
    select *
    from tmp_tether_v011
    order by
      (parent_code is not null)::int,
      char_length(code),
      sort_order,
      code
  loop
    v_parent := null;
    if v_row.parent_code is not null then
      select t.id into v_parent
      from public.tasks t
      where t.project_id = v_project
        and t.board_scope = 'staging'
        and t.title like v_row.parent_code || ' %'
        and t.title not like v_row.parent_code || '.%'
      order by t.archived_at nulls first, t.created_at
      limit 1;
    end if;

    select t.id into v_id
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and (
        t.title = v_row.title
        or (
          t.title like v_row.code || ' %'
          and t.title not like v_row.code || '.%'
        )
      )
    order by t.archived_at nulls first, t.created_at
    limit 1;

    if v_id is null then
      insert into public.tasks (
        project_id, parent_task_id, title, description, category, difficulty,
        estimated_effort, status, subtasks, staff_only, board_scope, sort_order
      ) values (
        v_project, v_parent, v_row.title, v_row.description, v_row.category, v_row.difficulty,
        v_row.estimated_effort, 'ToDo', v_row.subtasks, v_row.staff_only, 'staging', v_row.sort_order
      )
      returning id into v_id;
      v_created := v_created + 1;
    else
      update public.tasks set
        title = v_row.title,
        description = v_row.description,
        category = v_row.category,
        difficulty = v_row.difficulty,
        estimated_effort = v_row.estimated_effort,
        subtasks = v_row.subtasks,
        staff_only = v_row.staff_only,
        parent_task_id = v_parent,
        sort_order = v_row.sort_order,
        archived_at = null
      where id = v_id
        and board_scope = 'staging';
      v_updated := v_updated + 1;
    end if;
  end loop;

  -- Archive leftover staging cards that share an ID but are not the upserted title
  -- (old Latch-as-first-enemy / First utility enemy twins).
  with keep as (
    select src.code, src.title,
      (
        select t.id
        from public.tasks t
        where t.project_id = v_project
          and t.board_scope = 'staging'
          and (
            t.title = src.title
            or (
              t.title like src.code || ' %'
              and t.title not like src.code || '.%'
            )
          )
        order by t.archived_at nulls first, t.created_at
        limit 1
      ) as keep_id
    from tmp_tether_v011 src
  ),
  extras as (
    select distinct t.id
    from public.tasks t
    join keep k
      on t.title = k.title
      or (
        t.title like k.code || ' %'
        and t.title not like k.code || '.%'
      )
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and t.id is distinct from k.keep_id
      and t.archived_at is null
  )
  update public.tasks t
  set archived_at = now()
  from extras e
  where t.id = e.id
    and t.board_scope = 'staging';

  get diagnostics v_archived_dupes = row_count;

  -- Tether-5 does not block Tether-4 or Tether-6. Tether-4/6 do not block Tether-5.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and b.project_id = v_project
    and a.board_scope = 'staging'
    and b.board_scope = 'staging'
    and (
      (a.title ~ '^Tether-5([. ]|$)' and b.title ~ '^Tether-4([. ]|$)')
      or (a.title ~ '^Tether-4([. ]|$)' and b.title ~ '^Tether-5([. ]|$)')
      or (a.title ~ '^Tether-5([. ]|$)' and b.title ~ '^Tether-6([. ]|$)')
      or (a.title ~ '^Tether-6([. ]|$)' and b.title ~ '^Tether-5([. ]|$)')
    );

  raise notice 'Tether v0.11 staging upsert created=% updated=% archived_dupes=%',
    v_created, v_updated, v_archived_dupes;

  begin
    execute 'alter table public.tasks enable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;
exception
  when others then
    begin
      execute 'alter table public.tasks enable trigger trg_protect_task_staff_only';
    exception
      when undefined_object then null;
    end;
    raise;
end $$;
`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'supabase/sql/supabase_tether_task_tree_v011.sql');
writeFileSync(out, sql, 'utf8');
console.log(`Wrote ${out} (${rows.length} tasks)`);
