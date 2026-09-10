/**
 * Writes Tether-6 v0.14 SQL from the tree.
 *   supabase/sql/supabase_tether_task_tree_v014.sql         — staging upsert
 *   supabase/sql/supabase_tether_task_tree_v014_public.sql  — public in-place update
 * Run: node scripts/generate-tether-v014-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TETHER_V014_PROJECT_SLUG,
  TETHER_V014_TASKS,
  TETHER_V014_VERSION,
  buildTetherV014Description,
  tetherV014Difficulty,
  tetherV014StaffOnly,
  tetherV014Subtasks,
  tetherV014Title,
} from '../src/data/tetherTaskTreeV014.js';

function sqlStr(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return sqlStr(JSON.stringify(value));
}

function sqlTextArray(codes) {
  const list = (codes || []).filter(Boolean);
  if (!list.length) return `'{}'::text[]`;
  return `ARRAY[${list.map(sqlStr).join(', ')}]::text[]`;
}

function descriptionForScope(task, boardScope) {
  if (boardScope !== 'public') return buildTetherV014Description(task);
  let extra = task.extra || '';
  extra = extra
    .replace(/Staging only\. Do not publish\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (task.code === 'Tether-6') {
    extra = `Source: Tether_Task_Breakdown_${TETHER_V014_VERSION}.`;
  }
  return buildTetherV014Description({ ...task, extra: extra || undefined });
}

function rowsForScope(boardScope) {
  const source =
    boardScope === 'public'
      ? TETHER_V014_TASKS.filter((task) => String(task.code).startsWith('Tether-6'))
      : TETHER_V014_TASKS;
  return source.map((task) => {
    const title = tetherV014Title(task);
    if (title.length > 120) {
      throw new Error(`Title over 120 chars: ${title}`);
    }
    const desc = descriptionForScope(task, boardScope);
    if (desc.length > 2000) {
      throw new Error(`Description over 2000 chars: ${task.code} (${desc.length})`);
    }
    if (task.state === 'Parked') {
      throw new Error(`Parked is not allowed in v0.14: ${task.code}`);
    }
    if (task.code === 'Tether-5.6' || String(task.code).startsWith('Tether-5.6.')) {
      throw new Error(`Tether-5.6 is out of this pass: ${task.code}`);
    }
    return {
      code: task.code,
      parentCode: task.parentCode,
      title,
      description: desc,
      category: task.skill,
      difficulty: tetherV014Difficulty(task.size),
      estimatedEffort: task.size,
      staffOnly: tetherV014StaffOnly(task),
      sortOrder: task.sortOrder,
      blockedByCodes: task.blockedByCodes || (task.blockedByCode ? [task.blockedByCode] : []),
      subtasks: tetherV014Subtasks(task),
      status: task.code === 'Tether-CD.3' ? 'InProgress' : 'ToDo',
    };
  });
}

function valuesSql(rows) {
  return rows
    .map(
      (r) =>
        `    (${sqlStr(r.code)}, ${sqlStr(r.parentCode)}, ${sqlStr(r.title)}, ${sqlStr(r.description)}, ${sqlStr(r.category)}, ${sqlStr(r.difficulty)}, ${sqlStr(r.estimatedEffort)}, ${r.staffOnly ? 'true' : 'false'}, ${r.sortOrder}, ${sqlTextArray(r.blockedByCodes)}, ${sqlJson(r.subtasks)}::jsonb, ${sqlStr(r.status)})`
    )
    .join(',\n');
}

function remapSql(boardScope) {
  return `
  -- Remap leftover IDs whose meaning changed (${boardScope} only).
  update public.tasks t
  set title = 'Tether-6.2.1 Map 1 spine'
  where t.project_id = v_project
    and t.board_scope = ${sqlStr(boardScope)}
    and t.title like 'Tether-6.1.2 %'
    and t.title not like 'Tether-6.1.2.%'
    and t.title ~* 'Level_01_Surface|Level 01|Block out';

  update public.tasks t
  set title = 'Tether-6.6 Unofficial maps'
  where t.project_id = v_project
    and t.board_scope = ${sqlStr(boardScope)}
    and t.title like 'Tether-6.3 %'
    and t.title not like 'Tether-6.3.%'
    and t.title ~* 'unofficial|community map';

  update public.tasks t
  set title = 'Tether-6.1 Modular kit'
  where t.project_id = v_project
    and t.board_scope = ${sqlStr(boardScope)}
    and t.title like 'Tether-6.5 %'
    and t.title not like 'Tether-6.5.%'
    and t.title ~* 'kit|modular';

  update public.tasks t
  set title = 'Tether-6 Maps'
  where t.project_id = v_project
    and t.board_scope = ${sqlStr(boardScope)}
    and t.title like 'Tether-6 %'
    and t.title not like 'Tether-6.%'
    and t.title ~* 'First playable|surface level|Level_01';
`;
}

function buildSql({ boardScope, updateOnly }) {
  const rows = rowsForScope(boardScope);
  const values = valuesSql(rows);
  const insertBlock = updateOnly
    ? `
    if v_id is null then
      -- Public pass updates existing claimable cards only. Do not insert.
      null;
    else`
    : `
    if v_id is null then
      insert into public.tasks (
        project_id, parent_task_id, title, description, category, difficulty,
        estimated_effort, status, subtasks, staff_only, board_scope, sort_order
      ) values (
        v_project, v_parent, v_row.title, v_row.description, v_row.category, v_row.difficulty,
        v_row.estimated_effort, v_row.status, v_row.subtasks, v_row.staff_only, ${sqlStr(boardScope)}, v_row.sort_order
      )
      returning id into v_id;
      v_created := v_created + 1;
    else`;

  const header = updateOnly
    ? `-- Tether-6 Maps from Tether_Task_Breakdown_${TETHER_V014_VERSION} → public board in place.
-- Remap leftover Level_01 / unofficial IDs, then update by title / ID prefix.
-- Does not insert. Does not change board_scope. Does not touch staging.
-- Does not rewrite Tether-4 or Tether-5. Does not add Tether-5.6.
-- Kit is 6.1 (first). Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v014_public.sql
`
    : `-- Tether-6 Maps from Tether_Task_Breakdown_${TETHER_V014_VERSION} → staging board only.
-- Upsert by title / ID prefix. Does not publish. Does not write public rows.
-- Does not rewrite Tether-4 or Tether-5. Does not add Tether-5.6.
-- Kit is 6.1 (first). Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v014.sql
`;

  return `${header}
do $$
declare
  v_project uuid;
  v_row record;
  v_id uuid;
  v_parent uuid;
  v_blocker uuid;
  v_code text;
  v_created int := 0;
  v_updated int := 0;
begin
  select id into v_project
  from public.projects
  where slug = ${sqlStr(TETHER_V014_PROJECT_SLUG)}
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found (slug=${TETHER_V014_PROJECT_SLUG}).';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;
${remapSql(boardScope)}
  create temporary table if not exists tmp_tether_v014 (
    code text primary key,
    parent_code text,
    title text not null,
    description text,
    category text,
    difficulty text,
    estimated_effort text,
    staff_only boolean not null,
    sort_order integer not null,
    blocked_by_codes text[] not null default '{}'::text[],
    subtasks jsonb not null default '[]'::jsonb,
    status text not null default 'ToDo'
  ) on commit drop;

  delete from tmp_tether_v014;

  insert into tmp_tether_v014 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_codes, subtasks, status
  ) values
${values};

  for v_row in
    select *
    from tmp_tether_v014
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
        and t.board_scope = ${sqlStr(boardScope)}
        and t.title like v_row.parent_code || ' %'
        and t.title not like v_row.parent_code || '.%'
      order by t.archived_at nulls first, t.created_at
      limit 1;
    end if;

    select t.id into v_id
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = ${sqlStr(boardScope)}
      and (
        t.title = v_row.title
        or (
          t.title like v_row.code || ' %'
          and t.title not like v_row.code || '.%'
        )
      )
    order by t.archived_at nulls first, t.created_at
    limit 1;
${insertBlock}
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
        status = case
          when v_row.code = 'Tether-CD.3' then v_row.status
          else status
        end
      where id = v_id
        and board_scope = ${sqlStr(boardScope)};
      v_updated := v_updated + 1;
    end if;
  end loop;

  -- Replace blockers for this tree only (${boardScope}).
  delete from public.task_dependencies d
  using public.tasks a, tmp_tether_v014 r
  where d.task_id = a.id
    and a.project_id = v_project
    and a.board_scope = ${sqlStr(boardScope)}
    and (
      a.title = r.title
      or (
        a.title like r.code || ' %'
        and a.title not like r.code || '.%'
      )
    );

  for v_row in
    select * from tmp_tether_v014 where cardinality(blocked_by_codes) > 0
  loop
    select t.id into v_id
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = ${sqlStr(boardScope)}
      and (
        t.title = v_row.title
        or (
          t.title like v_row.code || ' %'
          and t.title not like v_row.code || '.%'
        )
      )
    order by t.archived_at nulls first, t.created_at
    limit 1;

    foreach v_code in array v_row.blocked_by_codes
    loop
      select t.id into v_blocker
      from public.tasks t
      where t.project_id = v_project
        and t.board_scope = ${sqlStr(boardScope)}
        and t.title like v_code || ' %'
        and t.title not like v_code || '.%'
      order by t.archived_at nulls first, t.created_at
      limit 1;

      if v_id is not null and v_blocker is not null
         and v_id is distinct from v_blocker
         and to_regclass('public.task_dependencies') is not null then
        insert into public.task_dependencies (task_id, blocks_on_task_id)
        values (v_id, v_blocker)
        on conflict do nothing;
      end if;
    end loop;
  end loop;

  -- Tether-6 must not wait on Tether-5.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and b.project_id = v_project
    and a.board_scope = ${sqlStr(boardScope)}
    and b.board_scope = ${sqlStr(boardScope)}
    and a.title ~ '^Tether-6([. ]|$)'
    and b.title ~ '^Tether-5([. ]|$)';

  raise notice 'Tether v0.14 ${boardScope} ${updateOnly ? 'update' : 'upsert'} created=% updated=%',
    v_created, v_updated;

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
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stagingOut = join(root, 'supabase/sql/supabase_tether_task_tree_v014.sql');
const publicOut = join(root, 'supabase/sql/supabase_tether_task_tree_v014_public.sql');
writeFileSync(stagingOut, buildSql({ boardScope: 'staging', updateOnly: false }), 'utf8');
writeFileSync(publicOut, buildSql({ boardScope: 'public', updateOnly: true }), 'utf8');
console.log(`Wrote ${stagingOut} (${rowsForScope('staging').length} tasks)`);
console.log(`Wrote ${publicOut} (${rowsForScope('public').length} tasks)`);
