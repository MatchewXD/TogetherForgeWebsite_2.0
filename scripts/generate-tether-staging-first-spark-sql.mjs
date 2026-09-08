/**
 * Writes supabase/sql/supabase_tether_staging_first_spark.sql from the v0.6 tree.
 * Production staging upsert: copy, staff_only, status, blockers. No Epic 1/2 inserts.
 * Run: node scripts/generate-tether-staging-first-spark-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TETHER_V06_PROJECT_SLUG,
  TETHER_V06_TASKS,
  buildTetherV06Description,
  tetherV06Completed,
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

function includeTask(task) {
  return /^(Tether-P|Tether-(3|4|5|6|7|8|9|10|11|12|13)([. ]|$))/.test(
    task.code
  );
}

const rows = TETHER_V06_TASKS.filter(includeTask).map((task) => {
  const title = tetherV06Title(task);
  if (title.length > 120) {
    throw new Error(`Title over 120 chars: ${title}`);
  }
  const desc = buildTetherV06Description(task);
  if (desc.length > 2000) {
    throw new Error(`Description over 2000 chars: ${task.code} (${desc.length})`);
  }
  const completed = tetherV06Completed(task);
  const subtasks = tetherV06Subtasks(task).map((s) =>
    completed ? { ...s, done: true } : s
  );
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
    subtasks,
    status: completed ? 'Completed' : 'ToDo',
    unarchive: task.code === 'Tether-10' || task.code.startsWith('Tether-10.'),
  };
});

const values = rows
  .map(
    (r) =>
      `    (${sqlStr(r.code)}, ${sqlStr(r.parentCode)}, ${sqlStr(r.title)}, ${sqlStr(r.description)}, ${sqlStr(r.category)}, ${sqlStr(r.difficulty)}, ${sqlStr(r.estimatedEffort)}, ${r.staffOnly ? 'true' : 'false'}, ${r.sortOrder}, ${sqlStr(r.blockedByCode)}, ${sqlJson(r.subtasks)}::jsonb, ${sqlStr(r.status)}, ${r.unarchive ? 'true' : 'false'})`
  )
  .join(',\n');

const sql = `-- Tether staging First Spark / spine upsert (production).
-- Upserts by title (Tether-N …). Does not insert Epic 1 or Epic 2.
-- Does not recreate P.1, P.2.3, P.3.1, or P.4.
-- Unarchives Tether-10 on staging if it was archived after publish.
-- Safe to re-run.

do $$
declare
  v_project uuid;
  r record;
  v_id uuid;
  v_parent uuid;
  v_blocker uuid;
  v_new boolean;
begin
  select id into v_project
  from public.projects
  where slug = ${sqlStr(TETHER_V06_PROJECT_SLUG)}
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found (slug=${TETHER_V06_PROJECT_SLUG}).';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;

  create temporary table if not exists tmp_tether_spark (
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
    subtasks jsonb not null default '[]'::jsonb,
    status text not null,
    unarchive boolean not null default false
  ) on commit drop;

  delete from tmp_tether_spark;

  insert into tmp_tether_spark (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_code, subtasks,
    status, unarchive
  ) values
${values};

  create temporary table if not exists tmp_tether_spark_applied (
    code text primary key,
    task_id uuid not null,
    is_new boolean not null
  ) on commit drop;

  delete from tmp_tether_spark_applied;

  for r in
    select *
    from tmp_tether_spark
    order by
      (parent_code is not null)::int,
      char_length(code),
      sort_order,
      code
  loop
    v_parent := null;
    v_new := false;
    if r.parent_code is not null then
      select a.task_id into v_parent
      from tmp_tether_spark_applied a
      where a.code = r.parent_code;
      if v_parent is null then
        select t.id into v_parent
        from public.tasks t
        where t.project_id = v_project
          and t.board_scope = 'staging'
          and t.title like r.parent_code || ' %'
        order by t.archived_at nulls first, t.created_at
        limit 1;
      end if;
    end if;

    select t.id into v_id
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and (t.title = r.title or t.title like r.code || ' %')
    order by t.archived_at nulls first, t.created_at
    limit 1;

    if v_id is null then
      insert into public.tasks (
        project_id, parent_task_id, title, description, category, difficulty,
        estimated_effort, status, subtasks, staff_only, board_scope, sort_order
      ) values (
        v_project, v_parent, r.title, r.description, r.category, r.difficulty,
        r.estimated_effort, r.status, r.subtasks, r.staff_only, 'staging', r.sort_order
      )
      returning id into v_id;
      v_new := true;
    else
      update public.tasks set
        title = r.title,
        description = r.description,
        category = r.category,
        difficulty = r.difficulty,
        estimated_effort = r.estimated_effort,
        subtasks = r.subtasks,
        staff_only = r.staff_only,
        sort_order = r.sort_order,
        status = r.status,
        parent_task_id = coalesce(v_parent, parent_task_id),
        archived_at = case
          when r.unarchive then null
          else archived_at
        end
      where id = v_id;
    end if;

    insert into tmp_tether_spark_applied (code, task_id, is_new)
    values (r.code, v_id, v_new)
    on conflict (code) do update set task_id = excluded.task_id, is_new = excluded.is_new;
  end loop;

  -- Replace blockers for this spine set only.
  if to_regclass('public.task_dependencies') is not null then
    delete from public.task_dependencies d
    using tmp_tether_spark_applied a
    where d.task_id = a.task_id;

    for r in
      select * from tmp_tether_spark where blocked_by_code is not null
    loop
      select a.task_id into v_id
      from tmp_tether_spark_applied a
      where a.code = r.code;

      select a.task_id into v_blocker
      from tmp_tether_spark_applied a
      where a.code = r.blocked_by_code;

      if v_blocker is null then
        select t.id into v_blocker
        from public.tasks t
        where t.project_id = v_project
          and t.board_scope = 'staging'
          and t.title like r.blocked_by_code || ' %'
        order by t.archived_at nulls first, t.created_at
        limit 1;
      end if;

      if v_id is not null and v_blocker is not null and v_id is distinct from v_blocker then
        insert into public.task_dependencies (task_id, blocks_on_task_id)
        values (v_id, v_blocker)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Public Tether-10.1 stays Done; 10.2 is deferred (not Done).
  update public.tasks t
  set
    description = s.description,
    subtasks = s.subtasks,
    staff_only = true,
    status = s.status
  from tmp_tether_spark s
  where t.project_id = v_project
    and t.board_scope = 'public'
    and s.code in ('Tether-10.1', 'Tether-10.2')
    and (t.title = s.title or t.title like s.code || ' %');

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
const out = join(root, 'supabase/sql/supabase_tether_staging_first_spark.sql');
writeFileSync(out, sql, 'utf8');
console.log(`Wrote ${out} (${rows.length} tasks)`);
