-- Tether-8 UI and Tether-11 animation from Tether_Task_Breakdown_v0.21
-- plus v0.22 → staging board only.
-- Upsert by title / ID prefix. Does not publish. Does not write public rows.
-- Does not rewrite Tether-4, Tether-5, Tether-6, or Tether-7.
-- Tether-10 is done. Does not Block Tether-8 on Tether-10.
-- Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v021.sql

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

  select t.id into v_epic7
  from public.tasks t
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-7 %'
    and t.title not like 'Tether-7.%'
  order by t.archived_at nulls first, t.created_at
  limit 1;

  -- Leftover weapon/tool children under Epic 11 go to Tether-7.
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
      and c.title ~* 'Hand Spark|Nano-Knife|Enforcer|Canon|Snare|Grapple|Boost pack|Crew shields|weapon|tools';
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
      and t.title ~ '^Tether-8\.[0-9]'
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

  create temporary table if not exists tmp_tether_v021 (
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

  delete from tmp_tether_v021;

  insert into tmp_tether_v021 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_codes, subtasks, status
  ) values
    ('Tether-8', null, 'Tether-8 UI', 'Every player-facing screen and HUD read. Tension is the beam mesh, not a HUD meter.

The tether feeds O2 and shields. Player health and shield are two bars with no numbers. If your tether snaps, your shield empties immediately. People still on a live tether keep theirs. Shield damage also hits the tether. A fall that bites the shield bites beam health too. Amount is playtest. Write both rules into Docs/TetherRules.txt when 8.1.2 ships.

Source: Tether_Task_Breakdown_v0.21 plus v0.22. Staging only. Do not publish. Tether-10 is done. Do not Block this epic on Tether-10.', 'Code', 'Medium', 'Medium', true, 80, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-8.1', 'Tether-8', 'Tether-8.1 HUD', 'Graybox HUD widgets. Tension stays on the beam mesh.', 'Code', 'Medium', 'Medium', false, 10, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-8.1.1', 'Tether-8.1', 'Tether-8.1.1 Player health bar', 'A bar. No numbers on the bar.

Definition of Done:
- A player health bar exists. It has no numbers.', 'Code', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"A player health bar exists. It has no numbers.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.1.2', 'Tether-8.1', 'Tether-8.1.2 Shield bar', 'Separate bar. Empties immediately when that pawn''s tether snaps. Refills only while tethered. Shield damage also damages the beam. No numbers on the bar. Write the snap and shared-damage rules into Docs/TetherRules.txt.

Definition of Done:
- A separate shield bar exists with no numbers.
- If that pawn''s tether snaps, the shield empties immediately.
- Shield damage also damages the beam.
- Snap-dump and shared-damage rules are written in Docs/TetherRules.txt.

The tether feeds O2 and shields. Player health and shield are two bars with no numbers. If your tether snaps, your shield empties immediately. People still on a live tether keep theirs. Shield damage also hits the tether. A fall that bites the shield bites beam health too. Amount is playtest. Write both rules into Docs/TetherRules.txt when 8.1.2 ships.', 'Code', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"A separate shield bar exists with no numbers.","done":false},{"id":"s2","label":"If that pawn''s tether snaps, the shield empties immediately.","done":false},{"id":"s3","label":"Shield damage also damages the beam.","done":false},{"id":"s4","label":"Snap-dump and shared-damage rules are written in Docs/TetherRules.txt.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.1.3', 'Tether-8.1', 'Tether-8.1.3 Damage pop', 'When a creature or a pawn takes a hit, the amount pops and fades.

Definition of Done:
- Hit amount pops and fades on creature and pawn hits.', 'Code', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"Hit amount pops and fades on creature and pawn hits.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.1.4', 'Tether-8.1', 'Tether-8.1.4 Extract tick', 'While the Extractor is on a vein, a climbing line shows the metal and the count. +1 Gold, then +12 Gold, +13 Gold. When the player stops, the last number hangs a beat and fades.

Definition of Done:
- Extractor harvest shows a climbing metal count.
- When harvest stops, the last number hangs a beat and fades.', 'Code', 'Easy', 'Small', false, 40, '{}'::text[], '[{"id":"s1","label":"Extractor harvest shows a climbing metal count.","done":false},{"id":"s2","label":"When harvest stops, the last number hangs a beat and fades.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.1.5', 'Tether-8.1', 'Tether-8.1.5 Quota on HUD', 'Power cells and scrap needed vs held.

Definition of Done:
- HUD shows power-cell and scrap quota needed vs held.', 'Code', 'Easy', 'Small', false, 50, '{}'::text[], '[{"id":"s1","label":"HUD shows power-cell and scrap quota needed vs held.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.1.6', 'Tether-8.1', 'Tether-8.1.6 Round briefing', 'At map start a colony NPC speaks over comms and names the quota. First pass can be a comms text box plus a placeholder voice line.

Definition of Done:
- Map start plays a colony comms briefing that names the quota.
- First pass may be a text box plus a placeholder voice line.', 'Code', 'Easy', 'Small', false, 60, '{}'::text[], '[{"id":"s1","label":"Map start plays a colony comms briefing that names the quota.","done":false},{"id":"s2","label":"First pass may be a text box plus a placeholder voice line.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.1.7', 'Tether-8.1', 'Tether-8.1.7 Power clock', 'Stopwatch ring. Colored circle with an arrow that travels around the ring and eats the color. Turns red as time runs out. Empty is a loss.

Definition of Done:
- A power-clock ring exists with a traveling arrow that eats the color.
- The ring turns red as time runs out. Empty is a loss.', 'Code', 'Easy', 'Small', false, 70, '{}'::text[], '[{"id":"s1","label":"A power-clock ring exists with a traveling arrow that eats the color.","done":false},{"id":"s2","label":"The ring turns red as time runs out. Empty is a loss.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.1.8', 'Tether-8.1', 'Tether-8.1.8 Combat reads', 'Spark stun, nanites inside a target, shared Enforcer beams, Snare cables, Canon helpers, Extractor stream. Tension stays on the beam mesh.

Definition of Done:
- Combat reads exist for Spark stun, nanites, Enforcer beams, Snare cables, Canon helpers, and Extractor stream.
- Tension is not a HUD meter. It stays on the beam mesh.', 'Code', 'Easy', 'Small', false, 80, '{}'::text[], '[{"id":"s1","label":"Combat reads exist for Spark stun, nanites, Enforcer beams, Snare cables, Canon helpers, and Extractor stream.","done":false},{"id":"s2","label":"Tension is not a HUD meter. It stays on the beam mesh.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.2', 'Tether-8', 'Tether-8.2 Main menu', 'Graybox main menu.', 'Code', 'Medium', 'Medium', false, 20, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-8.2.1', 'Tether-8.2', 'Tether-8.2.1 Main menu shell', 'Play, Settings, Quit.

Definition of Done:
- Main menu has Play, Settings, and Quit.', 'Code', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Main menu has Play, Settings, and Quit.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.2.2', 'Tether-8.2', 'Tether-8.2.2 Join the Forge', 'Opens https://togetherforge.net in the system browser.

Definition of Done:
- Join the Forge opens https://togetherforge.net in the system browser.', 'Code', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"Join the Forge opens https://togetherforge.net in the system browser.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.2.3', 'Tether-8.2', 'Tether-8.2.3 Settings', 'Sound, visuals, controls. First pass can be stubs with working sliders where they already exist.

Definition of Done:
- Settings covers sound, visuals, and controls.
- First pass may stub entries and use existing sliders.', 'Code', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"Settings covers sound, visuals, and controls.","done":false},{"id":"s2","label":"First pass may stub entries and use existing sliders.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.3', 'Tether-8', 'Tether-8.3 Play, host, join', 'NOT blocked on Tether-10. Screens can use a stub session list until live listing is wired.

Tether-10 is done. Do not Block this medium on Tether-10.', 'Code', 'Medium', 'Medium', true, 30, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-8.3.1', 'Tether-8.3', 'Tether-8.3.1 Play menu', 'Host Game, Join Game.

Definition of Done:
- Play menu has Host Game and Join Game.', 'Code', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Play menu has Host Game and Join Game.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.3.2', 'Tether-8.3', 'Tether-8.3.2 Host Game', 'Campaign or unofficial map. Starts a session for the host and friends.

Definition of Done:
- Host can start a campaign or unofficial-map session.
- Friends can join that session.

Not blocked on Tether-10.', 'Code', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"Host can start a campaign or unofficial-map session.","done":false},{"id":"s2","label":"Friends can join that session.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.3.3', 'Tether-8.3', 'Tether-8.3.3 Join Game', 'List of active sessions. Filters: friends only, not-full, campaign vs unofficial.

Definition of Done:
- Join Game lists active sessions.
- Filters exist for friends only, not-full, and campaign vs unofficial.

Not blocked on Tether-10. A stub session list is enough until live listing is wired.', 'Code', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"Join Game lists active sessions.","done":false},{"id":"s2","label":"Filters exist for friends only, not-full, and campaign vs unofficial.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.3.4', 'Tether-8.3', 'Tether-8.3.4 Session row', 'Name and player count on each row.

Definition of Done:
- Each session row shows a name and player count.

Not blocked on Tether-10.', 'Code', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Each session row shows a name and player count.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.4', 'Tether-8', 'Tether-8.4 Pause', 'Graybox pause menu.', 'Code', 'Medium', 'Medium', false, 40, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-8.4.1', 'Tether-8.4', 'Tether-8.4.1 Pause menu', 'Resume, Settings, Return to Main Menu, Quit.

Definition of Done:
- Pause menu has Resume, Settings, Return to Main Menu, and Quit.', 'Code', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Pause menu has Resume, Settings, Return to Main Menu, and Quit.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.4.2', 'Tether-8.4', 'Tether-8.4.2 Pause Settings', 'Opens the same Settings as 8.2.3.

Definition of Done:
- Pause Settings opens the same Settings as Tether-8.2.3.', 'Code', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"Pause Settings opens the same Settings as Tether-8.2.3.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.5', 'Tether-8', 'Tether-8.5 Warp and Gear Up', 'Reaching a warp gate opens stats first, then Gear Up.', 'Code', 'Medium', 'Medium', true, 50, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-8.5.1', 'Tether-8.5', 'Tether-8.5.1 Round stats', 'Enemies dealt with, raw collected by type, distance traveled. First pass is those three.

Definition of Done:
- Round stats show enemies dealt with, raw collected by type, and distance traveled.', 'Code', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Round stats show enemies dealt with, raw collected by type, and distance traveled.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.5.2', 'Tether-8.5', 'Tether-8.5.2 Continue into Gear Up', 'From round stats, continue into Gear Up.

Definition of Done:
- A continue control opens Gear Up after round stats.', 'Code', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"A continue control opens Gear Up after round stats.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.5.3', 'Tether-8.5', 'Tether-8.5.3 Gear Up tabs', 'Upgrades, Weapons, Tools, Conversion.

Definition of Done:
- Gear Up has Upgrades, Weapons, Tools, and Conversion tabs.', 'Code', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"Gear Up has Upgrades, Weapons, Tools, and Conversion tabs.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.5.4', 'Tether-8.5', 'Tether-8.5.4 Upgrades tab', 'Player and group stats from Tether-7.1. Spend raw.

Definition of Done:
- Upgrades tab spends raw on Tether-7.1 player and group stats.', 'Code', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Upgrades tab spends raw on Tether-7.1 player and group stats.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.5.5', 'Tether-8.5', 'Tether-8.5.5 Weapons tab', 'Buy weapons the colony crafts. Upgrade weapons you already own. Spend raw.

Definition of Done:
- Weapons tab buys and upgrades colony weapons by spending raw.', 'Code', 'Easy', 'Small', true, 50, '{}'::text[], '[{"id":"s1","label":"Weapons tab buys and upgrades colony weapons by spending raw.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.5.6', 'Tether-8.5', 'Tether-8.5.6 Tools tab', 'Buy tools the colony crafts. Upgrade tools you already own. Spend raw.

Definition of Done:
- Tools tab buys and upgrades colony tools by spending raw.', 'Code', 'Easy', 'Small', true, 60, '{}'::text[], '[{"id":"s1","label":"Tools tab buys and upgrades colony tools by spending raw.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.5.7', 'Tether-8.5', 'Tether-8.5.7 Conversion tab', 'Trade one raw type for another by value. Rates Open. Logic is Tether-4.3.9.

Definition of Done:
- Conversion tab trades one raw type for another by value.
- Rates stay Open. Logic stays on Tether-4.3.9.', 'Code', 'Easy', 'Small', true, 70, '{}'::text[], '[{"id":"s1","label":"Conversion tab trades one raw type for another by value.","done":false},{"id":"s2","label":"Rates stay Open. Logic stays on Tether-4.3.9.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.5.8', 'Tether-8.5', 'Tether-8.5.8 Leave Gear Up and finish warp', 'Bank what you kept. Apply quota.

Definition of Done:
- Leaving Gear Up banks kept raw and applies quota.', 'Code', 'Easy', 'Small', true, 80, '{}'::text[], '[{"id":"s1","label":"Leaving Gear Up banks kept raw and applies quota.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.6', 'Tether-8', 'Tether-8.6 Fail and success', 'Graybox fail and success screens.', 'Code', 'Medium', 'Medium', false, 60, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-8.6.1', 'Tether-8.6', 'Tether-8.6.1 Fail screen', 'Clock ring empty, or the crew cannot continue. Return to Main Menu or retry.

Definition of Done:
- Fail screen offers Return to Main Menu or retry.', 'Code', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Fail screen offers Return to Main Menu or retry.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-8.6.2', 'Tether-8.6', 'Tether-8.6.2 Success screen', 'Quota met and the crew warps. Later add the finale generator send.

Definition of Done:
- Success screen plays when quota is met and the crew warps.', 'Code', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"Success screen plays when quota is met and the crew warps.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11', null, 'Tether-11 Model rigging and animation', 'Own epic because each rig and clip is real work. Gameplay still lives on Tether-3, 5, and 7. This epic is the rig and the motion.

Basic and quick. Readable loop. Faces the right way. Does not slide forever. No second idle. No hero cinematic. Perfect is out of scope.

Source: Tether_Task_Breakdown_v0.21 plus v0.22. Staging only. Do not publish. Not UI. No weapon children.', 'Art', 'Medium', 'Medium', true, 110, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-11.0', 'Tether-11', 'Tether-11.0 Shared rig', 'Shared player skeleton and export path.

Basic and quick. Readable loop. Faces the right way. Does not slide forever. No second idle. No hero cinematic. Perfect is out of scope.', 'Art', 'Medium', 'Medium', false, 10, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-11.0.1', 'Tether-11.0', 'Tether-11.0.1 Docs/Animation.md', 'Basic and quick. Readable loop. Faces the right way. Does not slide forever. No second idle. No hero cinematic. Perfect is out of scope. Clip list. Basic and quick written at the top.

Output: Docs/Animation.md in the Tether repo.

Definition of Done:
- Docs/Animation.md exists.
- Basic and quick is written at the top.
- A clip list is on the page.', 'Writing', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Docs/Animation.md exists.","done":false},{"id":"s2","label":"Basic and quick is written at the top.","done":false},{"id":"s3","label":"A clip list is on the page.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.0.2', 'Tether-11.0', 'Tether-11.0.2 Player skeleton and first suit rig', 'First player skeleton and suit rig. Basic and quick.

Definition of Done:
- A player skeleton and first suit rig exist.', 'Art', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"A player skeleton and first suit rig exist.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.0.3', 'Tether-11.0', 'Tether-11.0.3 Export and retarget path', 'Later suits reuse this skeleton.

Definition of Done:
- An export and retarget path exists so later suits reuse this skeleton.', 'Art', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"An export and retarget path exists so later suits reuse this skeleton.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1', 'Tether-11', 'Tether-11.1 Player clips', 'One loop or one-shot each. Basic and quick.

Basic and quick. Readable loop. Faces the right way. Does not slide forever. No second idle. No hero cinematic. Perfect is out of scope.', 'Art', 'Medium', 'Medium', false, 20, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-11.1.1', 'Tether-11.1', 'Tether-11.1.1 Idle', 'Idle clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick idle clip exists.', 'Art', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"A basic, quick idle clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.2', 'Tether-11.1', 'Tether-11.1.2 Walk', 'Walk clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick walk clip exists.', 'Art', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"A basic, quick walk clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.3', 'Tether-11.1', 'Tether-11.1.3 Run', 'Run clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick run clip exists.', 'Art', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"A basic, quick run clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.4', 'Tether-11.1', 'Tether-11.1.4 Jump', 'Jump clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick jump clip exists.', 'Art', 'Easy', 'Small', false, 40, '{}'::text[], '[{"id":"s1","label":"A basic, quick jump clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.5', 'Tether-11.1', 'Tether-11.1.5 Fall airborne', 'Fall airborne clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick fall airborne clip exists.', 'Art', 'Easy', 'Small', false, 50, '{}'::text[], '[{"id":"s1","label":"A basic, quick fall airborne clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.6', 'Tether-11.1', 'Tether-11.1.6 Land', 'Land clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick land clip exists.', 'Art', 'Easy', 'Small', false, 60, '{}'::text[], '[{"id":"s1","label":"A basic, quick land clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.7', 'Tether-11.1', 'Tether-11.1.7 Climb ledge get-up', 'Climb ledge get-up clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick climb ledge get-up clip exists.', 'Art', 'Easy', 'Small', false, 70, '{}'::text[], '[{"id":"s1","label":"A basic, quick climb ledge get-up clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.8', 'Tether-11.1', 'Tether-11.1.8 Lunge', 'Lunge clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick lunge clip exists.', 'Art', 'Easy', 'Small', false, 80, '{}'::text[], '[{"id":"s1","label":"A basic, quick lunge clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.9', 'Tether-11.1', 'Tether-11.1.9 Extractor hold', 'Extractor hold clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick extractor hold clip exists.', 'Art', 'Easy', 'Small', false, 90, '{}'::text[], '[{"id":"s1","label":"A basic, quick extractor hold clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.10', 'Tether-11.1', 'Tether-11.1.10 Spark fire', 'Spark fire clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick spark fire clip exists.', 'Art', 'Easy', 'Small', false, 100, '{}'::text[], '[{"id":"s1","label":"A basic, quick spark fire clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.11', 'Tether-11.1', 'Tether-11.1.11 Nano-Knife swing', 'Nano-Knife swing clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick nano-knife swing clip exists.', 'Art', 'Easy', 'Small', false, 110, '{}'::text[], '[{"id":"s1","label":"A basic, quick nano-knife swing clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.12', 'Tether-11.1', 'Tether-11.1.12 Enforcer hold', 'Enforcer hold clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick enforcer hold clip exists.', 'Art', 'Easy', 'Small', false, 120, '{}'::text[], '[{"id":"s1","label":"A basic, quick enforcer hold clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.13', 'Tether-11.1', 'Tether-11.1.13 Grapple fire and hang', 'Grapple fire and hang clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick grapple fire and hang clip exists.', 'Art', 'Easy', 'Small', false, 130, '{}'::text[], '[{"id":"s1","label":"A basic, quick grapple fire and hang clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.14', 'Tether-11.1', 'Tether-11.1.14 Rescue pull hold', 'Rescue pull hold clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick rescue pull hold clip exists.', 'Art', 'Easy', 'Small', false, 140, '{}'::text[], '[{"id":"s1","label":"A basic, quick rescue pull hold clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.1.15', 'Tether-11.1', 'Tether-11.1.15 Carry oversized scrap', 'Carry oversized scrap clip. One loop or one-shot. Basic and quick.

Definition of Done:
- A basic, quick carry oversized scrap clip exists.', 'Art', 'Easy', 'Small', false, 150, '{}'::text[], '[{"id":"s1","label":"A basic, quick carry oversized scrap clip exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.2', 'Tether-11', 'Tether-11.2 Enemy clips', 'Basic and quick. One rig per starter creature. Do not invent a sixth enemy.

Basic and quick. Readable loop. Faces the right way. Does not slide forever. No second idle. No hero cinematic. Perfect is out of scope.', 'Art', 'Medium', 'Medium', false, 30, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-11.2.1', 'Tether-11.2', 'Tether-11.2.1 Snatch clips', 'Fly, watch, dive, carry, eat, stagger, death.

Definition of Done:
- Snatch has basic fly, watch, dive, carry, eat, stagger, and death clips.', 'Art', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Snatch has basic fly, watch, dive, carry, eat, stagger, and death clips.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.2.2', 'Tether-11.2', 'Tether-11.2.2 Latch clips', 'Run, lunge, ride, eat, death.

Definition of Done:
- Latch has basic run, lunge, ride, eat, and death clips.', 'Art', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"Latch has basic run, lunge, ride, eat, and death clips.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.2.3', 'Tether-11.2', 'Tether-11.2.3 Tick clips', 'Crawl, hide, chew, latch-on, death.

Definition of Done:
- Tick has basic crawl, hide, chew, latch-on, and death clips.', 'Art', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"Tick has basic crawl, hide, chew, latch-on, and death clips.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.2.4', 'Tether-11.2', 'Tether-11.2.4 Guard clips', 'Walk food, charge, spit, wall walk, tell jump, eat, death.

Definition of Done:
- Guard has basic walk-food, charge, spit, wall walk, tell jump, eat, and death clips.', 'Art', 'Easy', 'Small', false, 40, '{}'::text[], '[{"id":"s1","label":"Guard has basic walk-food, charge, spit, wall walk, tell jump, eat, and death clips.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.2.5', 'Tether-11.2', 'Tether-11.2.5 Spore clips', 'Idle hidden, snare, whip, wrap, death.

Definition of Done:
- Spore has basic idle-hidden, snare, whip, wrap, and death clips.', 'Art', 'Easy', 'Small', false, 50, '{}'::text[], '[{"id":"s1","label":"Spore has basic idle-hidden, snare, whip, wrap, and death clips.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.2.6', 'Tether-11.2', 'Tether-11.2.6 Finale creature', 'Later. One card only. No clip list until there is a founder brief.

Definition of Done:
- Finale creature stays one Later card with no clip list until a founder brief.', 'Art', 'Easy', 'Small', true, 60, '{}'::text[], '[{"id":"s1","label":"Finale creature stays one Later card with no clip list until a founder brief.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.3', 'Tether-11', 'Tether-11.3 Weapon and tool poses', 'Held poses for starter weapons and tools. Basic and quick.', 'Art', 'Medium', 'Medium', false, 40, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-11.3.1', 'Tether-11.3', 'Tether-11.3.1 Held weapon poses', 'Spark, knife, Enforcer, Canon, Snare.

Definition of Done:
- Held poses exist for Spark, knife, Enforcer, Canon, and Snare.', 'Art', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Held poses exist for Spark, knife, Enforcer, Canon, and Snare.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.3.2', 'Tether-11.3', 'Tether-11.3.2 Extractor stream pose', 'Pose while the Extractor stream is on.

Definition of Done:
- An Extractor stream pose exists.', 'Art', 'Easy', 'Small', false, 20, '{}'::text[], '[{"id":"s1","label":"An Extractor stream pose exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11.3.3', 'Tether-11.3', 'Tether-11.3.3 Grapple hook pose', 'Pose while firing or hanging on the grapple.

Definition of Done:
- A grapple hook pose exists.', 'Art', 'Easy', 'Small', false, 30, '{}'::text[], '[{"id":"s1","label":"A grapple hook pose exists.","done":false}]'::jsonb, 'ToDo');

  for v_row in
    select *
    from tmp_tether_v021
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
  using public.tasks a, tmp_tether_v021 r
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
    select * from tmp_tether_v021 where cardinality(blocked_by_codes) > 0
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

  raise notice 'Tether v0.21 staging upsert created=% updated=%',
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
