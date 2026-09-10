/**
 * Writes supabase/sql/supabase_tether_task_tree_v018.sql from the v0.18 tree.
 * Staging-only upsert for Tether-4.3–4.6 plus epic lore.
 * Does not rewrite 4.1.1–4.1.3 or 4.2.1–4.2.3. Does not write public rows.
 * Run: node scripts/generate-tether-v018-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TETHER_V018_KEEP_CODES,
  TETHER_V018_PROJECT_SLUG,
  TETHER_V018_TASKS,
  TETHER_V018_VERSION,
  buildTetherV018Description,
  tetherV018Difficulty,
  tetherV018StaffOnly,
  tetherV018Subtasks,
  tetherV018Title,
} from '../src/data/tetherTaskTreeV018.js';

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

const rows = TETHER_V018_TASKS.map((task) => {
  const title = tetherV018Title(task);
  if (title.length > 120) {
    throw new Error(`Title over 120 chars: ${title}`);
  }
  const desc = buildTetherV018Description(task);
  if (desc.length > 2000) {
    throw new Error(`Description over 2000 chars: ${task.code} (${desc.length})`);
  }
  if (task.state === 'Parked') {
    throw new Error(`Parked is not allowed in v0.18: ${task.code}`);
  }
  if (TETHER_V018_KEEP_CODES.includes(task.code)) {
    throw new Error(`Keep-list card must not be in the v0.18 upsert: ${task.code}`);
  }
  if (/^Tether-[567]([.]|$)/.test(task.code) && !String(task.code).startsWith('Tether-4')) {
    throw new Error(`Tether-5/6/7 are out of this pass: ${task.code}`);
  }
  if (/nanite canister/i.test(`${title} ${desc}`)) {
    throw new Error(`Nanite canister farm type is out of this pass: ${task.code}`);
  }
  if (/pickaxe/i.test(desc) && !/no pickaxe/i.test(desc)) {
    throw new Error(`Extractor must not be a pickaxe: ${task.code}`);
  }
  const depth = (() => {
    if (!task.parentCode) return 0;
    const parent = TETHER_V018_TASKS.find((x) => x.code === task.parentCode);
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
    difficulty: tetherV018Difficulty(task.size),
    estimatedEffort: task.size,
    staffOnly: tetherV018StaffOnly(task),
    sortOrder: task.sortOrder,
    blockedByCodes: task.blockedByCodes || (task.blockedByCode ? [task.blockedByCode] : []),
    subtasks: tetherV018Subtasks(task),
    status: 'ToDo',
  };
});

const values = rows
  .map(
    (r) =>
      `    (${sqlStr(r.code)}, ${sqlStr(r.parentCode)}, ${sqlStr(r.title)}, ${sqlStr(r.description)}, ${sqlStr(r.category)}, ${sqlStr(r.difficulty)}, ${sqlStr(r.estimatedEffort)}, ${r.staffOnly ? 'true' : 'false'}, ${r.sortOrder}, ${sqlTextArray(r.blockedByCodes)}, ${sqlJson(r.subtasks)}::jsonb, ${sqlStr(r.status)})`
  )
  .join(',\n');

const sql = `-- Tether-4 from Tether_Task_Breakdown_${TETHER_V018_VERSION} → staging board only.
-- Upsert by title / ID prefix. Does not publish. Does not write public rows.
-- Does not rewrite Tether-4.1.1, 4.1.2, 4.1.3, 4.2.1, 4.2.2, 4.2.3.
-- Does not rewrite Tether-5, Tether-6, or Tether-7.
-- Replaces leftover Salvage / Nanite / Beam-crystal 4.3 catalog.
-- Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v018.sql

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
  where slug = ${sqlStr(TETHER_V018_PROJECT_SLUG)}
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found (slug=${TETHER_V018_PROJECT_SLUG}).';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;

  -- Bring the existing Tether-4 staging tree back without rewriting keep-list briefs.
  update public.tasks t
  set archived_at = null
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title ~ '^Tether-4([. ]|$)';

  -- Replace leftover four-name catalog if it is still the whole 4.3 medium.
  update public.tasks t
  set title = 'Tether-4.3 Raw materials'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-4.3 %'
    and t.title not like 'Tether-4.3.%'
    and t.title ~* 'Salvage|Nanite|catalog|Beam crystal';

  create temporary table if not exists tmp_tether_v018 (
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

  delete from tmp_tether_v018;

  insert into tmp_tether_v018 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_codes, subtasks, status
  ) values
${values};

  for v_row in
    select *
    from tmp_tether_v018
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
        sort_order = v_row.sort_order
      where id = v_id
        and board_scope = 'staging';
      v_updated := v_updated + 1;
    end if;
  end loop;

  -- Replace blockers for this tree only (staging). Keep-list cards are not in tmp.
  delete from public.task_dependencies d
  using public.tasks a, tmp_tether_v018 r
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
    select * from tmp_tether_v018 where cardinality(blocked_by_codes) > 0
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

  -- New Tether-4 cards must not sit under Tether-5 or Tether-7.
  update public.tasks t
  set parent_task_id = (
    select e.id from public.tasks e
    where e.project_id = v_project
      and e.board_scope = 'staging'
      and e.title like 'Tether-4 %'
      and e.title not like 'Tether-4.%'
    limit 1
  )
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title ~ '^Tether-4\\.[3456]([. ]|$)'
    and t.parent_task_id in (
      select p.id from public.tasks p
      where p.project_id = v_project
        and p.board_scope = 'staging'
        and (
          (p.title like 'Tether-5 %' and p.title not like 'Tether-5.%')
          or (p.title like 'Tether-7 %' and p.title not like 'Tether-7.%')
        )
    );

  update public.tasks t
  set parent_task_id = null
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-4 %'
    and t.title not like 'Tether-4.%';

  raise notice 'Tether v0.18 staging upsert created=% updated=%',
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
const out = join(root, 'supabase/sql/supabase_tether_task_tree_v018.sql');
writeFileSync(out, sql, 'utf8');
console.log(`Wrote ${out} (${rows.length} tasks)`);
