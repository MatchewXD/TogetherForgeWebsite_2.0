-- Tether Task Breakdown v0.6 → staff staging board only.
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
  where slug in ('tether', 'prototype-systems')
  order by case when slug = 'tether' then 0 else 1 end
  limit 1;

  if v_project is null then
    raise exception 'Tether project not found (slug=tether or prototype-systems).';
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
    ('Tether-1', null, 'Tether-1 Project foundation', 'One engine version, one repo, one folder map, Canon packet.', 'Code', 'Medium', 'Medium', true, 10, null, '[]'::jsonb),
    ('Tether-1.1', 'Tether-1', 'Tether-1.1 Engine lock and empty project', 'Lock Unreal 5.8.x and create the empty Tether project.', 'Code', 'Medium', 'Medium', true, 10, null, '[]'::jsonb),
    ('Tether-1.1.1', 'Tether-1.1', 'Tether-1.1.1 Record the engine decision', 'Record the engine decision.

Output: Docs/EngineDecision.md with 5.8.x lock, why, four requirements, staff sign-off.

Definition of Done:
- Docs/EngineDecision.md exists with 5.8.x lock, rationale, four requirements, and staff sign-off.
- README notes the exact launcher build. Do not start on UE6.', 'Writing', 'Easy', 'Small', true, 10, null, '[{"id":"s1","label":"Docs/EngineDecision.md exists with 5.8.x lock, rationale, four requirements, and staff sign-off.","done":false},{"id":"s2","label":"README notes the exact launcher build. Do not start on UE6.","done":false}]'::jsonb),
    ('Tether-1.1.2', 'Tether-1.1', 'Tether-1.1.2 Install and create the project', 'Install Unreal 5.8.x and create the Tether project.

Output: Tether UE 5.8.x project, Content/Tether folder tree, Maps/TetherPrototype as startup map, project opens with no errors.

Definition of Done:
- Project opens in UE 5.8.x with no errors.
- Content/Tether folder tree exists (Characters, Tether, Maps, Enemies, Interact, Modular, UI, Audio).
- Maps/TetherPrototype is the startup map.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"Project opens in UE 5.8.x with no errors.","done":false},{"id":"s2","label":"Content/Tether folder tree exists (Characters, Tether, Maps, Enemies, Interact, Modular, UI, Audio).","done":false},{"id":"s3","label":"Maps/TetherPrototype is the startup map.","done":false}]'::jsonb),
    ('Tether-1.2', 'Tether-1', 'Tether-1.2 GitHub and collaboration base', 'Private GitHub repo and collaboration rules.', 'Code', 'Medium', 'Medium', true, 20, null, '[]'::jsonb),
    ('Tether-1.2.1', 'Tether-1.2', 'Tether-1.2.1 Repository', 'Create the private GitHub repository.

Output: Private repo, Unreal gitignore, LFS, first commit, develop + protected main, Docs/Repo.md with URL.

Definition of Done:
- Private GitHub repo exists with official Unreal gitignore and Git LFS for Unreal assets.
- First commit is on develop; main is protected; PRs are required.
- Docs/Repo.md records the URL.
- PR titles use the Task ID (example Tether-1.2.1).', 'Code', 'Easy', 'Small', true, 10, null, '[{"id":"s1","label":"Private GitHub repo exists with official Unreal gitignore and Git LFS for Unreal assets.","done":false},{"id":"s2","label":"First commit is on develop; main is protected; PRs are required.","done":false},{"id":"s3","label":"Docs/Repo.md records the URL.","done":false},{"id":"s4","label":"PR titles use the Task ID (example Tether-1.2.1).","done":false}]'::jsonb),
    ('Tether-1.2.2', 'Tether-1.2', 'Tether-1.2.2 README and CONTRIBUTING', 'Document how to open the project and how to contribute.

Output: README (version, how to open, how to run TetherPrototype), CONTRIBUTING (claim on site, Task ID, no invented scope), PR template, access rule.

Definition of Done:
- README covers version, how to open, and how to run TetherPrototype.
- CONTRIBUTING covers claim on site, Task ID in PRs, and no invented scope.
- PR template exists.
- Access rule: granted after a claimed repo task is approved, once public claiming exists.', 'Writing', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"README covers version, how to open, and how to run TetherPrototype.","done":false},{"id":"s2","label":"CONTRIBUTING covers claim on site, Task ID in PRs, and no invented scope.","done":false},{"id":"s3","label":"PR template exists.","done":false},{"id":"s4","label":"Access rule: granted after a claimed repo task is approved, once public claiming exists.","done":false}]'::jsonb),
    ('Tether-1.3', 'Tether-1', 'Tether-1.3 Canon packet', 'Canon packet: vision, what this is not, style lock, Tether rules.', 'Writing', 'Medium', 'Medium', true, 30, null, '[]'::jsonb),
    ('Tether-1.3.1', 'Tether-1.3', 'Tether-1.3.1 Vision and What this is not', 'Write Vision and What this is not.

Output: Docs/Vision.md and Docs/WhatThisIsNot.md.

Definition of Done:
- Docs/Vision.md exists.
- Docs/WhatThisIsNot.md exists.', 'Writing', 'Easy', 'Small', true, 10, null, '[{"id":"s1","label":"Docs/Vision.md exists.","done":false},{"id":"s2","label":"Docs/WhatThisIsNot.md exists.","done":false}]'::jsonb),
    ('Tether-1.3.2', 'Tether-1.3', 'Tether-1.3.2 Style lock and Tether rules', 'Draft style lock and starting Tether rules.

Output: Docs/StyleLock.md (Draft until approved) and Docs/TetherRules.txt (starting bands, Open items labeled). Link all four Canon files from README.

Definition of Done:
- Docs/StyleLock.md exists and is labeled Draft until approved.
- Docs/TetherRules.txt exists with starting bands and Open items labeled.
- README links Vision, WhatThisIsNot, StyleLock, and TetherRules.', 'Writing', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"Docs/StyleLock.md exists and is labeled Draft until approved.","done":false},{"id":"s2","label":"Docs/TetherRules.txt exists with starting bands and Open items labeled.","done":false},{"id":"s3","label":"README links Vision, WhatThisIsNot, StyleLock, and TetherRules.","done":false}]'::jsonb),
    ('Tether-P', null, 'Tether-P First Spark', 'Public First Spark lane: docs and QA. Art suggestions go in Open Questions. Tether-9 is the art section. Networking stays Tether-10.', 'QA', 'Easy', 'First Spark', false, 15, null, '[]'::jsonb),
    ('Tether-P.3', 'Tether-P', 'Tether-P.3 QA templates', 'Templates for the first beam playtests. Staff Only.', 'QA', 'Easy', 'First Spark', true, 20, null, '[]'::jsonb),
    ('Tether-P.3.2', 'Tether-P.3', 'Tether-P.3.2 Playtest note template', 'Write Docs/qa/PlaytestNote.md with fields: date, build, testers, what felt good, what broke, recommended task change (not a new feature).

Output: Docs/qa/PlaytestNote.md.

Definition of Done:
- Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).', 'QA', 'Easy', 'First Spark', true, 20, null, '[{"id":"s1","label":"Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).","done":false}]'::jsonb),
    ('Tether-2', null, 'Tether-2 Core tether physics', 'Shared tether feels good and is readable. First feel test uses two pawns. Do not unlock later gameplay until that test is playtested and TetherRules.txt is updated. Solo behavior and 3-4 tether topology stay Open.', 'Code', 'Medium', 'Medium', true, 20, null, '[]'::jsonb),
    ('Tether-2.1', 'Tether-2', 'Tether-2.1 Basic tether between two pawns', 'First feel test: a basic tether between two pawns.', 'Code', 'Medium', 'Medium', true, 10, null, '[]'::jsonb),
    ('Tether-2.1.0', 'Tether-2.1', 'Tether-2.1.0 Prototype graybox', 'The live Unreal map TetherPrototype is a black void. Build a walkable graybox before stand-ins or the tether line. Follow Docs/TetherPrototype.md. No art, enemies, resources, or Level 1 work.

Output: A walkable Content/Tether/Maps/TetherPrototype instead of a void: lit floor, collision, 200 cm tiles, at least 20 x 20 m, one ledge 250 to 400 cm high, two Player Starts about 300 cm apart.

Definition of Done:
- Map is lit.
- Floor holds a pawn.
- Ledge exists (250 to 400 cm).
- Two Player Starts exist about 300 cm apart.
- Editor opens Content/Tether/Maps/TetherPrototype.', 'Level Design', 'Easy', 'Small', true, 0, null, '[{"id":"s1","label":"Map is lit.","done":false},{"id":"s2","label":"Floor holds a pawn.","done":false},{"id":"s3","label":"Ledge exists (250 to 400 cm).","done":false},{"id":"s4","label":"Two Player Starts exist about 300 cm apart.","done":false},{"id":"s5","label":"Editor opens Content/Tether/Maps/TetherPrototype.","done":false}]'::jsonb),
    ('Tether-2.1.1', 'Tether-2.1', 'Tether-2.1.1 Player stand-ins', 'Player stand-ins.

Output: Content/Tether/Characters/BP_PlayerStandIn, two stand-ins in TetherPrototype for the first feel test.

Definition of Done:
- BP_PlayerStandIn exists under Content/Tether/Characters/.
- Two stand-ins are in TetherPrototype for the first feel test.', 'Code', 'Easy', 'Small', true, 10, null, '[{"id":"s1","label":"BP_PlayerStandIn exists under Content/Tether/Characters/.","done":false},{"id":"s2","label":"Two stand-ins are in TetherPrototype for the first feel test.","done":false}]'::jsonb),
    ('Tether-2.1.2', 'Tether-2.1', 'Tether-2.1.2 Distance constraint and visual', 'Distance constraint and visual.

Output: Content/Tether/Tether/, max distance 8–12 units written into TetherRules.txt, line changes at stretch.

Definition of Done:
- Tether lives under Content/Tether/Tether/.
- Max distance 8–12 units is written into TetherRules.txt.
- The line changes at stretch.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"Tether lives under Content/Tether/Tether/.","done":false},{"id":"s2","label":"Max distance 8–12 units is written into TetherRules.txt.","done":false},{"id":"s3","label":"The line changes at stretch.","done":false}]'::jsonb),
    ('Tether-2.1.3', 'Tether-2.1', 'Tether-2.1.3 Local dual control', 'Document local controls for the two-pawn feel test.

Output: Docs/Controls.md.

Definition of Done:
- Docs/Controls.md exists and documents local controls for the two-pawn feel test.', 'Writing', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"Docs/Controls.md exists and documents local controls for the two-pawn feel test.","done":false}]'::jsonb),
    ('Tether-2.2', 'Tether-2', 'Tether-2.2 Tension states', 'Tension states tethered players can read.

Blocker: Do not start until a TetherPrototype graybox exists.', 'Code', 'Medium', 'Medium', true, 20, 'Tether-2.1.0', '[]'::jsonb),
    ('Tether-2.2.1', 'Tether-2.2', 'Tether-2.2.1 Tension calculation', 'Tension calculation.

Output: Low 0–50, Medium 50–85, High 85–100. Write thresholds in TetherRules.txt.

Definition of Done:
- Low 0–50, Medium 50–85, High 85–100 are implemented.
- Thresholds are written in TetherRules.txt.', 'Code', 'Easy', 'Small', true, 10, null, '[{"id":"s1","label":"Low 0–50, Medium 50–85, High 85–100 are implemented.","done":false},{"id":"s2","label":"Thresholds are written in TetherRules.txt.","done":false}]'::jsonb),
    ('Tether-2.2.2', 'Tether-2.2', 'Tether-2.2.2 Movement response to High tension', 'Movement response to High tension.

Output: Document the speed multiplier.

Definition of Done:
- High-tension speed multiplier is implemented and documented.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"High-tension speed multiplier is implemented and documented.","done":false}]'::jsonb),
    ('Tether-2.2.3', 'Tether-2.2', 'Tether-2.2.3 Visual and placeholder High-tension audio', 'Visual and placeholder High-tension audio.

Output: Spectator can read the state.

Definition of Done:
- A spectator can read Low / Medium / High from the visual.
- Placeholder High-tension audio plays.', 'Art', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"A spectator can read Low / Medium / High from the visual.","done":false},{"id":"s2","label":"Placeholder High-tension audio plays.","done":false}]'::jsonb),
    ('Tether-2.3', 'Tether-2', 'Tether-2.3 Over-stretch and recovery', 'Over-stretch and recovery.

Blocker: Do not start until a TetherPrototype graybox exists.', 'Code', 'Medium', 'Medium', true, 30, 'Tether-2.1.0', '[]'::jsonb),
    ('Tether-2.3.1', 'Tether-2.3', 'Tether-2.3.1 Over-stretch behavior', 'Over-stretch behavior.

Output: Documented in TetherRules.txt and implemented.

Definition of Done:
- Over-stretch behavior is documented in TetherRules.txt.
- Over-stretch behavior is implemented.', 'Code', 'Easy', 'Small', true, 10, null, '[{"id":"s1","label":"Over-stretch behavior is documented in TetherRules.txt.","done":false},{"id":"s2","label":"Over-stretch behavior is implemented.","done":false}]'::jsonb),
    ('Tether-2.3.2', 'Tether-2.3', 'Tether-2.3.2 Recovery', 'Recovery after over-stretch.

Output: Done only after a two-pawn feel test using Docs/qa/PlaytestNote.md.

Definition of Done:
- Recovery is implemented.
- A two-pawn feel test was recorded with Docs/qa/PlaytestNote.md.
- TetherRules.txt is updated from that playtest.', 'QA', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"Recovery is implemented.","done":false},{"id":"s2","label":"A two-pawn feel test was recorded with Docs/qa/PlaytestNote.md.","done":false},{"id":"s3","label":"TetherRules.txt is updated from that playtest.","done":false}]'::jsonb),
    ('Tether-3', null, 'Tether-3 Tether-aware movement', 'Tether-aware movement. Epic 2 playtest is treated as passed. Community claims Tether-3.1. Staff retune pull on Tether-3.2.', 'Code', 'Medium', 'Medium', false, 30, null, '[]'::jsonb),
    ('Tether-3.1', 'Tether-3', 'Tether-3.1 Core locomotion and camera', 'Walk, run, jump, ground detect, keyboard and gamepad. Document speeds in Docs/ or TetherRules.txt. Camera is Open: third-person that keeps both pawns readable, or first-person plus a tether cue. Write the choice in Docs/Camera.md. Cite Docs/TetherRules.txt. Do not retune pull, L100, or Tether Health.

Output: Docs/Camera.md plus documented walk/run/jump speeds.

Definition of Done:
- Walk, run, jump, and ground detect work on keyboard and gamepad.
- Speeds are documented in Docs/ or TetherRules.txt.
- Camera choice is written in Docs/Camera.md.
- This card does not retune pull, L100, or Tether Health.', 'Code', 'Medium', 'Medium', false, 10, null, '[{"id":"s1","label":"Walk, run, jump, and ground detect work on keyboard and gamepad.","done":false},{"id":"s2","label":"Speeds are documented in Docs/ or TetherRules.txt.","done":false},{"id":"s3","label":"Camera choice is written in Docs/Camera.md.","done":false},{"id":"s4","label":"This card does not retune pull, L100, or Tether Health.","done":false}]'::jsonb),
    ('Tether-3.2', 'Tether-3', 'Tether-3.2 Pull/resist and failure-mode tests', 'Staff retune pull toward partner and optional resist. Community must not retune pull. Failure-mode playtest is Tether-3.2.1.', 'Code', 'Medium', 'Medium', true, 20, null, '[]'::jsonb),
    ('Tether-3.2.1', 'Tether-3.2', 'Tether-3.2.1 Failure-mode playtest', 'Playtest failure modes. Do not change TetherRules numbers on this card.

Output: Dated Docs/qa/PlaytestNote.

Definition of Done:
- A dated Docs/qa/PlaytestNote exists.
- Tested: one falls off a ledge.
- Tested: both jump.
- Tested: one sprints / one stands.
- TetherRules numbers were not changed on this card.

Blocker: Waiting on staff pull/resist work on Tether-3.2.', 'QA', 'Easy', 'Small', false, 10, 'Tether-3.2', '[{"id":"s1","label":"A dated Docs/qa/PlaytestNote exists.","done":false},{"id":"s2","label":"Tested: one falls off a ledge.","done":false},{"id":"s3","label":"Tested: both jump.","done":false},{"id":"s4","label":"Tested: one sprints / one stands.","done":false},{"id":"s5","label":"TetherRules numbers were not changed on this card.","done":false}]'::jsonb),
    ('Tether-4', null, 'Tether-4 Resources and warp', 'Resources and warp.

Blocker: Waiting on Tether-3.1 Core locomotion and camera.', 'Code', 'Medium', 'Medium', false, 40, 'Tether-3.1', '[]'::jsonb),
    ('Tether-4.1', 'Tether-4', 'Tether-4.1 ResourceNode and carry limit', 'ResourceNode prefab, interact volume, carry limit 1 or 2, deliberate drop. Place at least six nodes in the prototype or a test map.

Definition of Done:
- ResourceNode prefab exists with an interact volume.
- Carry limit is 1 or 2 with a deliberate drop.
- At least six nodes are placed in the prototype or a test map.

Blocker: Waiting on Tether-3.1 Core locomotion and camera.', 'Code', 'Medium', 'Medium', false, 10, 'Tether-3.1', '[{"id":"s1","label":"ResourceNode prefab exists with an interact volume.","done":false},{"id":"s2","label":"Carry limit is 1 or 2 with a deliberate drop.","done":false},{"id":"s3","label":"At least six nodes are placed in the prototype or a test map.","done":false}]'::jsonb),
    ('Tether-4.2', 'Tether-4', 'Tether-4.2 Checkpoint warp and session total', 'Checkpoint warp and session total.

Output: Done at collect → carry → warp → total updates.

Definition of Done:
- Collect → carry → warp → session total updates in one loop.

Blocker: Waiting on Tether-4.1 ResourceNode and carry limit.', 'Code', 'Medium', 'Medium', false, 20, 'Tether-4.1', '[{"id":"s1","label":"Collect → carry → warp → session total updates in one loop.","done":false}]'::jsonb),
    ('Tether-CD', null, 'Tether-CD Community Decisions', 'Holds live Open Questions. Each child is a status marker. Nobody claims these cards. People post one suggestion and vote on the Open Questions board. When staff close a vote, update the GDD and then write production Smalls.', 'Community', 'Medium', 'Medium', true, 45, null, '[]'::jsonb),
    ('Tether-CD.1', 'Tether-CD', 'Tether-CD.1 Suit and world palette', 'Open Question marker. Not claimable work.

Prompt to post on Open Questions:
The crew wears future-tech survival suits that have been used. Helmets, packs, manufactured gear, dirt and scuffs. Cool colony tech in the world. The beam carries the energy color. What color palette would look good with that? Stay readable at a distance. No real-world party marks. No slogan decals. One suggestion per reply. Vote the ones you want staff to take seriously.

When Adopted: write the palette into Docs/StyleLock.md. Then production art cards may leave Blocked.', 'Community', 'Medium', 'Medium', true, 10, null, '[]'::jsonb),
    ('Tether-CD.2', 'Tether-CD', 'Tether-CD.2 What kinds of enemies should we add', 'Open Question marker. Not claimable work.

Prompt to post on Open Questions:
We want enemies that hinder utility, not a shooter roster. Example jobs: grab a person or the beam, pick a friend up and carry them toward a drop, make a stretch of ground unsafe to linger on, tax the beam without becoming a health-bar boss. What kinds of enemies should we add? Name. What it does to a person or the beam. How the crew answers it together. One enemy per reply.', 'Community', 'Medium', 'Medium', true, 20, null, '[]'::jsonb),
    ('Tether-5', null, 'Tether-5 Enemies', 'Enemies that stress the tether. Threats whose job is coordination, not a DPS sponge. Latch is one example creature, not the name of this epic.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.', 'Code', 'Medium', 'Medium', false, 50, 'Tether-4.2', '[]'::jsonb),
    ('Tether-5.1', 'Tether-5', 'Tether-5.1 First utility enemy', 'First utility enemy. One example is a grab-the-person-or-beam creature (a Latch): it moves toward a pawn or the tether midpoint, attaches, applies a documented penalty (extra tension, slow, or drain), and shows a clear attached state. Removal is faster when both players use Energy Pulse inside a short window (pair-remove). Playtest with two people and confirm the pair advantage is obvious.

Definition of Done:
- A first utility enemy attaches to a pawn or the tether midpoint with a clear attached state. A grab-the-person-or-beam Latch is one valid example.
- A documented penalty applies while attached.
- Energy Pulse pair-remove is faster when both players use it in a short window.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.', 'Code', 'Medium', 'Medium', false, 10, 'Tether-4.2', '[{"id":"s1","label":"A first utility enemy attaches to a pawn or the tether midpoint with a clear attached state. A grab-the-person-or-beam Latch is one valid example.","done":false},{"id":"s2","label":"A documented penalty applies while attached.","done":false},{"id":"s3","label":"Energy Pulse pair-remove is faster when both players use it in a short window.","done":false}]'::jsonb),
    ('Tether-6', null, 'Tether-6 First playable surface level', 'Maps. First playable surface level. Not blocked by Enemies. Official campaign maps must match Vision, StyleLock, Camera.md, and TetherRules.txt.', 'Level Design', 'Medium', 'Medium', false, 60, null, '[]'::jsonb),
    ('Tether-6.1', 'Tether-6', 'Tether-6.1 Modular graybox kit plus Level_01_Surface', 'Parent for kit pieces and Level_01_Surface blockout. Claim the Smalls. Not blocked by Enemies.', 'Level Design', 'Medium', 'Medium', false, 10, null, '[]'::jsonb),
    ('Tether-6.1.1', 'Tether-6.1', 'Tether-6.1.1 Five modular graybox pieces', 'Five modular graybox pieces in Content/Tether/Modular.

Output: Content/Tether/Modular with at least five graybox pieces.

Definition of Done:
- At least five modular graybox pieces exist in Content/Tether/Modular.', 'Level Design', 'Easy', 'Small', false, 10, null, '[{"id":"s1","label":"At least five modular graybox pieces exist in Content/Tether/Modular.","done":false}]'::jsonb),
    ('Tether-6.1.2', 'Tether-6.1', 'Tether-6.1.2 Block out Level_01_Surface', 'Block out Content/Tether/Maps/Level_01_Surface: start, two traversal sections, resources, one or two enemy points, end checkpoint. Official campaign maps must match Vision, StyleLock, Camera.md, and TetherRules.txt.

Output: Content/Tether/Maps/Level_01_Surface.

Definition of Done:
- Level_01_Surface has a start, two traversal sections, resources, one or two enemy points, and an end checkpoint.

Blocker: Waiting on Tether-6.1.1 Five modular graybox pieces.', 'Level Design', 'Easy', 'Small', false, 20, 'Tether-6.1.1', '[{"id":"s1","label":"Level_01_Surface has a start, two traversal sections, resources, one or two enemy points, and an end checkpoint.","done":false}]'::jsonb),
    ('Tether-6.2', 'Tether-6', 'Tether-6.2 End-to-end 1-4 player loop', 'Recorded 1-4 player loop. Two-window listen server is enough until Tether-10.2 exists. Solo behavior and 3-4 tether topology stay Open.

Definition of Done:
- A recorded successful 1-4 player run exists.
- Two-window listen server is enough until Tether-10.2 exists.

Blocker: Waiting on Tether-6.1.2 Block out Level_01_Surface.', 'QA', 'Medium', 'Medium', false, 20, 'Tether-6.1.2', '[{"id":"s1","label":"A recorded successful 1-4 player run exists.","done":false},{"id":"s2","label":"Two-window listen server is enough until Tether-10.2 exists.","done":false}]'::jsonb),
    ('Tether-6.3', 'Tether-6', 'Tether-6.3 Unofficial community maps', 'Lane for unofficial maps. Output Content/Tether/Maps/Community/ plus a short note (author, intended player count, what the line is asked to do). Off-campaign but playable maps stay in that folder. Off-brand work (nuke the map, and similar) is declined, not filed as unofficial. Not blocked by Enemies.

Output: Content/Tether/Maps/Community/ with a short author note per map.

Definition of Done:
- Unofficial playable maps live in Content/Tether/Maps/Community/.
- Each map has a short note: author, intended player count, what the line is asked to do.
- Off-brand work is declined, not filed as unofficial.', 'Level Design', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"Unofficial playable maps live in Content/Tether/Maps/Community/.","done":false},{"id":"s2","label":"Each map has a short note: author, intended player count, what the line is asked to do.","done":false},{"id":"s3","label":"Off-brand work is declined, not filed as unofficial.","done":false}]'::jsonb),
    ('Tether-7', null, 'Tether-7 Tools, upgrades, between-level flow', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Code', 'Medium', 'Medium', false, 70, 'Tether-6', '[]'::jsonb),
    ('Tether-7.1', 'Tether-7', 'Tether-7.1 Upgrade screen', 'Parked chapter card: upgrade screen. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Design', 'Medium', 'Medium', false, 10, 'Tether-6', '[]'::jsonb),
    ('Tether-7.2', 'Tether-7', 'Tether-7.2 First upgrades', 'Parked chapter card: first upgrades — max distance, Anchor, Shared Reinforcer. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Code', 'Medium', 'Medium', false, 20, 'Tether-6', '[]'::jsonb),
    ('Tether-8', null, 'Tether-8 Final station sequence', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Level Design', 'Medium', 'Medium', false, 80, 'Tether-6', '[]'::jsonb),
    ('Tether-8.1', 'Tether-8', 'Tether-8.1 Station blockout', 'Parked chapter card: station blockout. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Level Design', 'Medium', 'Medium', false, 10, 'Tether-6', '[]'::jsonb),
    ('Tether-8.2', 'Tether-8', 'Tether-8.2 Creature drive-off', 'Parked chapter card: creature drive-off. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Code', 'Medium', 'Medium', false, 20, 'Tether-6', '[]'::jsonb),
    ('Tether-9', null, 'Tether-9 Art pipeline', 'Art pipeline. Production final assets wait on Tether-CD.1 (palette Adopted into StyleLock.md). Art exploration replies belong on that Open Question, not as a separate public art epic.', 'Art', 'Medium', 'Medium', true, 90, null, '[]'::jsonb),
    ('Tether-9.1', 'Tether-9', 'Tether-9.1 Style lock approval', 'Staff approve StyleLock.md after Tether-CD.1 is Adopted (palette, silhouettes, materials). StyleLock.md stays Draft until staff accept.

Output: Docs/StyleLock.md accepted by staff.

Definition of Done:
- Staff accept Docs/StyleLock.md.
- Until then StyleLock.md stays Draft.', 'Art', 'Medium', 'Medium', true, 10, null, '[{"id":"s1","label":"Staff accept Docs/StyleLock.md.","done":false},{"id":"s2","label":"Until then StyleLock.md stays Draft.","done":false}]'::jsonb),
    ('Tether-9.2', 'Tether-9', 'Tether-9.2 Core final assets', 'Core final assets. Blocked on Tether-CD.1 Suit and world palette only. Not on Enemies. Not on maps.

Blocker: Waiting on Tether-CD.1 Suit and world palette.', 'Art', 'Medium', 'Medium', false, 20, 'Tether-CD.1', '[]'::jsonb),
    ('Tether-10', null, 'Tether-10 Networking foundation', 'Networking foundation. Staff Only. Not claimable.

Founder-owned. Default candidate: Iris on UE 5.8.', 'Code', 'Medium', 'Medium', true, 100, null, '[]'::jsonb),
    ('Tether-10.1', 'Tether-10', 'Tether-10.1 Core netcode', 'Two-window pawn + beam sync. Do not require two machines. Default candidate: Iris on UE 5.8.

Founder-owned. Staff Only Done.', 'Code', 'Medium', 'Medium', true, 10, null, '[]'::jsonb),
    ('Tether-10.2', 'Tether-10', 'Tether-10.2 Two-machine test on TetherPrototype', 'Two-machine test on TetherPrototype. Deferred.

Blocker: Two-machine test deferred.

Founder-owned.', 'Code', 'Medium', 'Medium', true, 20, null, '[]'::jsonb),
    ('Tether-11', null, 'Tether-11 UI', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Design', 'Medium', 'Medium', false, 110, 'Tether-6', '[]'::jsonb),
    ('Tether-12', null, 'Tether-12 Audio', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Audio', 'Medium', 'Medium', false, 120, 'Tether-6', '[]'::jsonb),
    ('Tether-13', null, 'Tether-13 Playtesting and polish', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'QA', 'Medium', 'Medium', false, 130, 'Tether-6', '[]'::jsonb);

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
       and v_id is distinct from v_blocker
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
