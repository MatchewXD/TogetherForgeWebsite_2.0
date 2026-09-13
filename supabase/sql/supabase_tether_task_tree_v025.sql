-- Tether-9 Production look from Tether_Task_Breakdown_v0.25
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
      and t.title ~ '^Tether-9\.[0-9A-C]'
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
    ('Tether-9', null, 'Tether-9 Production look', 'Meshes, materials, icons. Tether-6.1 owns graybox shapes. Tether-11 owns clips. A look card paints a piece that already exists in the kit. It does not invent a tenth campaign map.

Look: worn mid-poly sci-fi. Cool colony tech. Beam carries the energy color. One suit silhouette. One scuffed metal. Basic and quick. Match Tether_Art_Reference_List.docx and Docs/StyleLock.md. Do not import Lethal Company or Deep Rock Galactic meshes.

Source: Tether_Task_Breakdown_v0.23 plus v0.25. Staging only. Do not publish.', 'Art', 'Medium', 'Medium', true, 90, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.0', 'Tether-9', 'Tether-9.0 Reference sheets', 'Pictures other artists copy. Output PNGs to Docs/ArtRef/ in the Tether repo. Link them from Docs/StyleLock.md.

Look: worn mid-poly sci-fi. Cool colony tech. Beam carries the energy color. One suit silhouette. One scuffed metal. Basic and quick. Match Tether_Art_Reference_List.docx and Docs/StyleLock.md. Do not import Lethal Company or Deep Rock Galactic meshes.', 'Art', 'Medium', 'Medium', true, 10, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.0.0', 'Tether-9.0', 'Tether-9.0.0 Mood board', 'Four shots from Lethal Company and Deep Rock Galactic. Each shot has a take line and a leave line. Not production meshes. Not a blocker for 9.1-9.8.

Definition of Done:
- Mood board has four shots.
- Each shot has a take line and a leave line.
- Shots are reference only. Not production meshes.

Do not import Lethal Company or Deep Rock Galactic meshes.', 'Art', 'Easy', 'Small', true, 10, '{}'::text[], '[{"id":"s1","label":"Mood board has four shots.","done":false},{"id":"s2","label":"Each shot has a take line and a leave line.","done":false},{"id":"s3","label":"Shots are reference only. Not production meshes.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.0.A', 'Tether-9.0', 'Tether-9.0.A Scale sheet', '180 cm mannequin on a 200 cm tile. Airlock a suited player can walk through. Ramp walkable with the beam on. Resource that reads in a gloved hand. Oversized scrap that needs two hands. Beam thickness at Low and at Over. Front shot with a meter grid.

Output: Docs/ArtRef/ scale sheet PNG.

Definition of Done:
- 180 cm mannequin stands on a 200 cm tile.
- Airlock is walkable for a suited player.
- Ramp is walkable with the beam on.
- A resource reads in a gloved hand.
- Oversized scrap needs two hands.
- Beam thickness is shown at Low and at Over.
- Front shot includes a meter grid.', 'Art', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"180 cm mannequin stands on a 200 cm tile.","done":false},{"id":"s2","label":"Airlock is walkable for a suited player.","done":false},{"id":"s3","label":"Ramp is walkable with the beam on.","done":false},{"id":"s4","label":"A resource reads in a gloved hand.","done":false},{"id":"s5","label":"Oversized scrap needs two hands.","done":false},{"id":"s6","label":"Beam thickness is shown at Low and at Over.","done":false},{"id":"s7","label":"Front shot includes a meter grid.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.0.B', 'Tether-9.0', 'Tether-9.0.B Suit sheet', 'One Tether crew. Helmet on. Pack on. Front, side, back. Empty hands, Extractor out, carrying oversized scrap. No second body shape.

Output: Docs/ArtRef/ suit sheet PNG.

Definition of Done:
- One Tether crew with helmet on and pack on.
- Front, side, and back views exist.
- Empty hands, Extractor out, and carrying oversized scrap are shown.
- No second body shape.', 'Art', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"One Tether crew with helmet on and pack on.","done":false},{"id":"s2","label":"Front, side, and back views exist.","done":false},{"id":"s3","label":"Empty hands, Extractor out, and carrying oversized scrap are shown.","done":false},{"id":"s4","label":"No second body shape.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.0.C', 'Tether-9.0', 'Tether-9.0.C World sheet', 'One interior wall tile. One exterior rock tile. One repeating crate or panel. One scuffed metal material ball. Same metal everyone else instances.

Output: Docs/ArtRef/ world sheet PNG.

Definition of Done:
- Interior wall tile, exterior rock tile, and a repeating crate or panel exist.
- One scuffed metal material ball is on the sheet.
- That metal is the instance target for the rest of the look.', 'Art', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Interior wall tile, exterior rock tile, and a repeating crate or panel exist.","done":false},{"id":"s2","label":"One scuffed metal material ball is on the sheet.","done":false},{"id":"s3","label":"That metal is the instance target for the rest of the look.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.0.1', 'Tether-9.0', 'Tether-9.0.1 ArtRef folder and StyleLock links', 'Blocked on 9.0.A, 9.0.B, 9.0.C existing as pictures.

Output: Docs/ArtRef/ PNGs linked from Docs/StyleLock.md.

Definition of Done:
- Docs/ArtRef/ holds the scale, suit, and world sheets.
- Docs/StyleLock.md links those pictures.', 'Art', 'Easy', 'Small', true, 50, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Docs/ArtRef/ holds the scale, suit, and world sheets.","done":false},{"id":"s2","label":"Docs/StyleLock.md links those pictures.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.0.2', 'Tether-9.0', 'Tether-9.0.2 Shared scuffed metal material', 'Blocked on 9.0.C. Master material in Content/Tether/Art. Everything else instances it.

Definition of Done:
- A master scuffed-metal material exists in Content/Tether/Art.
- Other look cards instance that material.', 'Art', 'Easy', 'Small', false, 60, ARRAY['Tether-9.0.C']::text[], '[{"id":"s1","label":"A master scuffed-metal material exists in Content/Tether/Art.","done":false},{"id":"s2","label":"Other look cards instance that material.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.0.3', 'Tether-9.0', 'Tether-9.0.3 Import path', 'FBX or glTF to Content/Tether/Art. Scale already 180 / 200.

Definition of Done:
- Import path lands FBX or glTF in Content/Tether/Art.
- Imported scale is already 180 / 200.', 'Art', 'Easy', 'Small', true, 70, '{}'::text[], '[{"id":"s1","label":"Import path lands FBX or glTF in Content/Tether/Art.","done":false},{"id":"s2","label":"Imported scale is already 180 / 200.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.0.4', 'Tether-9.0', 'Tether-9.0.4 Review rule', 'Off-sheet work is declined by citing the sheet.

Definition of Done:
- Off-sheet work is declined by citing the matching sheet.', 'Art', 'Easy', 'Small', true, 80, '{}'::text[], '[{"id":"s1","label":"Off-sheet work is declined by citing the matching sheet.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.1', 'Tether-9', 'Tether-9.1 Player', 'Player suit look. One silhouette. Sheet B.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Medium', 'Medium', false, 20, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.1.1', 'Tether-9.1', 'Tether-9.1.1 Suit body', 'Sheet B. Suit body. One Tether crew silhouette.

Definition of Done:
- A production look exists for Suit body.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 10, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Suit body.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.1.2', 'Tether-9.1', 'Tether-9.1.2 Helmet', 'Helmet on. Sheet B.

Definition of Done:
- A production look exists for Helmet.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 20, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Helmet.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.1.3', 'Tether-9.1', 'Tether-9.1.3 Pack', 'Pack on. Sheet B.

Definition of Done:
- A production look exists for Pack.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 30, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Pack.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.1.4', 'Tether-9.1', 'Tether-9.1.4 Gloves', 'Gloves. Held size is the scale for weapons.

Definition of Done:
- A production look exists for Gloves.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 40, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Gloves.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.1.5', 'Tether-9.1', 'Tether-9.1.5 Boots', 'Boots. Same silhouette.

Definition of Done:
- A production look exists for Boots.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 50, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Boots.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.1.6', 'Tether-9.1', 'Tether-9.1.6 Dirt pass', 'Same silhouette. Wear only.

Definition of Done:
- A production look exists for Dirt pass.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 60, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Dirt pass.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.2', 'Tether-9', 'Tether-9.2 Weapons and tools', 'Held size next to the glove.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Medium', 'Medium', false, 30, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.2.1', 'Tether-9.2', 'Tether-9.2.1 Hand Spark', 'Hand Spark held size next to the glove.

Definition of Done:
- A production look exists for Hand Spark.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 10, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Hand Spark.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.2.2', 'Tether-9.2', 'Tether-9.2.2 Nano-Knife', 'Nano-Knife held size next to the glove.

Definition of Done:
- A production look exists for Nano-Knife.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 20, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Nano-Knife.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.2.3', 'Tether-9.2', 'Tether-9.2.3 Beam Enforcer', 'Beam Enforcer held size next to the glove.

Definition of Done:
- A production look exists for Beam Enforcer.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 30, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Beam Enforcer.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.2.4', 'Tether-9.2', 'Tether-9.2.4 Extractor body', 'Extractor body held size next to the glove.

Definition of Done:
- A production look exists for Extractor body.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 40, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Extractor body.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.2.5', 'Tether-9.2', 'Tether-9.2.5 Extractor vacuum stream look', 'Extractor vacuum stream look. Not a pickaxe.

Definition of Done:
- A production look exists for Extractor vacuum stream look.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 50, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Extractor vacuum stream look.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.2.6', 'Tether-9.2', 'Tether-9.2.6 Grapple hook', 'Grapple hook held size next to the glove.

Definition of Done:
- A production look exists for Grapple hook.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 60, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Grapple hook.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.2.7', 'Tether-9.2', 'Tether-9.2.7 Boost pack housing', 'Boost pack housing. Same silhouette as the pack.

Definition of Done:
- A production look exists for Boost pack housing.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 70, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Boost pack housing.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.2.8', 'Tether-9.2', 'Tether-9.2.8 Energy Canon', 'Later than Spark, knife, Enforcer, Extractor.

Definition of Done:
- A production look exists for Energy Canon.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 80, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Energy Canon.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.2.9', 'Tether-9.2', 'Tether-9.2.9 Snare gun and cable look', 'Later.

Definition of Done:
- A production look exists for Snare gun and cable look.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 90, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Snare gun and cable look.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3', 'Tether-9', 'Tether-9.3 Resources', 'Resource looks. A resource that reads in a gloved hand. Oversized scrap needs two hands.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Medium', 'Medium', false, 40, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.3.1', 'Tether-9.3', 'Tether-9.3.1 Ore vein', 'Readable metal type on the rock.

Definition of Done:
- A production look exists for Ore vein.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 10, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Ore vein.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.2', 'Tether-9.3', 'Tether-9.3.2 Crystal cluster', 'Crystal cluster look.

Definition of Done:
- A production look exists for Crystal cluster.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 20, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Crystal cluster.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.3', 'Tether-9.3', 'Tether-9.3.3 Energy crystal cluster', 'Energy crystal cluster look.

Definition of Done:
- A production look exists for Energy crystal cluster.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 30, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Energy crystal cluster.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.4', 'Tether-9.3', 'Tether-9.3.4 Scrap pile', 'Scrap pile look.

Definition of Done:
- A production look exists for Scrap pile.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 40, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Scrap pile.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.5', 'Tether-9.3', 'Tether-9.3.5 Power cell', 'Power cell. Reads in a gloved hand.

Definition of Done:
- A production look exists for Power cell.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 50, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Power cell.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.6', 'Tether-9.3', 'Tether-9.3.6 Pack scrap A', 'Pack scrap A. Reads in a gloved hand.

Definition of Done:
- A production look exists for Pack scrap A.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 60, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Pack scrap A.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.7', 'Tether-9.3', 'Tether-9.3.7 Pack scrap B', 'Pack scrap B. Reads in a gloved hand.

Definition of Done:
- A production look exists for Pack scrap B.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 70, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Pack scrap B.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.8', 'Tether-9.3', 'Tether-9.3.8 Pack scrap C', 'Pack scrap C. Reads in a gloved hand.

Definition of Done:
- A production look exists for Pack scrap C.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 80, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Pack scrap C.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.9', 'Tether-9.3', 'Tether-9.3.9 Oversized carry scrap', 'One hero piece. Two hands.

Definition of Done:
- A production look exists for Oversized carry scrap.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 90, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Oversized carry scrap.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.10', 'Tether-9.3', 'Tether-9.3.10 Tether charge pickup', 'Tether charge pickup look.

Definition of Done:
- A production look exists for Tether charge pickup.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 100, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Tether charge pickup.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.11', 'Tether-9.3', 'Tether-9.3.11 Ammo pack pickup', 'Ammo pack pickup look.

Definition of Done:
- A production look exists for Ammo pack pickup.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 110, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Ammo pack pickup.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.12', 'Tether-9.3', 'Tether-9.3.12 Shield charge pickup', 'Shield charge pickup look.

Definition of Done:
- A production look exists for Shield charge pickup.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 120, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Shield charge pickup.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.13', 'Tether-9.3', 'Tether-9.3.13 Warp pad look', 'Warp pad look. Paint the kit piece. Do not invent a tenth map.

Definition of Done:
- A production look exists for Warp pad look.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 130, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Warp pad look.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.3.14', 'Tether-9.3', 'Tether-9.3.14 Resource pad look', 'Resource pad look. Paint the kit piece.

Definition of Done:
- A production look exists for Resource pad look.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 140, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Resource pad look.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4', 'Tether-9', 'Tether-9.4 World kit look', 'Paint Tether-6.1 families. Do not unique-sculpt a mountain.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Tether-6.1 owns graybox shapes. This card paints those pieces.', 'Art', 'Medium', 'Medium', false, 50, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.4.1', 'Tether-9.4', 'Tether-9.4.1 Ground floor tile', 'Paint the Tether-6.1 ground floor tile.

Definition of Done:
- A production look exists for Ground floor tile.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 10, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Ground floor tile.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.2', 'Tether-9.4', 'Tether-9.4.2 Ground ramp', 'Paint the Tether-6.1 ground ramp. Walkable with the beam on.

Definition of Done:
- A production look exists for Ground ramp.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 20, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Ground ramp.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.3', 'Tether-9.4', 'Tether-9.4.3 Ground ledge', 'Paint the Tether-6.1 ground ledge.

Definition of Done:
- A production look exists for Ground ledge.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 30, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Ground ledge.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.4', 'Tether-9.4', 'Tether-9.4.4 Wrap pillar', 'Paint the Tether-6.1 wrap pillar.

Definition of Done:
- A production look exists for Wrap pillar.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 40, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Wrap pillar.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.5', 'Tether-9.4', 'Tether-9.4.5 Hang lip', 'Paint the Tether-6.1 hang lip.

Definition of Done:
- A production look exists for Hang lip.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 50, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Hang lip.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.6', 'Tether-9.4', 'Tether-9.4.6 Island landing pad', 'Paint the Tether-6.1 island landing pad.

Definition of Done:
- A production look exists for Island landing pad.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 60, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Island landing pad.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.7', 'Tether-9.4', 'Tether-9.4.7 Drift rock', 'Paint the Tether-6.1 drift rock. Do not unique-sculpt a mountain.

Definition of Done:
- A production look exists for Drift rock.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 70, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Drift rock.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.8', 'Tether-9.4', 'Tether-9.4.8 Gap marker', 'Paint the Tether-6.1 gap marker.

Definition of Done:
- A production look exists for Gap marker.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 80, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Gap marker.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.9', 'Tether-9.4', 'Tether-9.4.9 Space strut', 'Paint the Tether-6.1 space strut.

Definition of Done:
- A production look exists for Space strut.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 90, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Space strut.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.10', 'Tether-9.4', 'Tether-9.4.10 Space ring', 'Paint the Tether-6.1 space ring.

Definition of Done:
- A production look exists for Space ring.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 100, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Space ring.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.11', 'Tether-9.4', 'Tether-9.4.11 No-floor room piece', 'Paint the Tether-6.1 no-floor room piece.

Definition of Done:
- A production look exists for No-floor room piece.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 110, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for No-floor room piece.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.12', 'Tether-9.4', 'Tether-9.4.12 Gravity well mouth', 'Paint the Tether-6.1 gravity well mouth.

Definition of Done:
- A production look exists for Gravity well mouth.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 120, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Gravity well mouth.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.13', 'Tether-9.4', 'Tether-9.4.13 Enemy marker', 'Paint the Tether-6.1 enemy marker.

Definition of Done:
- A production look exists for Enemy marker.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 130, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Enemy marker.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.14', 'Tether-9.4', 'Tether-9.4.14 Nest crack', 'Paint the Tether-6.1 nest crack.

Definition of Done:
- A production look exists for Nest crack.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 140, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Nest crack.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.15', 'Tether-9.4', 'Tether-9.4.15 Habitat wall', 'Sheet C interior. Paint the habitat wall.

Definition of Done:
- A production look exists for Habitat wall.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 150, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Habitat wall.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.16', 'Tether-9.4', 'Tether-9.4.16 Airlock', 'Airlock a suited player can walk through.

Definition of Done:
- A production look exists for Airlock.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 160, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Airlock.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.4.17', 'Tether-9.4', 'Tether-9.4.17 Finale station piece', 'Same kit. Later volume for the creature.

Definition of Done:
- A production look exists for Finale station piece.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Paint Tether-6.1 families. Do not unique-sculpt a mountain.', 'Art', 'Easy', 'Small', false, 170, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Finale station piece.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.5', 'Tether-9', 'Tether-9.5 Creatures', 'Mesh and material only. Clips are Tether-11.2.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Tether-11 owns clips. This epic does not rewrite Tether-11.', 'Art', 'Medium', 'Medium', false, 60, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.5.1', 'Tether-9.5', 'Tether-9.5.1 Snatch mesh', 'Snatch mesh and material. Clips are Tether-11.2.

Definition of Done:
- A production mesh and material exist for Snatch mesh.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Mesh and material only. Clips are Tether-11.2.', 'Art', 'Easy', 'Small', false, 10, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production mesh and material exist for Snatch mesh.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.5.2', 'Tether-9.5', 'Tether-9.5.2 Latch mesh', 'Latch mesh and material. Clips are Tether-11.2.

Definition of Done:
- A production mesh and material exist for Latch mesh.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Mesh and material only. Clips are Tether-11.2.', 'Art', 'Easy', 'Small', false, 20, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production mesh and material exist for Latch mesh.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.5.3', 'Tether-9.5', 'Tether-9.5.3 Tick mesh', 'Tick mesh and material. Clips are Tether-11.2.

Definition of Done:
- A production mesh and material exist for Tick mesh.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Mesh and material only. Clips are Tether-11.2.', 'Art', 'Easy', 'Small', false, 30, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production mesh and material exist for Tick mesh.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.5.4', 'Tether-9.5', 'Tether-9.5.4 Guard mesh', 'Guard mesh and material. Clips are Tether-11.2.

Definition of Done:
- A production mesh and material exist for Guard mesh.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Mesh and material only. Clips are Tether-11.2.', 'Art', 'Easy', 'Small', false, 40, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production mesh and material exist for Guard mesh.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.5.5', 'Tether-9.5', 'Tether-9.5.5 Spore mesh', 'Spore mesh and material. Clips are Tether-11.2.

Definition of Done:
- A production mesh and material exist for Spore mesh.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Mesh and material only. Clips are Tether-11.2.', 'Art', 'Easy', 'Small', false, 50, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production mesh and material exist for Spore mesh.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.5.6', 'Tether-9.5', 'Tether-9.5.6 Finale creature mesh', 'Later. No mesh until there is a brief.

Definition of Done:
- Finale creature mesh waits for a brief.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Later. Mesh and material only. Clips are Tether-11.2.', 'Art', 'Easy', 'Small', true, 60, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Finale creature mesh waits for a brief.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.6', 'Tether-9', 'Tether-9.6 Colony faces', 'Colony faces. Not a walkable town.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Medium', 'Medium', false, 70, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.6.1', 'Tether-9.6', 'Tether-9.6.1 Comms NPC bust', 'One character for the quota briefing.

Definition of Done:
- A comms NPC bust exists for the quota briefing.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 10, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A comms NPC bust exists for the quota briefing.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.6.2', 'Tether-9.6', 'Tether-9.6.2 Distant colony building tile', 'Backdrop. Not a walkable town.

Definition of Done:
- A distant colony building tile exists as a backdrop.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 20, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A distant colony building tile exists as a backdrop.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7', 'Tether-9', 'Tether-9.7 HUD and menus', 'Art only. Layout is Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8. This epic does not rewrite Tether-8.', 'Art', 'Medium', 'Medium', false, 80, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.7.1', 'Tether-9.7', 'Tether-9.7.1 Health bar frame', 'Health bar frame art. Layout is Tether-8.

Definition of Done:
- Art exists for Health bar frame. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 10, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Health bar frame. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7.2', 'Tether-9.7', 'Tether-9.7.2 Shield bar frame', 'Shield bar frame art. Layout is Tether-8.

Definition of Done:
- Art exists for Shield bar frame. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 20, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Shield bar frame. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7.3', 'Tether-9.7', 'Tether-9.7.3 Power clock ring art', 'Power clock ring art. Layout is Tether-8.

Definition of Done:
- Art exists for Power clock ring art. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 30, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Power clock ring art. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7.4', 'Tether-9.7', 'Tether-9.7.4 Quota and extract tick type', 'Quota and extract tick type. Layout is Tether-8.

Definition of Done:
- Art exists for Quota and extract tick type. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 40, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Quota and extract tick type. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7.5', 'Tether-9.7', 'Tether-9.7.5 Main menu frame', 'Main menu frame art. Layout is Tether-8.

Definition of Done:
- Art exists for Main menu frame. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 50, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Main menu frame. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7.6', 'Tether-9.7', 'Tether-9.7.6 Play Host Join frames', 'Play, Host, Join frames. Layout is Tether-8.

Definition of Done:
- Art exists for Play Host Join frames. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 60, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Play Host Join frames. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7.7', 'Tether-9.7', 'Tether-9.7.7 Pause and Settings frames', 'Pause and Settings frames. Layout is Tether-8.

Definition of Done:
- Art exists for Pause and Settings frames. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 70, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Pause and Settings frames. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7.8', 'Tether-9.7', 'Tether-9.7.8 Warp stats and Gear Up tabs', 'Warp stats and Gear Up tab art. Layout is Tether-8.

Definition of Done:
- Art exists for Warp stats and Gear Up tabs. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 80, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Warp stats and Gear Up tabs. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7.9', 'Tether-9.7', 'Tether-9.7.9 Fail and success frames', 'Fail and success frame art. Layout is Tether-8.

Definition of Done:
- Art exists for Fail and success frames. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 90, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Fail and success frames. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.7.10', 'Tether-9.7', 'Tether-9.7.10 Join the Forge button', 'Join the Forge button art. Layout is Tether-8.

Definition of Done:
- Art exists for Join the Forge button. Layout stays on Tether-8.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Art only. Layout is Tether-8.', 'Art', 'Easy', 'Small', false, 100, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"Art exists for Join the Forge button. Layout stays on Tether-8.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.8', 'Tether-9', 'Tether-9.8 Beam and hits', 'Beam and hit looks. Beam carries the energy color.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.

Look: worn mid-poly sci-fi. Cool colony tech. Beam carries the energy color. One suit silhouette. One scuffed metal. Basic and quick. Match Tether_Art_Reference_List.docx and Docs/StyleLock.md. Do not import Lethal Company or Deep Rock Galactic meshes.', 'Art', 'Medium', 'Medium', false, 90, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-9.8.1', 'Tether-9.8', 'Tether-9.8.1 Beam quiet look', 'Beam quiet look. Beam carries the energy color.

Definition of Done:
- A production look exists for Beam quiet look.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 10, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Beam quiet look.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.8.2', 'Tether-9.8', 'Tether-9.8.2 Beam loud look', 'Beam loud look. Beam carries the energy color.

Definition of Done:
- A production look exists for Beam loud look.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 20, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Beam loud look.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.8.3', 'Tether-9.8', 'Tether-9.8.3 Lock look', 'Tether Lock look.

Definition of Done:
- A production look exists for Lock look.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 30, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Lock look.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.8.4', 'Tether-9.8', 'Tether-9.8.4 Snap look', 'Tether snap look.

Definition of Done:
- A production look exists for Snap look.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 40, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Snap look.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.8.5', 'Tether-9.8', 'Tether-9.8.5 Hit spark', 'Hit spark look.

Definition of Done:
- A production look exists for Hit spark.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 50, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Hit spark.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.8.6', 'Tether-9.8', 'Tether-9.8.6 Damage pop frame', 'Damage pop frame art.

Definition of Done:
- A production look exists for Damage pop frame.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 60, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Damage pop frame.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.8.7', 'Tether-9.8', 'Tether-9.8.7 Nanite inside-target cue', 'Nanite inside-target cue look.

Definition of Done:
- A production look exists for Nanite inside-target cue.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 70, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Nanite inside-target cue.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-9.8.8', 'Tether-9.8', 'Tether-9.8.8 Shield chew cue', 'Shield chew cue look. Shield damage also hits the beam.

Definition of Done:
- A production look exists for Shield chew cue.

Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.', 'Art', 'Easy', 'Small', false, 80, ARRAY['Tether-9.0.A', 'Tether-9.0.B', 'Tether-9.0.C']::text[], '[{"id":"s1","label":"A production look exists for Shield chew cue.","done":false}]'::jsonb, 'ToDo');

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
    and a.title ~ '^Tether-9\.[1-8]([. ]|$)'
    and b.title ~ '^Tether-9\.0\.0([. ]|$)';

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
