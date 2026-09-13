/**
 * Writes supabase/sql/supabase_tether_task_tree_v024.sql from the v0.24 tree.
 * Staging-only upsert for Tether-8 UI, Tether-11 animation, Tether-12 audio.
 * Run: node scripts/generate-tether-v024-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TETHER_V024_PROJECT_SLUG,
  TETHER_V024_TASKS,
  TETHER_V024_VERSION,
  buildTetherV024Description,
  tetherV024Difficulty,
  tetherV024StaffOnly,
  tetherV024Subtasks,
  tetherV024Title,
} from '../src/data/tetherTaskTreeV024.js';

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

const rows = TETHER_V024_TASKS.map((task) => {
  const title = tetherV024Title(task);
  if (title.length > 120) {
    throw new Error(`Title over 120 chars: ${title}`);
  }
  const desc = buildTetherV024Description(task);
  if (desc.length > 2000) {
    throw new Error(`Description over 2000 chars: ${task.code} (${desc.length})`);
  }
  if (task.state === 'Parked') {
    throw new Error(`Parked is not allowed in v0.24: ${task.code}`);
  }
  if (/^Tether-[4-7]([.]|$)/.test(task.code) || /^Tether-9([.]|$)/.test(task.code)) {
    throw new Error(`Tether-4/5/6/7/9 are out of this pass: ${task.code}`);
  }
  const blockers = task.blockedByCodes || (task.blockedByCode ? [task.blockedByCode] : []);
  if (blockers.some((c) => String(c).startsWith('Tether-10'))) {
    throw new Error(`Tether-8 must not block on Tether-10: ${task.code}`);
  }
  const depth = (() => {
    if (!task.parentCode) return 0;
    const parent = TETHER_V024_TASKS.find((x) => x.code === task.parentCode);
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
    difficulty: tetherV024Difficulty(task.size),
    estimatedEffort: task.size,
    staffOnly: tetherV024StaffOnly(task),
    sortOrder: task.sortOrder,
    blockedByCodes: blockers,
    subtasks: tetherV024Subtasks(task),
    status: 'ToDo',
  };
});

const values = rows
  .map(
    (r) =>
      `    (${sqlStr(r.code)}, ${sqlStr(r.parentCode)}, ${sqlStr(r.title)}, ${sqlStr(r.description)}, ${sqlStr(r.category)}, ${sqlStr(r.difficulty)}, ${sqlStr(r.estimatedEffort)}, ${r.staffOnly ? 'true' : 'false'}, ${r.sortOrder}, ${sqlTextArray(r.blockedByCodes)}, ${sqlJson(r.subtasks)}::jsonb, ${sqlStr(r.status)})`
  )
  .join(',\n');

const sql = `-- Tether-8 UI, Tether-11 animation, Tether-12 audio from Tether_Task_Breakdown_${TETHER_V024_VERSION}
-- plus v0.21 / v0.22 → staging board only.
-- Upsert by title / ID prefix. Does not publish. Does not write public rows.
-- Does not rewrite Tether-4, Tether-5, Tether-6, Tether-7, or Tether-9.
-- Tether-10 is done. Does not Block Tether-8 on Tether-10.
-- Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v024.sql

do $$
declare
  v_project uuid;
  v_row record;
  v_id uuid;
  v_parent uuid;
  v_blocker uuid;
  v_code text;
  v_epic8 uuid;
  v_epic7 uuid;
  v_dup uuid;
  v_created int := 0;
  v_updated int := 0;
begin
  select id into v_project
  from public.projects
  where slug = ${sqlStr(TETHER_V024_PROJECT_SLUG)}
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found (slug=${TETHER_V024_PROJECT_SLUG}).';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;

  select t.id into v_epic7
  from public.tasks t
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-7 %'
    and t.title not like 'Tether-7.%'
  order by t.archived_at nulls first, t.created_at
  limit 1;

  -- Leftover gameplay weapon/tool children under Epic 11 go to Tether-7.
  -- Keep Tether-11.0–11.3 rig, clip, and pose cards on Tether-11.
  if v_epic7 is not null then
    update public.tasks c
    set parent_task_id = v_epic7
    where c.project_id = v_project
      and c.board_scope = 'staging'
      and c.parent_task_id in (
        select e.id from public.tasks e
        where e.project_id = v_project
          and e.board_scope = 'staging'
          and e.title like 'Tether-11 %'
          and e.title not like 'Tether-11.%'
      )
      and c.title !~ '^Tether-11\\.(0|1|2|3)([. ]|$)'
      and c.title !~* 'pose|clip|animation|rig|skeleton'
      and (
        c.title ~* 'Hand Spark|Nano-Knife|Enforcer|Canon|Snare|Grapple|Boost pack|Crew shields'
        or c.title ~ '^Tether-11\\.[45]([. ]|$)'
      );
  end if;

  -- Epic 11 still named UI or Tools becomes Tether-8 UI.
  update public.tasks t
  set title = 'Tether-8 UI'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-11 %'
    and t.title not like 'Tether-11.%'
    and t.title ~* 'UI|Tools';

  -- Old Tether-8 station chapter becomes Tether-8 UI.
  update public.tasks t
  set title = 'Tether-8 UI'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-8 %'
    and t.title not like 'Tether-8.%'
    and t.title ~* 'station|sequence|Final';

  -- One live Tether-8 epic. Reparent 8.* children. Archive extras.
  select t.id into v_epic8
  from public.tasks t
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-8 %'
    and t.title not like 'Tether-8.%'
  order by
    case when t.title = 'Tether-8 UI' then 0 else 1 end,
    t.archived_at nulls first,
    t.created_at
  limit 1;

  if v_epic8 is not null then
    update public.tasks t
    set parent_task_id = v_epic8
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and t.title ~ '^Tether-8\\.[0-9]'
      and t.parent_task_id is distinct from v_epic8
      and (
        t.parent_task_id is null
        or t.parent_task_id in (
          select e.id from public.tasks e
          where e.project_id = v_project
            and e.board_scope = 'staging'
            and e.title like 'Tether-8 %'
            and e.title not like 'Tether-8.%'
            and e.id is distinct from v_epic8
        )
      );

    for v_dup in
      select t.id
      from public.tasks t
      where t.project_id = v_project
        and t.board_scope = 'staging'
        and t.title like 'Tether-8 %'
        and t.title not like 'Tether-8.%'
        and t.id is distinct from v_epic8
    loop
      update public.tasks
      set archived_at = coalesce(archived_at, now())
      where id = v_dup
        and board_scope = 'staging';
    end loop;
  end if;

  create temporary table if not exists tmp_tether_v024 (
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

  delete from tmp_tether_v024;

  insert into tmp_tether_v024 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_codes, subtasks, status
  ) values
${values};

  for v_row in
    select *
    from tmp_tether_v024
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
        archived_at = null
      where id = v_id
        and board_scope = 'staging';
      v_updated := v_updated + 1;
    end if;
  end loop;

  delete from public.task_dependencies d
  using public.tasks a, tmp_tether_v024 r
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
    select * from tmp_tether_v024 where cardinality(blocked_by_codes) > 0
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

  -- Tether-8 must not wait on Tether-10.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and b.project_id = v_project
    and a.board_scope = 'staging'
    and a.title ~ '^Tether-8([. ]|$)'
    and b.title ~ '^Tether-10([. ]|$)';

  -- Old parked Tether-12 must not wait on Tether-6.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and b.project_id = v_project
    and a.board_scope = 'staging'
    and a.title ~ '^Tether-12([. ]|$)'
    and b.title ~ '^Tether-6([. ]|$)';

  raise notice 'Tether v0.24 staging upsert created=% updated=%',
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
const out = join(root, 'supabase/sql/supabase_tether_task_tree_v024.sql');
writeFileSync(out, sql, 'utf8');
console.log(`Wrote ${out} (${rows.length} tasks)`);
