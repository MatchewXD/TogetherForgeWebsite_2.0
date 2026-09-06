-- Rehome leftover Tether-P Ready lane cards in place.
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
    ('Tether-P.2', 'Tether-P.2 Art exploration', 'Art exploration for player, beam, and scale. Not final production art. StyleLock.md is Draft. Cite Docs/Vision.md and Docs/StyleLock.md.', 'Art', false, '[]'::jsonb),
    ('Tether-P.2.1', 'Tether-P.2.1 Player stand-in silhouettes', 'Three readable silhouette thumbnails for a suited colony crew stand-in. Do not model a final character. Do not change the prototype mesh unless staff ask. Cite Docs/StyleLock.md.

Output: Docs/art-explorations/player/ plus a short note saying which silhouette reads at a distance.

Definition of Done:
- Three readable silhouette thumbnails exist in Docs/art-explorations/player/.
- A short note says which silhouette reads at a distance.', 'Art', false, '[{"id":"s1","label":"Three readable silhouette thumbnails exist in Docs/art-explorations/player/.","done":false},{"id":"s2","label":"A short note says which silhouette reads at a distance.","done":false}]'::jsonb),
    ('Tether-P.2.2', 'Tether-P.2.2 Tether visual directions', 'Three stills or overlays of the shared energy beam at Low vs High tension. Stay a beam between bodies. Cite Docs/StyleLock.md and Docs/TetherRules.txt.

Output: Docs/art-explorations/tether/.

Definition of Done:
- Three stills or overlays of Low vs High tension exist in Docs/art-explorations/tether/.
- The tether stays a beam between bodies, not a physical cable.', 'Art', false, '[{"id":"s1","label":"Three stills or overlays of Low vs High tension exist in Docs/art-explorations/tether/.","done":false},{"id":"s2","label":"The tether stays a beam between bodies, not a physical cable.","done":false}]'::jsonb),
    ('Tether-P.2.3', 'Tether-P.2.3 Modular kit scale sheet', 'One scale sheet so later blockout pieces match. Starting sizes are already in Docs/StyleLock.md. Cite Docs/StyleLock.md.

Output: Docs/art-explorations/scale-sheet.md with player height, airlock height, ramp, resource size, one floor tile, and a simple diagram.

Definition of Done:
- Docs/art-explorations/scale-sheet.md documents player height, airlock height, ramp, resource size, and one floor tile.
- The sheet includes a simple diagram.', 'Art', false, '[{"id":"s1","label":"Docs/art-explorations/scale-sheet.md documents player height, airlock height, ramp, resource size, and one floor tile.","done":false},{"id":"s2","label":"The sheet includes a simple diagram.","done":false}]'::jsonb),
    ('Tether-P.3', 'Tether-P.3 QA templates', 'Templates for the first beam playtests. Staff Only.', 'QA', true, '[]'::jsonb),
    ('Tether-P.3.1', 'Tether-P.3.1 Dual-control checklist', 'Write Docs/qa/DualControlChecklist.md. Leave result rows blank. Do not tune physics in this task.

Output: Docs/qa/DualControlChecklist.md with rows: one player moves, two players move apart, one jumps, one walks off a ledge, short hang on the beam, tension readable from a spectator view. Leave a row for 3-4 when that layout is no longer Open.

Definition of Done:
- Docs/qa/DualControlChecklist.md exists with the listed rows.
- A 3-4 player row is left for when that layout is no longer Open.
- Result rows are blank.
- This task does not tune physics.', 'QA', true, '[{"id":"s1","label":"Docs/qa/DualControlChecklist.md exists with the listed rows.","done":false},{"id":"s2","label":"A 3-4 player row is left for when that layout is no longer Open.","done":false},{"id":"s3","label":"Result rows are blank.","done":false},{"id":"s4","label":"This task does not tune physics.","done":false}]'::jsonb),
    ('Tether-P.3.2', 'Tether-P.3.2 Playtest note template', 'Write Docs/qa/PlaytestNote.md with fields: date, build, testers, what felt good, what broke, recommended task change (not a new feature).

Output: Docs/qa/PlaytestNote.md.

Definition of Done:
- Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).', 'QA', true, '[{"id":"s1","label":"Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).","done":false}]'::jsonb),
    ('Tether-P.4', 'Tether-P.4 Community credit', 'Credit current off-site helpers. Blocked until the Grant Credit staff tool exists on the site.

Blocker: Blocked until the Grant Credit staff tool exists on the site.', 'Other', true, '[]'::jsonb),
    ('Tether-P.4.1', 'Tether-P.4.1 Credit current off-site helpers', 'Staff: use Grant Credit for current Discord moderators and any off-site help already given. Public line example: Discord moderation, September 2026. Pending email credits are allowed if they do not yet have a site account. Do not invent placeholder people. Do not complete this card without the real tool.

Output: Grant Credit entries for current off-site helpers (no invented people).

Definition of Done:
- Current Discord moderators and existing off-site help are credited with the Grant Credit staff tool.
- No placeholder people were invented.

Blocker: Blocked until the Grant Credit staff tool exists on the site.', 'Other', true, '[{"id":"s1","label":"Current Discord moderators and existing off-site help are credited with the Grant Credit staff tool.","done":false},{"id":"s2","label":"No placeholder people were invented.","done":false}]'::jsonb);

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
