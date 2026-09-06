/**
 * Writes supabase/sql/supabase_tether_p_ready_lane_rehome.sql
 * Run: node scripts/generate-tether-p-rehome-sql.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TETHER_V06_TASKS,
  buildTetherV06Description,
  tetherV06Subtasks,
  tetherV06Title,
} from '../src/data/tetherTaskTreeV06.js';

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlStr(JSON.stringify(value))}::jsonb`;
}

const codes = [
  'Tether-P.2',
  'Tether-P.2.1',
  'Tether-P.2.2',
  'Tether-P.2.3',
  'Tether-P.3',
  'Tether-P.3.1',
  'Tether-P.3.2',
  'Tether-P.4',
  'Tether-P.4.1',
];

const rows = codes
  .map((code) => {
    const task = TETHER_V06_TASKS.find((t) => t.code === code);
    if (!task) throw new Error(`Missing ${code}`);
    return `    (${sqlStr(code)}, ${sqlStr(tetherV06Title(task))}, ${sqlStr(buildTetherV06Description(task))}, ${sqlStr(task.skill)}, ${task.state === 'Staff Only' ? 'true' : 'false'}, ${sqlJson(tetherV06Subtasks(task))})`;
  })
  .join(',\n');

const sql = `-- Rehome leftover Tether-P Ready lane cards in place.
-- Match by current title. Do not insert. Do not recreate Tether-P.1.
-- Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_p_ready_lane_rehome.sql

alter table public.tasks
  add column if not exists archived_at timestamptz;

do $$
declare
  v_project uuid;
  v_epic9 uuid;
  v_epic2 uuid;
  v_p2 uuid;
  v_p3 uuid;
  v_p4 uuid;
  v_lane uuid;
  v_child int;
  r record;
begin
  select id into v_project
  from public.projects
  where slug in ('tether', 'prototype-systems')
  order by case when slug = 'tether' then 0 else 1 end
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found.';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception when undefined_object then null;
  end;
  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_board_scope';
  exception when undefined_object then null;
  end;
  begin
    execute 'alter table public.tasks disable trigger trg_enforce_task_parent';
  exception when undefined_object then null;
  end;

  create temporary table if not exists tmp_tether_p_rehome (
    code text primary key,
    title text not null,
    description text,
    category text,
    staff_only boolean not null,
    subtasks jsonb not null default '[]'::jsonb
  ) on commit drop;

  delete from tmp_tether_p_rehome;

  insert into tmp_tether_p_rehome (
    code, title, description, category, staff_only, subtasks
  ) values
${rows};

  for r in select * from tmp_tether_p_rehome loop
    update public.tasks t
    set
      title = r.title,
      description = r.description,
      category = r.category,
      staff_only = r.staff_only,
      subtasks = r.subtasks,
      status = 'ToDo'
    where t.project_id = v_project
      and t.archived_at is null
      and (t.title = r.title or t.title like r.code || ' %');
    if not found then
      raise notice 'No existing card for %; not inserting.', r.code;
    end if;
  end loop;

  select t.id into v_epic9
  from public.tasks t
  where t.project_id = v_project
    and t.archived_at is null
    and t.parent_task_id is null
    and t.title like 'Tether-9 %'
  order by case when t.board_scope = 'staging' then 0 else 1 end, t.created_at
  limit 1;

  select t.id into v_epic2
  from public.tasks t
  where t.project_id = v_project
    and t.archived_at is null
    and t.parent_task_id is null
    and t.title like 'Tether-2 %'
  order by case when t.board_scope = 'staging' then 0 else 1 end, t.created_at
  limit 1;

  select t.id into v_p2
  from public.tasks t
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-P.2 %'
    and t.title not like 'Tether-P.2.%'
  order by t.created_at
  limit 1;

  select t.id into v_p3
  from public.tasks t
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-P.3 %'
    and t.title not like 'Tether-P.3.%'
  order by t.created_at
  limit 1;

  select t.id into v_p4
  from public.tasks t
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-P.4 %'
    and t.title not like 'Tether-P.4.%'
  order by t.created_at
  limit 1;

  select t.id into v_lane
  from public.tasks t
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-P %'
    and t.title not like 'Tether-P.%'
  order by t.created_at
  limit 1;

  if v_epic9 is not null and v_p2 is not null then
    -- Nest first (still staging), then flip the existing Epic 9 chapter
    -- plus P.2 family to public in place. No new cards.
    update public.tasks
    set parent_task_id = v_epic9, sort_order = 30
    where id = v_p2;

    update public.tasks
    set board_scope = 'public'
    where project_id = v_project
      and archived_at is null
      and (
        id = v_epic9
        or parent_task_id = v_epic9
        or id = v_p2
        or parent_task_id = v_p2
      );

    update public.tasks
    set staff_only = false, board_scope = 'public'
    where id = v_p2 or parent_task_id = v_p2;
  elsif v_p2 is not null then
    update public.tasks
    set
      parent_task_id = null,
      title = 'Tether-P.2 Tether look exploration',
      board_scope = 'public',
      staff_only = false,
      sort_order = 16
    where id = v_p2;

    update public.tasks
    set board_scope = 'public', staff_only = false
    where parent_task_id = v_p2;
  end if;

  if v_epic2 is not null and v_p3 is not null then
    update public.tasks
    set
      parent_task_id = v_epic2,
      sort_order = 40,
      staff_only = true,
      board_scope = 'staging'
    where id = v_p3;

    update public.tasks
    set staff_only = true, board_scope = 'staging'
    where parent_task_id = v_p3;
  end if;

  if v_p4 is not null then
    update public.tasks
    set
      parent_task_id = null,
      staff_only = true,
      board_scope = 'staging',
      sort_order = 16
    where id = v_p4;

    update public.tasks
    set staff_only = true, board_scope = 'staging'
    where parent_task_id = v_p4;
  end if;

  if v_lane is not null then
    select count(*)::int into v_child
    from public.tasks
    where parent_task_id = v_lane
      and archived_at is null;

    if v_child > 0 then
      raise exception 'Tether-P Ready lane still has % live children; not archiving.', v_child;
    end if;

    update public.tasks
    set archived_at = coalesce(archived_at, now())
    where id = v_lane;
  end if;

  begin
    execute 'alter table public.tasks enable trigger trg_enforce_task_parent';
  exception when undefined_object then null;
  end;
  begin
    execute 'alter table public.tasks enable trigger trg_protect_task_board_scope';
  exception when undefined_object then null;
  end;
  begin
    execute 'alter table public.tasks enable trigger trg_protect_task_staff_only';
  exception when undefined_object then null;
  end;
exception
  when others then
    begin
      execute 'alter table public.tasks enable trigger trg_enforce_task_parent';
    exception when undefined_object then null;
    end;
    begin
      execute 'alter table public.tasks enable trigger trg_protect_task_board_scope';
    exception when undefined_object then null;
    end;
    begin
      execute 'alter table public.tasks enable trigger trg_protect_task_staff_only';
    exception when undefined_object then null;
    end;
    raise;
end $$;
`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'supabase/sql/supabase_tether_p_ready_lane_rehome.sql');
writeFileSync(out, sql, 'utf8');
console.log(`Wrote ${out}`);
