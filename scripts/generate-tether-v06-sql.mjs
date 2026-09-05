/**
 * Writes supabase/sql/supabase_tether_task_tree_v06.sql from the v0.6 tree.
 * Run: node scripts/generate-tether-v06-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TETHER_V06_PROJECT_SLUG,
  TETHER_V06_TASKS,
  TETHER_V06_VERSION,
  buildTetherV06Description,
  tetherV06Difficulty,
  tetherV06StaffOnly,
  tetherV06Subtasks,
  tetherV06Title,
} from '../src/data/tetherTaskTreeV06.js';

function sqlStr(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return sqlStr(JSON.stringify(value));
}

const rows = TETHER_V06_TASKS.map((task) => {
  const title = tetherV06Title(task);
  if (title.length > 120) {
    throw new Error(`Title over 120 chars: ${title}`);
  }
  const desc = buildTetherV06Description(task);
  if (desc.length > 2000) {
    throw new Error(`Description over 2000 chars: ${task.code} (${desc.length})`);
  }
  return {
    code: task.code,
    parentCode: task.parentCode,
    title,
    description: desc,
    category: task.skill,
    difficulty: tetherV06Difficulty(task.size),
    estimatedEffort: task.size,
    staffOnly: tetherV06StaffOnly(task.state),
    sortOrder: task.sortOrder,
    blockedByCode: task.blockedByCode || null,
    subtasks: tetherV06Subtasks(task),
  };
});

const values = rows
  .map(
    (r) =>
      `    (${sqlStr(r.code)}, ${sqlStr(r.parentCode)}, ${sqlStr(r.title)}, ${sqlStr(r.description)}, ${sqlStr(r.category)}, ${sqlStr(r.difficulty)}, ${sqlStr(r.estimatedEffort)}, ${r.staffOnly ? 'true' : 'false'}, ${r.sortOrder}, ${sqlStr(r.blockedByCode)}, ${sqlJson(r.subtasks)}::jsonb)`
  )
  .join(',\n');

const sql = `-- Tether Task Breakdown ${TETHER_V06_VERSION} → staff staging board only.
-- Does not publish. Does not mark Ready for public claim. Does not award credit.
-- Does not delete leftover public/demo cards. Safe to re-run (upsert by title).
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v06.sql

do $$
declare
  v_project uuid;
  r record;
  v_id uuid;
  v_parent uuid;
  v_blocker uuid;
begin
  select id into v_project
  from public.projects
  where slug in (${sqlStr(TETHER_V06_PROJECT_SLUG)}, 'prototype-systems')
  order by case when slug = ${sqlStr(TETHER_V06_PROJECT_SLUG)} then 0 else 1 end
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found (slug=${TETHER_V06_PROJECT_SLUG} or prototype-systems).';
  end if;

  -- SQL Editor runs as postgres; staff_only trigger checks is_project_staff().
  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;

  create temporary table if not exists tmp_tether_v06 (
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

  delete from tmp_tether_v06;

  insert into tmp_tether_v06 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_code, subtasks
  ) values
${values};

  -- Parents before children: no parent, then one-dot, then two-dot.
  for r in
    select *
    from tmp_tether_v06
    order by
      (parent_code is not null)::int,
      char_length(code),
      sort_order,
      code
  loop
    v_parent := null;
    if r.parent_code is not null then
      select t.id into v_parent
      from public.tasks t
      where t.project_id = v_project
        and t.board_scope = 'staging'
        and t.title like r.parent_code || ' %'
      order by t.created_at
      limit 1;
    end if;

    select t.id into v_id
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and (t.title = r.title or t.title like r.code || ' %')
    order by t.created_at
    limit 1;

    if v_id is null then
      insert into public.tasks (
        project_id, parent_task_id, title, description, category, difficulty,
        estimated_effort, status, subtasks, staff_only, board_scope, sort_order
      ) values (
        v_project, v_parent, r.title, r.description, r.category, r.difficulty,
        r.estimated_effort, 'ToDo', r.subtasks, r.staff_only, 'staging', r.sort_order
      )
      returning id into v_id;
    else
      -- Copy only. Do not change state, visibility, hierarchy, or IDs.
      update public.tasks set
        title = r.title,
        description = r.description,
        subtasks = r.subtasks
      where id = v_id;
    end if;
  end loop;

  -- Blockers (Blocked state). Staging only; never publish in this pass.
  for r in
    select * from tmp_tether_v06 where blocked_by_code is not null
  loop
    select t.id into v_id
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and (t.title = r.title or t.title like r.code || ' %')
    order by t.created_at
    limit 1;

    select t.id into v_blocker
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and t.title like r.blocked_by_code || ' %'
    order by t.created_at
    limit 1;

    if v_id is not null and v_blocker is not null
       and to_regclass('public.task_dependencies') is not null then
      insert into public.task_dependencies (task_id, blocks_on_task_id)
      values (v_id, v_blocker)
      on conflict do nothing;
    end if;
  end loop;

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

const copySql = `-- Tether v0.6 copy refresh only.
-- Updates title/description/checklist. Does not change state, visibility, hierarchy, or IDs.
-- Does not insert or publish. Safe to re-run.

do $$
declare
  r record;
begin
  create temporary table if not exists tmp_tether_v06_copy (
    code text primary key,
    title text not null,
    description text,
    subtasks jsonb not null default '[]'::jsonb
  ) on commit drop;

  delete from tmp_tether_v06_copy;

  insert into tmp_tether_v06_copy (code, title, description, subtasks) values
${rows
  .map(
    (r) =>
      `    (${sqlStr(r.code)}, ${sqlStr(r.title)}, ${sqlStr(r.description)}, ${sqlJson(r.subtasks)}::jsonb)`
  )
  .join(',\n')};

  update public.tasks t
  set
    title = r.title,
    description = r.description,
    subtasks = r.subtasks
  from tmp_tether_v06_copy r, public.projects p
  where t.project_id = p.id
    and p.slug in ('tether', 'prototype-systems')
    and (t.title = r.title or t.title like r.code || ' %');
end $$;
`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'supabase/sql/supabase_tether_task_tree_v06.sql');
writeFileSync(out, sql, 'utf8');
const copyOut = join(root, 'supabase/sql/supabase_tether_task_copy_refresh.sql');
writeFileSync(copyOut, copySql, 'utf8');
console.log(`Wrote ${out} (${rows.length} tasks)`);
console.log(`Wrote ${copyOut}`);
