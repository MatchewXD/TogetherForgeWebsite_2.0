-- Tether-6 Maps from Tether_Task_Breakdown_v0.14 → staging board only.
-- Upsert by title / ID prefix. Does not publish. Does not write public rows.
-- Does not rewrite Tether-4 or Tether-5. Does not add Tether-5.6.
-- Kit is 6.1 (first). Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v014.sql

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

  -- Remap leftover IDs whose meaning changed (staging only).
  update public.tasks t
  set title = 'Tether-6.2.1 Map 1 spine'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-6.1.2 %'
    and t.title not like 'Tether-6.1.2.%'
    and t.title ~* 'Level_01_Surface|Level 01';

  update public.tasks t
  set title = 'Tether-6.6 Unofficial maps'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-6.3 %'
    and t.title not like 'Tether-6.3.%'
    and t.title ~* 'unofficial|community map';

  update public.tasks t
  set title = 'Tether-6.1 Modular kit'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-6.5 %'
    and t.title not like 'Tether-6.5.%'
    and t.title ~* 'kit|modular';

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
    ('Tether-6', null, 'Tether-6 Maps', 'Official run: 9 maps in 3 sections of 3, plus one finale arena. Semi-procedural. A map is a spine plus slots. Slots accept modular kit pieces. Kit is built first. Do not unique-sculpt a map that cannot accept kit pieces.

Source: Tether_Task_Breakdown_v0.14. Staging only. Do not publish.', 'Level Design', 'Medium', 'Medium', true, 60, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-6.0', 'Tether-6', 'Tether-6.0 Spine and shuffle rules', 'Write this before helpers drop pieces.', 'Design', 'Medium', 'Medium', true, 5, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-6.0.1', 'Tether-6.0', 'Tether-6.0.1 Docs/Maps.md', 'Campaign list. Spine per section. What may shuffle. What must stay. Link from README.

Output: Docs/Maps.md in the Tether repo, linked from README.

Definition of Done:
- Docs/Maps.md exists with the campaign list, spine per section, what may shuffle, and what must stay.
- README links Docs/Maps.md.', 'Writing', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Docs/Maps.md exists with the campaign list, spine per section, what may shuffle, and what must stay.","done":false},{"id":"s2","label":"README links Docs/Maps.md.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.0.2', 'Tether-6.0', 'Tether-6.0.2 Seed rule', 'Daily, per-session, or player choice. Open until Matthew picks it. Write the pick in Docs/Maps.md.

Definition of Done:
- Matthew picks daily, per-session, or player choice.
- The pick is written in Docs/Maps.md.', 'Design', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"Matthew picks daily, per-session, or player choice.","done":false},{"id":"s2","label":"The pick is written in Docs/Maps.md.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.0.3', 'Tether-6.0', 'Tether-6.0.3 Slot language', 'A slot accepts one kit piece from a named list.

Definition of Done:
- Slot language is written: one kit piece from a named list.', 'Design', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"Slot language is written: one kit piece from a named list.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.0.4', 'Tether-6.0', 'Tether-6.0.4 Theme gate', 'Official slots only take on-theme pieces. Off-theme pieces go to unofficial maps.

Definition of Done:
- Official slots only accept on-theme pieces.
- Off-theme pieces are routed to unofficial maps.', 'Design', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Official slots only accept on-theme pieces.","done":false},{"id":"s2","label":"Off-theme pieces are routed to unofficial maps.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.1', 'Tether-6', 'Tether-6.1 Modular kit', 'FIRST BUILD. Content/Tether/Modular. StyleLock scale: player about 180 cm, floor tile 200 cm, ramps walkable with the beam on. Build by family. Close a family when that section needs it. Do not wait for every family before Map 1.

Output: Content/Tether/Modular kit families.', 'Level Design', 'Medium', 'Medium', false, 10, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-6.1.1', 'Tether-6.1', 'Tether-6.1.1 Folder naming and piece list', 'Folder, naming, and piece list in Docs/Maps.md.

Definition of Done:
- Docs/Maps.md records the Modular folder, naming, and piece list.', 'Writing', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Docs/Maps.md records the Modular folder, naming, and piece list.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.1.2', 'Tether-6.1', 'Tether-6.1.2 Ground kit family', 'Floors, ramps, ledges, wrap pillars, beginner hang lips. Required before Section 1 maps.

Output: Ground kit family in Content/Tether/Modular.

Definition of Done:
- Ground kit includes floors, ramps, ledges, wrap pillars, and beginner hang lips.
- Pieces follow StyleLock scale and are walkable with the beam on.', 'Level Design', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"Ground kit includes floors, ramps, ledges, wrap pillars, and beginner hang lips.","done":false},{"id":"s2","label":"Pieces follow StyleLock scale and are walkable with the beam on.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.1.3', 'Tether-6.1', 'Tether-6.1.3 Island and rock kit family', 'Landing pads, gap markers, drift rocks. Required before Section 2 maps.

Output: Island and rock kit family in Content/Tether/Modular.

Definition of Done:
- Landing pads, gap markers, and drift rocks exist in the kit.', 'Level Design', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"Landing pads, gap markers, and drift rocks exist in the kit.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.1.4', 'Tether-6.1', 'Tether-6.1.4 Space kit family', 'Struts, rings, no-floor rooms, well mouth. Required before Section 3 maps and the arena.

Output: Space kit family in Content/Tether/Modular.

Definition of Done:
- Struts, rings, no-floor rooms, and a well mouth exist in the kit.', 'Level Design', 'Easy', 'Small', false, 40, '{}'::text[], '[{"id":"s1","label":"Struts, rings, no-floor rooms, and a well mouth exist in the kit.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.1.5', 'Tether-6.1', 'Tether-6.1.5 Utility kit pieces', 'Resource pad, warp pad, enemy marker, spore-legal ground, nest crack. Needed as soon as a map uses them.

Output: Utility kit pieces in Content/Tether/Modular.

Definition of Done:
- Resource pad, warp pad, enemy marker, spore-legal ground, and nest crack exist.', 'Level Design', 'Easy', 'Small', false, 50, '{}'::text[], '[{"id":"s1","label":"Resource pad, warp pad, enemy marker, spore-legal ground, and nest crack exist.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.1.6', 'Tether-6.1', 'Tether-6.1.6 Slot sockets', 'Invisible volumes on a spine that accept one piece from a list. Required before shuffle can run.

Definition of Done:
- Slot sockets exist as invisible volumes on a spine.
- A socket accepts one piece from a named list.', 'Code', 'Easy', 'Small', true, 60, '{}'::text[], '[{"id":"s1","label":"Slot sockets exist as invisible volumes on a spine.","done":false},{"id":"s2","label":"A socket accepts one piece from a named list.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.1.7', 'Tether-6.1', 'Tether-6.1.7 Kit hero art', 'Blocked on CD.1. Graybox closes 6.1.

Definition of Done:
- Hero kit art waits on Tether-CD.1.
- Graybox kit is enough to close Medium 6.1.

Blocker: Waiting on Tether-CD.1.', 'Art', 'Easy', 'Small', true, 70, ARRAY['Tether-CD.1']::text[], '[{"id":"s1","label":"Hero kit art waits on Tether-CD.1.","done":false},{"id":"s2","label":"Graybox kit is enough to close Medium 6.1.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.2', 'Tether-6', 'Tether-6.2 Section 1 beginner ground', 'Low world. Start low, climb high. Map 1 easiest, Map 2 a step up, Map 3 hardest of the three. No grapple. No zero-g. Assemble from kit pieces.

Blocker: Waiting on Tether-6.1.2.', 'Level Design', 'Medium', 'Medium', true, 20, ARRAY['Tether-6.1.2']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-6.2.1', 'Tether-6.2', 'Tether-6.2.1 Map 1 spine', 'Teaching map. Short climb. Wide ledges. One easy wrap or tight path. Resource pocket. Warp or checkpoint at the top.

Definition of Done:
- Map 1 is a short climb with wide ledges and one easy wrap or tight path.
- A resource pocket exists. Warp or checkpoint sits at the top.', 'Level Design', 'Easy', 'Small', true, 10, '{}'::text[], '[{"id":"s1","label":"Map 1 is a short climb with wide ledges and one easy wrap or tight path.","done":false},{"id":"s2","label":"A resource pocket exists. Warp or checkpoint sits at the top.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.2.2', 'Tether-6.2', 'Tether-6.2.2 Map 2 spine', 'Same language, longer or tighter. One extra challenge slot.

Definition of Done:
- Map 2 uses the same language, longer or tighter, with one extra challenge slot.', 'Level Design', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"Map 2 uses the same language, longer or tighter, with one extra challenge slot.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.2.3', 'Tether-6.2', 'Tether-6.2.3 Map 3 spine', 'Hardest ground map. Still readable. Still low world.

Definition of Done:
- Map 3 is the hardest ground map and stays readable and low-world.', 'Level Design', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"Map 3 is the hardest ground map and stays readable and low-world.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.2.4', 'Tether-6.2', 'Tether-6.2.4 Section 1 slot list', 'Legal ground pieces only.

Definition of Done:
- Section 1 slots accept legal ground pieces only.', 'Design', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Section 1 slots accept legal ground pieces only.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.2.5', 'Tether-6.2', 'Tether-6.2.5 Section 1 enemy markers', 'Optional. Empty until a creature is wired.

Definition of Done:
- Enemy markers may sit empty until a creature is wired.', 'Level Design', 'Easy', 'Small', false, 50, '{}'::text[], '[{"id":"s1","label":"Enemy markers may sit empty until a creature is wired.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.2.6', 'Tether-6.2', 'Tether-6.2.6 Section 1 playtest', 'Beam on. Two people.

Definition of Done:
- Section 1 is playtested with the beam on and two people.', 'QA', 'Easy', 'Small', true, 60, '{}'::text[], '[{"id":"s1","label":"Section 1 is playtested with the beam on and two people.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.3', 'Tether-6', 'Tether-6.3 Section 2 floating rocks and islands', 'Grapple unlocks here (Tether-11.4). Map 4 easy test of the section. Map 5 more intense. Map 6 hardest of the three and ends in the gravity well.

Blocker: Waiting on Tether-6.1.3.', 'Level Design', 'Medium', 'Medium', true, 30, ARRAY['Tether-6.1.3']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-6.3.1', 'Tether-6.3', 'Tether-6.3.1 Map 4 spine', 'Intro to gaps and islands.

Definition of Done:
- Map 4 introduces gaps and islands.', 'Level Design', 'Easy', 'Small', true, 10, '{}'::text[], '[{"id":"s1","label":"Map 4 introduces gaps and islands.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.3.2', 'Tether-6.3', 'Tether-6.3.2 Map 5 spine', 'More gaps and challenge slots.

Definition of Done:
- Map 5 adds more gaps and challenge slots.', 'Level Design', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"Map 5 adds more gaps and challenge slots.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.3.3', 'Tether-6.3', 'Tether-6.3.3 Map 6 spine', 'Hardest island map. Ends at the gravity well.

Definition of Done:
- Map 6 is the hardest island map and ends at the gravity well.', 'Level Design', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"Map 6 is the hardest island map and ends at the gravity well.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.3.4', 'Tether-6.3', 'Tether-6.3.4 Gravity well piece', 'Lives in the kit, then sits in the Map 6 end slot. Readable pull. Beam rules still apply. Numbers Open.

Definition of Done:
- A gravity-well piece exists in the kit and sits in the Map 6 end slot.
- Pull is readable. Beam rules still apply. Numbers stay Open.', 'Code', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"A gravity-well piece exists in the kit and sits in the Map 6 end slot.","done":false},{"id":"s2","label":"Pull is readable. Beam rules still apply. Numbers stay Open.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.3.5', 'Tether-6.3', 'Tether-6.3.5 Section 2 slot list', 'Legal island and rock pieces for Section 2 slots.

Definition of Done:
- Section 2 slots have a legal piece list.', 'Design', 'Easy', 'Small', true, 50, '{}'::text[], '[{"id":"s1","label":"Section 2 slots have a legal piece list.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.3.6', 'Tether-6.3', 'Tether-6.3.6 Section 2 waits on grapple', 'Spines can be laid out before Tether-11.4 exists. Playtests wait on a usable hook.

Definition of Done:
- Spines may be laid out before Tether-11.4.
- Playtests wait on a usable grapple hook.', 'Design', 'Easy', 'Small', true, 60, '{}'::text[], '[{"id":"s1","label":"Spines may be laid out before Tether-11.4.","done":false},{"id":"s2","label":"Playtests wait on a usable grapple hook.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.3.7', 'Tether-6.3', 'Tether-6.3.7 Section 2 playtest', 'Section 2 playtest waits on a usable grapple hook.

Definition of Done:
- Section 2 is playtested with a usable grapple hook.

Blocker: Waiting on Tether-11.4.', 'QA', 'Easy', 'Small', true, 70, ARRAY['Tether-11.4']::text[], '[{"id":"s1","label":"Section 2 is playtested with a usable grapple hook.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.4', 'Tether-6', 'Tether-6.4 Section 3 space', 'No gravity. Boost pack is Tether-11.5: a short weak shove while not touching a surface. Assist only. A stuck player still needs a teammate on a surface or on the line. Fail the pack if a solo player can finish the map without the beam.

Blocker: Waiting on Tether-6.1.4.', 'Level Design', 'Medium', 'Medium', true, 40, ARRAY['Tether-6.1.4']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-6.4.1', 'Tether-6.4', 'Tether-6.4.1 Map 7 spine', 'Intro space. Teaches no-floor play and that the pack cannot replace the line.

Definition of Done:
- Map 7 teaches no-floor play and that the pack cannot replace the line.', 'Level Design', 'Easy', 'Small', true, 10, '{}'::text[], '[{"id":"s1","label":"Map 7 teaches no-floor play and that the pack cannot replace the line.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.4.2', 'Tether-6.4', 'Tether-6.4.2 Map 8 spine', 'Harder space.

Definition of Done:
- Map 8 is a harder space layout.', 'Level Design', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"Map 8 is a harder space layout.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.4.3', 'Tether-6.4', 'Tether-6.4.3 Map 9 spine', 'Hardest space map before the arena.

Definition of Done:
- Map 9 is the hardest space map before the arena.', 'Level Design', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"Map 9 is the hardest space map before the arena.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.4.4', 'Tether-6.4', 'Tether-6.4.4 Section 3 slot list', 'Legal space pieces for Section 3 slots.

Definition of Done:
- Section 3 slots have a legal piece list.', 'Design', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Section 3 slots have a legal piece list.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.4.5', 'Tether-6.4', 'Tether-6.4.5 Section 3 waits on boost pack', 'Playtests wait on Tether-11.5.

Definition of Done:
- Section 3 playtests wait on Tether-11.5.', 'Design', 'Easy', 'Small', true, 50, '{}'::text[], '[{"id":"s1","label":"Section 3 playtests wait on Tether-11.5.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.4.6', 'Tether-6.4', 'Tether-6.4.6 Section 3 playtest', 'Section 3 playtest waits on the boost pack.

Definition of Done:
- Section 3 is playtested with Tether-11.5.

Blocker: Waiting on Tether-11.5.', 'QA', 'Easy', 'Small', true, 60, ARRAY['Tether-11.5']::text[], '[{"id":"s1","label":"Section 3 is playtested with Tether-11.5.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.5', 'Tether-6', 'Tether-6.5 Finale arena', 'After Map 9. Arena, not a climb. Station feel. Win idea: antimatter generator through the warp portal. Opponent is an idea only. Very large dangerous unknown alien. Big enough to move space station parts around. No fight card. No Tether-5.6.

Blocker: Waiting on Tether-6.1.4 and Tether-6.1.5.', 'Level Design', 'Medium', 'Medium', true, 50, ARRAY['Tether-6.1.4', 'Tether-6.1.5']::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-6.5.1', 'Tether-6.5', 'Tether-6.5.1 Arena spine', 'Space and utility pieces. Leave a large volume the creature could occupy later.

Definition of Done:
- Arena spine uses space and utility pieces.
- A large volume is left for a creature later. No fight card.', 'Level Design', 'Easy', 'Small', true, 10, '{}'::text[], '[{"id":"s1","label":"Arena spine uses space and utility pieces.","done":false},{"id":"s2","label":"A large volume is left for a creature later. No fight card.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.5.2', 'Tether-6.5', 'Tether-6.5.2 Generator pickup', 'Uses Epic 4 carry. One object.

Definition of Done:
- One generator object uses the Epic 4 carry.', 'Code', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"One generator object uses the Epic 4 carry.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.5.3', 'Tether-6.5', 'Tether-6.5.3 Portal send', 'Warp the generator. Session complete message.

Definition of Done:
- Warping the generator works.
- A session-complete message plays.', 'Code', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"Warping the generator works.","done":false},{"id":"s2","label":"A session-complete message plays.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.5.4', 'Tether-6.5', 'Tether-6.5.4 Boss idea note', 'One paragraph in Docs/Maps.md. Large unknown alien that can shove station parts. Stop there.

Definition of Done:
- Docs/Maps.md has one paragraph: large unknown alien that can shove station parts.
- No fight card. No Tether-5.6.', 'Writing', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Docs/Maps.md has one paragraph: large unknown alien that can shove station parts.","done":false},{"id":"s2","label":"No fight card. No Tether-5.6.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.5.5', 'Tether-6.5', 'Tether-6.5.5 Portal loop playtest', 'Dummy object is enough.

Definition of Done:
- Portal loop is playtested. A dummy object is enough.', 'QA', 'Easy', 'Small', true, 50, '{}'::text[], '[{"id":"s1","label":"Portal loop is playtested. A dummy object is enough.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.6', 'Tether-6', 'Tether-6.6 Unofficial maps', 'Same kit. Off-theme layouts people like. Loadable outside the official 10 spaces.', 'Level Design', 'Medium', 'Medium', false, 60, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-6.6.1', 'Tether-6.6', 'Tether-6.6.1 Community map path', 'Content/Tether/Maps/Community/ plus a short Docs note: author, player count, what the line is asked to do, unofficial.

Output: Content/Tether/Maps/Community/ with a short author note per map.

Definition of Done:
- Unofficial maps live in Content/Tether/Maps/Community/.
- Each map has a short note: author, player count, what the line is asked to do, unofficial.', 'Writing', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Unofficial maps live in Content/Tether/Maps/Community/.","done":false},{"id":"s2","label":"Each map has a short note: author, player count, what the line is asked to do, unofficial.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.6.2', 'Tether-6.6', 'Tether-6.6.2 Unofficial Ready slots', 'Publish empty slots when staff want helpers in the editor. Stay on Staging this pass.

Definition of Done:
- Empty unofficial slots can be published when staff want helpers in the editor.
- This pass stays on Staging.', 'Level Design', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"Empty unofficial slots can be published when staff want helpers in the editor.","done":false},{"id":"s2","label":"This pass stays on Staging.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.6.3', 'Tether-6.6', 'Tether-6.6.3 Unofficial review', 'Promote only if on theme and it fits a spine.

Definition of Done:
- Unofficial maps are promoted only if on theme and they fit a spine.', 'Design', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"Unofficial maps are promoted only if on theme and they fit a spine.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.7', 'Tether-6', 'Tether-6.7 Map Open Question', 'Copy lives in Tether_Open_Question_Maps.docx. ID TQ-004 / Tether-CD.3. Question: What should Tether maps add? Official layout is locked. Community suggests obstacles, extra terrain, and unofficial maps.', 'Community', 'Medium', 'Medium', true, 70, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-6.7.1', 'Tether-6.7', 'Tether-6.7.1 Question copy on the card', 'Paste the public Question and Context from Tether_Open_Question_Maps.docx. Question: What should Tether maps add? Official layout is locked. Community suggests obstacles, extra terrain, and unofficial maps.

Definition of Done:
- The public Question and Context from Tether_Open_Question_Maps.docx are on this card.', 'Writing', 'Easy', 'Small', true, 10, '{}'::text[], '[{"id":"s1","label":"The public Question and Context from Tether_Open_Question_Maps.docx are on this card.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-6.7.2', 'Tether-6.7', 'Tether-6.7.2 CD marker', 'When the question is live, also add a Staff Only In Progress marker under Epic Tether-CD titled "Tether-CD.3 Map pieces TQ-004". That marker is not claimable. Do not parent the marker under a section map.

Definition of Done:
- Tether-CD.3 Map pieces TQ-004 exists under Epic Tether-CD.
- The marker is Staff Only, In Progress, and not claimable.
- It is not parented under a section map.', 'Community', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"Tether-CD.3 Map pieces TQ-004 exists under Epic Tether-CD.","done":false},{"id":"s2","label":"The marker is Staff Only, In Progress, and not claimable.","done":false},{"id":"s3","label":"It is not parented under a section map.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.4', 'Tether-11', 'Tether-11.4 Grapple hook', 'Section 2 unlock. Reach places walking cannot. Beam rules still apply while hooked. Numbers Open.

Do not parent under Tether-6. Founder-owned feel stays Open.', 'Code', 'Medium', 'Medium', true, 40, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-11.5', 'Tether-11', 'Tether-11.5 Boost pack', 'Section 3 assist. Short weak shove while not touching a surface. Cannot clear a space map alone. Founder owns the feel.

Do not parent under Tether-6.', 'Code', 'Medium', 'Medium', true, 50, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-CD.3', 'Tether-CD', 'Tether-CD.3 Map pieces TQ-004', 'Open Question marker. Not claimable work. TQ-004. What should Tether maps add? Official layout is locked. Community suggests obstacles, extra terrain, and unofficial maps.

Staff Only In Progress marker. Do not parent under a section map.', 'Community', 'Medium', 'Medium', true, 30, '{}'::text[], '[]'::jsonb, 'InProgress');

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
        status = case
          when v_row.code = 'Tether-CD.3' then v_row.status
          else status
        end,
        archived_at = null
      where id = v_id
        and board_scope = 'staging';
      v_updated := v_updated + 1;
    end if;
  end loop;

  -- Replace blockers for this tree only (staging).
  delete from public.task_dependencies d
  using public.tasks a, tmp_tether_v014 r
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
    select * from tmp_tether_v014 where cardinality(blocked_by_codes) > 0
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

  -- Tether-6 must not wait on Tether-5.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and b.project_id = v_project
    and a.board_scope = 'staging'
    and b.board_scope = 'staging'
    and a.title ~ '^Tether-6([. ]|$)'
    and b.title ~ '^Tether-5([. ]|$)';

  raise notice 'Tether v0.14 staging upsert created=% updated=%',
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
