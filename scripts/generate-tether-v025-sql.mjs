/**
 * Writes supabase/sql/supabase_tether_task_tree_v025.sql from the v0.25 tree.
 * Staging-only upsert for Tether-9 Production look.
 * Run: node scripts/generate-tether-v025-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TETHER_V025_PROJECT_SLUG,
  TETHER_V025_SHEET_CODES,
  TETHER_V025_TASKS,
  TETHER_V025_VERSION,
  buildTetherV025Description,
  isTetherV025LookCard,
  tetherV025Blockers,
  tetherV025Difficulty,
  tetherV025StaffOnly,
  tetherV025Subtasks,
  tetherV025Title,
} from '../src/data/tetherTaskTreeV025.js';

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

const rows = TETHER_V025_TASKS.map((task) => {
  const title = tetherV025Title(task);
  if (title.length > 120) {
    throw new Error(`Title over 120 chars: ${title}`);
  }
  if (/founder/i.test(title) || /founder/i.test(task.shortTitle || '')) {
    throw new Error(`Do not label any card Founder: ${task.code}`);
  }
  const desc = buildTetherV025Description(task);
  if (desc.length > 2000) {
    throw new Error(`Description over 2000 chars: ${task.code} (${desc.length})`);
  }
  if (task.state === 'Parked') {
    throw new Error(`Parked is not allowed in v0.25: ${task.code}`);
  }
  if (!/^Tether-9([.]|$)/.test(task.code)) {
    throw new Error(`Only Tether-9 belongs in this pass: ${task.code}`);
  }
  if (/^Tether-(4|5|6|7|8|11|12)([.]|$)/.test(task.code)) {
    throw new Error(`Out of this pass: ${task.code}`);
  }
  const blockers = tetherV025Blockers(task);
  if (blockers.includes('Tether-9.0.0')) {
    throw new Error(`9.0.0 must not block ${task.code}`);
  }
  if (isTetherV025LookCard(task)) {
    for (const sheet of TETHER_V025_SHEET_CODES) {
      if (!blockers.includes(sheet)) {
        throw new Error(`${task.code} must block on ${sheet}`);
      }
    }
  }
  const depth = (() => {
    if (!task.parentCode) return 0;
    const parent = TETHER_V025_TASKS.find((x) => x.code === task.parentCode);
    if (!parent || !parent.parentCode) return 1;
    return 2;
  })();
  if (depth > 2) {
    throw new Error(`Depth over Epic → Medium → Small: ${task.code}`);
  }
  return {
    code: task.code,
    parentCode: task.parentCode,
    title,
    description: desc,
    category: task.skill,
    difficulty: tetherV025Difficulty(task.size),
    estimatedEffort: task.size,
    staffOnly: tetherV025StaffOnly(task),
    sortOrder: task.sortOrder,
    blockedByCodes: blockers,
    subtasks: tetherV025Subtasks(task),
    status: 'ToDo',
  };
});

const values = rows
  .map(
    (r) =>
      `    (${sqlStr(r.code)}, ${sqlStr(r.parentCode)}, ${sqlStr(r.title)}, ${sqlStr(r.description)}, ${sqlStr(r.category)}, ${sqlStr(r.difficulty)}, ${sqlStr(r.estimatedEffort)}, ${r.staffOnly ? 'true' : 'false'}, ${r.sortOrder}, ${sqlTextArray(r.blockedByCodes)}, ${sqlJson(r.subtasks)}::jsonb, ${sqlStr(r.status)})`
  )
  .join(',\n');

const sql = `-- Tether-9 Production look from Tether_Task_Breakdown_${TETHER_V025_VERSION}
-- plus v0.23 → staging board only.
-- Upsert by title / ID prefix. Does not publish. Does not write public rows.
-- Does not rewrite Tether-4, Tether-5, Tether-6, Tether-7, Tether-8, Tether-11, or Tether-12.
-- Clears published_task_id on staging Tether-9 so public Art pipeline twins stay untouched.
-- Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v025.sql

do $$
declare
  v_project uuid;
  v_row record;
  v_id uuid;
  v_parent uuid;
  v_blocker uuid;
  v_code text;
  v_epic9 uuid;
  v_dup uuid;
  v_created int := 0;
  v_updated int := 0;
begin
  select id into v_project
  from public.projects
  where slug = ${sqlStr(TETHER_V025_PROJECT_SLUG)}
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found (slug=${TETHER_V025_PROJECT_SLUG}).';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;

  -- One live Tether-9 epic. Reparent 9.* children. Archive extras.
  select t.id into v_epic9
  from public.tasks t
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-9 %'
    and t.title not like 'Tether-9.%'
  order by
    case when t.title = 'Tether-9 Production look' then 0 else 1 end,
    t.archived_at nulls first,
    t.created_at
  limit 1;

  if v_epic9 is not null then
    update public.tasks t
    set parent_task_id = v_epic9
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and t.title ~ '^Tether-9\\.[0-9A-C]'
      and t.parent_task_id is distinct from v_epic9
      and (
        t.parent_task_id is null
        or t.parent_task_id in (
          select e.id from public.tasks e
          where e.project_id = v_project
            and e.board_scope = 'staging'
            and e.title like 'Tether-9 %'
            and e.title not like 'Tether-9.%'
            and e.id is distinct from v_epic9
        )
      );

    for v_dup in
      select t.id
      from public.tasks t
      where t.project_id = v_project
        and t.board_scope = 'staging'
        and t.title like 'Tether-9 %'
        and t.title not like 'Tether-9.%'
        and t.id is distinct from v_epic9
    loop
      update public.tasks
      set archived_at = coalesce(archived_at, now())
      where id = v_dup
        and board_scope = 'staging';
    end loop;
  end if;

  create temporary table if not exists tmp_tether_v025 (
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

  delete from tmp_tether_v025;

  insert into tmp_tether_v025 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_codes, subtasks, status
  ) values
${values};

  for v_row in
    select *
    from tmp_tether_v025
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
        v_row.estimated_effort, v_row.status, v_row.subtasks, v_row.staff_only, 'staging', v_row.sort_order
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
        archived_at = null,
        published_task_id = null
      where id = v_id
        and board_scope = 'staging';
      v_updated := v_updated + 1;
    end if;
  end loop;

  delete from public.task_dependencies d
  using public.tasks a, tmp_tether_v025 r
  where d.task_id = a.id
    and a.project_id = v_project
    and a.board_scope = 'staging'
    and (
      a.title = r.title
      or (
        a.title like r.code || ' %'
        and a.title not like r.code || '.%'
      )
    );

  for v_row in
    select * from tmp_tether_v025 where cardinality(blocked_by_codes) > 0
  loop
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

    foreach v_code in array v_row.blocked_by_codes
    loop
      select t.id into v_blocker
      from public.tasks t
      where t.project_id = v_project
        and t.board_scope = 'staging'
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

  -- 9.0.0 must not block 9.1-9.8.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and b.project_id = v_project
    and a.board_scope = 'staging'
    and a.title ~ '^Tether-9\\.[1-8]([. ]|$)'
    and b.title ~ '^Tether-9\\.0\\.0([. ]|$)';

  raise notice 'Tether v0.25 staging upsert created=% updated=%',
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'supabase/sql/supabase_tether_task_tree_v025.sql');
writeFileSync(out, sql, 'utf8');
console.log(`Wrote ${out} (${rows.length} tasks)`);
