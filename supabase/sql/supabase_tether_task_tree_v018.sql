-- Tether-4 from Tether_Task_Breakdown_v0.18 → staging board only.
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
  where slug = 'tether'
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found (slug=tether).';
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
    ('Tether-4', null, 'Tether-4 Resources and warp', 'The antimatter generator was damaged in the debris of the destroyed space station. A temporary generator is keeping the colony alive. It does not make enough power for the shields. Power cells feed the generator. Scrap repairs the metal walls around the buildings. Those walls are the only shield against the planet. No scrap, walls fail, buildings collapse, colony dies. Raw materials do not keep the colony alive. They buy weapons, tools, and upgrades. That is progress. Extra collectables convert to raw at warp. Each map has a colony power clock. Zero means the run is lost. Each map has a quota of power cells and scrap.

Source: Tether_Task_Breakdown_v0.18. Staging only. Do not publish. Pickup and warp Smalls 4.1.1–4.1.3 and 4.2.1–4.2.3 stay as written.', 'Code', 'Medium', 'Medium', true, 40, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-4.3', 'Tether-4', 'Tether-4.3 Raw materials', 'Stackable raw from world nodes. Cap Open. First metals: iron, copper, tin, gold, platinum. Crystal and energy crystal are raw types beside the metals. Glass is a candidate, not locked. Raw comes from ore veins, crystal clusters, and scrap piles. Raw is progress only. It buys weapons, tools, and upgrades. It does not keep the colony alive.

The antimatter generator was damaged in the debris of the destroyed space station. A temporary generator is keeping the colony alive. It does not make enough power for the shields. Power cells feed the generator. Scrap repairs the metal walls around the buildings. Those walls are the only shield against the planet. No scrap, walls fail, buildings collapse, colony dies. Raw materials do not keep the colony alive. They buy weapons, tools, and upgrades. That is progress. Extra collectables convert to raw at warp. Each map has a colony power clock. Zero means the run is lost. Each map has a quota of power cells and scrap.', 'Code', 'Medium', 'Medium', false, 30, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-4.3.0', 'Tether-4.3', 'Tether-4.3.0 Extractor', 'Default harvest tool. Also list it under Tether-7 tools when that epic is next edited. Harvest rules live here. No pickaxe. No drill. The player pulls a tool that melts only the metal in that vein, then an anti-gravity stream vacuums the molten metal into a containment cell that keeps it liquid. That cell is the stack.

Output: Extractor harvest tool. Melt plus vacuum, not a pickaxe.

Definition of Done:
- Tether-4.3.0.1 Extractor body and hold-to-harvest exist.
- Tether-4.3.0.2 Melt only the target metal. Other rock stays.
- Tether-4.3.0.3 Anti-gravity vacuum into liquid containment.
- Tether-4.3.0.4 Harvest read: glow of the specific metal. Stream you can see.', 'Code', 'Medium', 'Medium', true, 5, '{}'::text[], '[{"id":"s1","label":"Tether-4.3.0.1 Extractor body and hold-to-harvest exist.","done":false},{"id":"s2","label":"Tether-4.3.0.2 Melt only the target metal. Other rock stays.","done":false},{"id":"s3","label":"Tether-4.3.0.3 Anti-gravity vacuum into liquid containment.","done":false},{"id":"s4","label":"Tether-4.3.0.4 Harvest read: glow of the specific metal. Stream you can see.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.3.1', 'Tether-4.3', 'Tether-4.3.1 Docs/Resources.md', 'Groups, metals, nodes, quota, clock, converter. Link from README.

Output: Docs/Resources.md in the Tether repo, linked from README.

Definition of Done:
- Docs/Resources.md exists with groups, metals, nodes, quota, clock, and converter.
- README links Docs/Resources.md.', 'Writing', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Docs/Resources.md exists with groups, metals, nodes, quota, clock, and converter.","done":false},{"id":"s2","label":"README links Docs/Resources.md.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.3.2', 'Tether-4.3', 'Tether-4.3.2 Raw stack', 'Liquid containment per metal. Cap Open.

Definition of Done:
- Raw stacks as liquid containment per metal.
- Cap stays Open.', 'Code', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"Raw stacks as liquid containment per metal.","done":false},{"id":"s2","label":"Cap stays Open.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.3.3', 'Tether-4.3', 'Tether-4.3.3 Ore vein', 'Node with a set metal type. Harvest with the Extractor.

Output: Graybox ore vein node.

Definition of Done:
- An ore vein has a set metal type.
- The vein is harvested with the Extractor.', 'Level Design', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"An ore vein has a set metal type.","done":false},{"id":"s2","label":"The vein is harvested with the Extractor.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.3.4', 'Tether-4.3', 'Tether-4.3.4 Crystal cluster', 'Gives crystal or energy crystal. Harvest with the Extractor.

Output: Graybox crystal cluster.

Definition of Done:
- A crystal cluster gives crystal or energy crystal.
- The cluster is harvested with the Extractor.', 'Level Design', 'Easy', 'Small', false, 40, '{}'::text[], '[{"id":"s1","label":"A crystal cluster gives crystal or energy crystal.","done":false},{"id":"s2","label":"The cluster is harvested with the Extractor.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.3.5', 'Tether-4.3', 'Tether-4.3.5 Scrap pile', 'Breaks down into raw.

Output: Graybox scrap pile.

Definition of Done:
- A scrap pile breaks down into raw.', 'Level Design', 'Easy', 'Small', false, 50, '{}'::text[], '[{"id":"s1","label":"A scrap pile breaks down into raw.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.3.6', 'Tether-4.3', 'Tether-4.3.6 First metals', 'Iron, copper, tin, gold, platinum as data on veins.

Definition of Done:
- Veins can be iron, copper, tin, gold, or platinum.', 'Code', 'Easy', 'Small', true, 60, '{}'::text[], '[{"id":"s1","label":"Veins can be iron, copper, tin, gold, or platinum.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.3.7', 'Tether-4.3', 'Tether-4.3.7 Crystal and energy crystal', 'From clusters.

Definition of Done:
- Clusters grant crystal or energy crystal.', 'Code', 'Easy', 'Small', true, 70, '{}'::text[], '[{"id":"s1","label":"Clusters grant crystal or energy crystal.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.3.8', 'Tether-4.3', 'Tether-4.3.8 Mix on the six-node test map', 'Veins, clusters, and piles together. Do not replace 4.1.3. Extend that map.

Definition of Done:
- The Epic 4 six-node test map also has veins, clusters, and piles.
- Tether-4.1.3 is not replaced.', 'Level Design', 'Easy', 'Small', false, 80, '{}'::text[], '[{"id":"s1","label":"The Epic 4 six-node test map also has veins, clusters, and piles.","done":false},{"id":"s2","label":"Tether-4.1.3 is not replaced.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.3.9', 'Tether-4.3', 'Tether-4.3.9 Converter', 'Later. Bench that trades metals by value. Shape: if gold is worth 100 copper, 100 copper become 1 gold, or 1 gold becomes 100 copper. Exact rates Open. Do not invent rates on this card.

Definition of Done:
- Converter shape is metal-by-value trade.
- Exact rates stay Open. This card does not invent rates.', 'Code', 'Easy', 'Small', true, 90, '{}'::text[], '[{"id":"s1","label":"Converter shape is metal-by-value trade.","done":false},{"id":"s2","label":"Exact rates stay Open. This card does not invent rates.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.4', 'Tether-4', 'Tether-4.4 Collectables', 'Power cells and scrap keep the colony alive. Higher value scrap takes more pack space. Too big to pack is hands-only carry under Tether-4.1.2.

The antimatter generator was damaged in the debris of the destroyed space station. A temporary generator is keeping the colony alive. It does not make enough power for the shields. Power cells feed the generator. Scrap repairs the metal walls around the buildings. Those walls are the only shield against the planet. No scrap, walls fail, buildings collapse, colony dies. Raw materials do not keep the colony alive. They buy weapons, tools, and upgrades. That is progress. Extra collectables convert to raw at warp. Each map has a colony power clock. Zero means the run is lost. Each map has a quota of power cells and scrap.', 'Code', 'Medium', 'Medium', false, 40, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-4.4.1', 'Tether-4.4', 'Tether-4.4.1 Collectable data', 'Name, value, pack size, carry-only flag.

Definition of Done:
- Each collectable has a name, value, pack size, and carry-only flag.', 'Code', 'Easy', 'Small', true, 10, '{}'::text[], '[{"id":"s1","label":"Each collectable has a name, value, pack size, and carry-only flag.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.4.2', 'Tether-4.4', 'Tether-4.4.2 Power cell', 'Credits the power quota. Feeds the temporary generator.

Output: Graybox power cell.

Definition of Done:
- A power cell credits the power quota.
- It feeds the temporary generator.', 'Level Design', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"A power cell credits the power quota.","done":false},{"id":"s2","label":"It feeds the temporary generator.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.4.3', 'Tether-4.4', 'Tether-4.4.3 Scrap catalog', 'Short first list plus one oversized carry piece. More scraps wait on an Open Question. Do not invent a huge scrap list on this card.

Definition of Done:
- A short first scrap list exists plus one oversized carry piece.
- This card does not invent a huge scrap list.', 'Design', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"A short first scrap list exists plus one oversized carry piece.","done":false},{"id":"s2","label":"This card does not invent a huge scrap list.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.4.4', 'Tether-4.4', 'Tether-4.4.4 Extra collectables convert to raw', 'Happens at warp after quota is filled.

Definition of Done:
- Extra collectables convert to raw at warp after quota is filled.', 'Code', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Extra collectables convert to raw at warp after quota is filled.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.5', 'Tether-4', 'Tether-4.5 Consumables', 'Used on the map.', 'Code', 'Medium', 'Medium', false, 50, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-4.5.1', 'Tether-4.5', 'Tether-4.5.1 Tether charge', 'Refills beam health.

Definition of Done:
- A tether charge refills beam health.', 'Level Design', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"A tether charge refills beam health.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.5.2', 'Tether-4.5', 'Tether-4.5.2 Ammo pack', 'Refills Energy Canon and later guns.

Definition of Done:
- An ammo pack refills Energy Canon and later guns.', 'Level Design', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"An ammo pack refills Energy Canon and later guns.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.5.3', 'Tether-4.5', 'Tether-4.5.3 Shield charge', 'Refills crew shields.

Definition of Done:
- A shield charge refills crew shields.', 'Level Design', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"A shield charge refills crew shields.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.6', 'Tether-4', 'Tether-4.6 Quota, clock, warp', 'Does not replace 4.2. Adds fail and quota on top of warp.', 'Code', 'Medium', 'Medium', true, 60, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-4.6.1', 'Tether-4.6', 'Tether-4.6.1 Map quota', 'Power cells and scrap the colony needs this run. Visible before the crew leaves the airlock.

Definition of Done:
- A run has a quota of power cells and scrap.
- The quota is visible before the crew leaves the airlock.', 'Code', 'Easy', 'Small', true, 10, '{}'::text[], '[{"id":"s1","label":"A run has a quota of power cells and scrap.","done":false},{"id":"s2","label":"The quota is visible before the crew leaves the airlock.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.6.2', 'Tether-4.6', 'Tether-4.6.2 Colony power clock', 'Readable. Fail the run at zero. Numbers Open.

Definition of Done:
- A readable colony power clock exists.
- The run fails at zero. Numbers stay Open.', 'Code', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"A readable colony power clock exists.","done":false},{"id":"s2","label":"The run fails at zero. Numbers stay Open.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.6.3', 'Tether-4.6', 'Tether-4.6.3 Warp order', 'Fill quota, convert extra collectables to raw, bank raw for Tether-7.

Definition of Done:
- Warp fills quota, then converts extra collectables to raw, then banks raw for Tether-7.', 'Code', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"Warp fills quota, then converts extra collectables to raw, then banks raw for Tether-7.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-4.6.4', 'Tether-4.6', 'Tether-4.6.4 Guard value', 'Guard still picks the highest-value object in range. Value lives on collectables and on energy crystals. Do not reopen Tether-5.4.

Definition of Done:
- Guard value lives on collectables and on energy crystals.
- Tether-5.4 is not reopened.', 'Code', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Guard value lives on collectables and on energy crystals.","done":false},{"id":"s2","label":"Tether-5.4 is not reopened.","done":false}]'::jsonb, 'ToDo');

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
    and t.title ~ '^Tether-4\.[3456]([. ]|$)'
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
