-- Tether v0.6 copy refresh only.
-- Updates title/description/checklist. Does not change state, visibility, hierarchy, or IDs.
-- Does not insert or publish. Safe to re-run.

do $$
declare
  r record;
begin
  create temporary table if not exists tmp_tether_v06_copy (
    code text primary key,
    title text not null,
    description text,
    subtasks jsonb not null default '[]'::jsonb
  ) on commit drop;

  delete from tmp_tether_v06_copy;

  insert into tmp_tether_v06_copy (code, title, description, subtasks) values
    ('Tether-1', 'Tether-1 Project foundation', 'One engine version, one repo, one folder map, Canon packet.', '[]'::jsonb),
    ('Tether-1.1', 'Tether-1.1 Engine lock and empty project', 'Lock Unreal 5.8.x and create the empty Tether project.', '[]'::jsonb),
    ('Tether-1.1.1', 'Tether-1.1.1 Record the engine decision', 'Record the engine decision.

Output: Docs/EngineDecision.md with 5.8.x lock, why, four requirements, staff sign-off.

Definition of Done:
- Docs/EngineDecision.md exists with 5.8.x lock, rationale, four requirements, and staff sign-off.
- README notes the exact launcher build. Do not start on UE6.', '[{"id":"s1","label":"Docs/EngineDecision.md exists with 5.8.x lock, rationale, four requirements, and staff sign-off.","done":false},{"id":"s2","label":"README notes the exact launcher build. Do not start on UE6.","done":false}]'::jsonb),
    ('Tether-1.1.2', 'Tether-1.1.2 Install and create the project', 'Install Unreal 5.8.x and create the Tether project.

Output: Tether UE 5.8.x project, Content/Tether folder tree, Maps/TetherPrototype as startup map, project opens with no errors.

Definition of Done:
- Project opens in UE 5.8.x with no errors.
- Content/Tether folder tree exists (Characters, Tether, Maps, Enemies, Interact, Modular, UI, Audio).
- Maps/TetherPrototype is the startup map.', '[{"id":"s1","label":"Project opens in UE 5.8.x with no errors.","done":false},{"id":"s2","label":"Content/Tether folder tree exists (Characters, Tether, Maps, Enemies, Interact, Modular, UI, Audio).","done":false},{"id":"s3","label":"Maps/TetherPrototype is the startup map.","done":false}]'::jsonb),
    ('Tether-1.2', 'Tether-1.2 GitHub and collaboration base', 'Private GitHub repo and collaboration rules.', '[]'::jsonb),
    ('Tether-1.2.1', 'Tether-1.2.1 Repository', 'Create the private GitHub repository.

Output: Private repo, Unreal gitignore, LFS, first commit, develop + protected main, Docs/Repo.md with URL.

Definition of Done:
- Private GitHub repo exists with official Unreal gitignore and Git LFS for Unreal assets.
- First commit is on develop; main is protected; PRs are required.
- Docs/Repo.md records the URL.
- PR titles use the Task ID (example Tether-1.2.1).', '[{"id":"s1","label":"Private GitHub repo exists with official Unreal gitignore and Git LFS for Unreal assets.","done":false},{"id":"s2","label":"First commit is on develop; main is protected; PRs are required.","done":false},{"id":"s3","label":"Docs/Repo.md records the URL.","done":false},{"id":"s4","label":"PR titles use the Task ID (example Tether-1.2.1).","done":false}]'::jsonb),
    ('Tether-1.2.2', 'Tether-1.2.2 README and CONTRIBUTING', 'Document how to open the project and how to contribute.

Output: README (version, how to open, how to run TetherPrototype), CONTRIBUTING (claim on site, Task ID, no invented scope), PR template, access rule.

Definition of Done:
- README covers version, how to open, and how to run TetherPrototype.
- CONTRIBUTING covers claim on site, Task ID in PRs, and no invented scope.
- PR template exists.
- Access rule: granted after a claimed repo task is approved, once public claiming exists.', '[{"id":"s1","label":"README covers version, how to open, and how to run TetherPrototype.","done":false},{"id":"s2","label":"CONTRIBUTING covers claim on site, Task ID in PRs, and no invented scope.","done":false},{"id":"s3","label":"PR template exists.","done":false},{"id":"s4","label":"Access rule: granted after a claimed repo task is approved, once public claiming exists.","done":false}]'::jsonb),
    ('Tether-1.3', 'Tether-1.3 Canon packet', 'Canon packet: vision, what this is not, style lock, Tether rules.', '[]'::jsonb),
    ('Tether-1.3.1', 'Tether-1.3.1 Vision and What this is not', 'Write Vision and What this is not.

Output: Docs/Vision.md and Docs/WhatThisIsNot.md.

Definition of Done:
- Docs/Vision.md exists.
- Docs/WhatThisIsNot.md exists.', '[{"id":"s1","label":"Docs/Vision.md exists.","done":false},{"id":"s2","label":"Docs/WhatThisIsNot.md exists.","done":false}]'::jsonb),
    ('Tether-1.3.2', 'Tether-1.3.2 Style lock and Tether rules', 'Draft style lock and starting Tether rules.

Output: Docs/StyleLock.md (Draft until approved) and Docs/TetherRules.txt (starting bands, Open items labeled). Link all four Canon files from README.

Definition of Done:
- Docs/StyleLock.md exists and is labeled Draft until approved.
- Docs/TetherRules.txt exists with starting bands and Open items labeled.
- README links Vision, WhatThisIsNot, StyleLock, and TetherRules.', '[{"id":"s1","label":"Docs/StyleLock.md exists and is labeled Draft until approved.","done":false},{"id":"s2","label":"Docs/TetherRules.txt exists with starting bands and Open items labeled.","done":false},{"id":"s3","label":"README links Vision, WhatThisIsNot, StyleLock, and TetherRules.","done":false}]'::jsonb),
    ('Tether-P', 'Tether-P First Spark', 'Public First Spark lane: docs and QA. Art suggestions go in Open Questions. Tether-9 is the art section. Networking stays Tether-10.', '[]'::jsonb),
    ('Tether-P.3', 'Tether-P.3 QA templates', 'Templates for the first beam playtests. Staff Only.', '[]'::jsonb),
    ('Tether-P.3.2', 'Tether-P.3.2 Playtest note template', 'Write Docs/qa/PlaytestNote.md with fields: date, build, testers, what felt good, what broke, recommended task change (not a new feature).

Output: Docs/qa/PlaytestNote.md.

Definition of Done:
- Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).', '[{"id":"s1","label":"Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).","done":false}]'::jsonb),
    ('Tether-2', 'Tether-2 Core tether physics', 'Shared tether feels good and is readable. First feel test uses two pawns. Do not unlock later gameplay until that test is playtested and TetherRules.txt is updated. Solo behavior and 3-4 tether topology stay Open.', '[]'::jsonb),
    ('Tether-2.1', 'Tether-2.1 Basic tether between two pawns', 'First feel test: a basic tether between two pawns.', '[]'::jsonb),
    ('Tether-2.1.0', 'Tether-2.1.0 Prototype graybox', 'The live Unreal map TetherPrototype is a black void. Build a walkable graybox before stand-ins or the tether line. Follow Docs/TetherPrototype.md. No art, enemies, resources, or Level 1 work.

Output: A walkable Content/Tether/Maps/TetherPrototype instead of a void: lit floor, collision, 200 cm tiles, at least 20 x 20 m, one ledge 250 to 400 cm high, two Player Starts about 300 cm apart.

Definition of Done:
- Map is lit.
- Floor holds a pawn.
- Ledge exists (250 to 400 cm).
- Two Player Starts exist about 300 cm apart.
- Editor opens Content/Tether/Maps/TetherPrototype.', '[{"id":"s1","label":"Map is lit.","done":false},{"id":"s2","label":"Floor holds a pawn.","done":false},{"id":"s3","label":"Ledge exists (250 to 400 cm).","done":false},{"id":"s4","label":"Two Player Starts exist about 300 cm apart.","done":false},{"id":"s5","label":"Editor opens Content/Tether/Maps/TetherPrototype.","done":false}]'::jsonb),
    ('Tether-2.1.1', 'Tether-2.1.1 Player stand-ins', 'Player stand-ins.

Output: Content/Tether/Characters/BP_PlayerStandIn, two stand-ins in TetherPrototype for the first feel test.

Definition of Done:
- BP_PlayerStandIn exists under Content/Tether/Characters/.
- Two stand-ins are in TetherPrototype for the first feel test.', '[{"id":"s1","label":"BP_PlayerStandIn exists under Content/Tether/Characters/.","done":false},{"id":"s2","label":"Two stand-ins are in TetherPrototype for the first feel test.","done":false}]'::jsonb),
    ('Tether-2.1.2', 'Tether-2.1.2 Distance constraint and visual', 'Distance constraint and visual.

Output: Content/Tether/Tether/, max distance 8–12 units written into TetherRules.txt, line changes at stretch.

Definition of Done:
- Tether lives under Content/Tether/Tether/.
- Max distance 8–12 units is written into TetherRules.txt.
- The line changes at stretch.', '[{"id":"s1","label":"Tether lives under Content/Tether/Tether/.","done":false},{"id":"s2","label":"Max distance 8–12 units is written into TetherRules.txt.","done":false},{"id":"s3","label":"The line changes at stretch.","done":false}]'::jsonb),
    ('Tether-2.1.3', 'Tether-2.1.3 Local dual control', 'Document local controls for the two-pawn feel test.

Output: Docs/Controls.md.

Definition of Done:
- Docs/Controls.md exists and documents local controls for the two-pawn feel test.', '[{"id":"s1","label":"Docs/Controls.md exists and documents local controls for the two-pawn feel test.","done":false}]'::jsonb),
    ('Tether-2.2', 'Tether-2.2 Tension states', 'Tension states tethered players can read.

Blocker: Do not start until a TetherPrototype graybox exists.', '[]'::jsonb),
    ('Tether-2.2.1', 'Tether-2.2.1 Tension calculation', 'Tension calculation.

Output: Low 0–50, Medium 50–85, High 85–100. Write thresholds in TetherRules.txt.

Definition of Done:
- Low 0–50, Medium 50–85, High 85–100 are implemented.
- Thresholds are written in TetherRules.txt.', '[{"id":"s1","label":"Low 0–50, Medium 50–85, High 85–100 are implemented.","done":false},{"id":"s2","label":"Thresholds are written in TetherRules.txt.","done":false}]'::jsonb),
    ('Tether-2.2.2', 'Tether-2.2.2 Movement response to High tension', 'Movement response to High tension.

Output: Document the speed multiplier.

Definition of Done:
- High-tension speed multiplier is implemented and documented.', '[{"id":"s1","label":"High-tension speed multiplier is implemented and documented.","done":false}]'::jsonb),
    ('Tether-2.2.3', 'Tether-2.2.3 Visual and placeholder High-tension audio', 'Visual and placeholder High-tension audio.

Output: Spectator can read the state.

Definition of Done:
- A spectator can read Low / Medium / High from the visual.
- Placeholder High-tension audio plays.', '[{"id":"s1","label":"A spectator can read Low / Medium / High from the visual.","done":false},{"id":"s2","label":"Placeholder High-tension audio plays.","done":false}]'::jsonb),
    ('Tether-2.3', 'Tether-2.3 Over-stretch and recovery', 'Over-stretch and recovery.

Blocker: Do not start until a TetherPrototype graybox exists.', '[]'::jsonb),
    ('Tether-2.3.1', 'Tether-2.3.1 Over-stretch behavior', 'Over-stretch behavior.

Output: Documented in TetherRules.txt and implemented.

Definition of Done:
- Over-stretch behavior is documented in TetherRules.txt.
- Over-stretch behavior is implemented.', '[{"id":"s1","label":"Over-stretch behavior is documented in TetherRules.txt.","done":false},{"id":"s2","label":"Over-stretch behavior is implemented.","done":false}]'::jsonb),
    ('Tether-2.3.2', 'Tether-2.3.2 Recovery', 'Recovery after over-stretch.

Output: Done only after a two-pawn feel test using Docs/qa/PlaytestNote.md.

Definition of Done:
- Recovery is implemented.
- A two-pawn feel test was recorded with Docs/qa/PlaytestNote.md.
- TetherRules.txt is updated from that playtest.', '[{"id":"s1","label":"Recovery is implemented.","done":false},{"id":"s2","label":"A two-pawn feel test was recorded with Docs/qa/PlaytestNote.md.","done":false},{"id":"s3","label":"TetherRules.txt is updated from that playtest.","done":false}]'::jsonb),
    ('Tether-3', 'Tether-3 Tether-aware movement', 'Tether-aware movement. Epic 2 playtest is treated as passed. Community claims Tether-3.1. Staff retune pull on Tether-3.2.', '[]'::jsonb),
    ('Tether-3.1', 'Tether-3.1 Core locomotion and camera', 'Walk, run, jump, ground detect, keyboard and gamepad. Document speeds in Docs/ or TetherRules.txt. Camera is Open: third-person that keeps both pawns readable, or first-person plus a tether cue. Write the choice in Docs/Camera.md. Cite Docs/TetherRules.txt. Do not retune pull, L100, or Tether Health.

Output: Docs/Camera.md plus documented walk/run/jump speeds.

Definition of Done:
- Walk, run, jump, and ground detect work on keyboard and gamepad.
- Speeds are documented in Docs/ or TetherRules.txt.
- Camera choice is written in Docs/Camera.md.
- This card does not retune pull, L100, or Tether Health.', '[{"id":"s1","label":"Walk, run, jump, and ground detect work on keyboard and gamepad.","done":false},{"id":"s2","label":"Speeds are documented in Docs/ or TetherRules.txt.","done":false},{"id":"s3","label":"Camera choice is written in Docs/Camera.md.","done":false},{"id":"s4","label":"This card does not retune pull, L100, or Tether Health.","done":false}]'::jsonb),
    ('Tether-3.2', 'Tether-3.2 Pull/resist and failure-mode tests', 'Staff retune pull toward partner and optional resist. Community must not retune pull. Failure-mode playtest is Tether-3.2.1.', '[]'::jsonb),
    ('Tether-3.2.1', 'Tether-3.2.1 Failure-mode playtest', 'Playtest failure modes. Do not change TetherRules numbers on this card.

Output: Dated Docs/qa/PlaytestNote.

Definition of Done:
- A dated Docs/qa/PlaytestNote exists.
- Tested: one falls off a ledge.
- Tested: both jump.
- Tested: one sprints / one stands.
- TetherRules numbers were not changed on this card.

Blocker: Waiting on staff pull/resist work on Tether-3.2.', '[{"id":"s1","label":"A dated Docs/qa/PlaytestNote exists.","done":false},{"id":"s2","label":"Tested: one falls off a ledge.","done":false},{"id":"s3","label":"Tested: both jump.","done":false},{"id":"s4","label":"Tested: one sprints / one stands.","done":false},{"id":"s5","label":"TetherRules numbers were not changed on this card.","done":false}]'::jsonb),
    ('Tether-4', 'Tether-4 Resources and warp', 'Resources and warp.

Blocker: Waiting on Tether-3.1 Core locomotion and camera.', '[]'::jsonb),
    ('Tether-4.1', 'Tether-4.1 ResourceNode and carry limit', 'ResourceNode prefab, interact volume, carry limit 1 or 2, deliberate drop. Place at least six nodes in the prototype or a test map.

Definition of Done:
- ResourceNode prefab exists with an interact volume.
- Carry limit is 1 or 2 with a deliberate drop.
- At least six nodes are placed in the prototype or a test map.

Blocker: Waiting on Tether-3.1 Core locomotion and camera.', '[{"id":"s1","label":"ResourceNode prefab exists with an interact volume.","done":false},{"id":"s2","label":"Carry limit is 1 or 2 with a deliberate drop.","done":false},{"id":"s3","label":"At least six nodes are placed in the prototype or a test map.","done":false}]'::jsonb),
    ('Tether-4.2', 'Tether-4.2 Checkpoint warp and session total', 'Checkpoint warp and session total.

Output: Done at collect → carry → warp → total updates.

Definition of Done:
- Collect → carry → warp → session total updates in one loop.

Blocker: Waiting on Tether-4.1 ResourceNode and carry limit.', '[{"id":"s1","label":"Collect → carry → warp → session total updates in one loop.","done":false}]'::jsonb),
    ('Tether-5', 'Tether-5 Enemies that stress the tether', 'Enemies that stress the tether. Threats whose job is coordination, not a DPS sponge.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.', '[]'::jsonb),
    ('Tether-5.1', 'Tether-5.1 Latch enemy', 'Latch enemy moves toward a pawn or the tether midpoint, attaches, applies a documented penalty (extra tension, slow, or drain), and shows a clear attached state. Removal is faster when both players use Energy Pulse inside a short window (pair-remove). Playtest with two people and confirm the pair advantage is obvious.

Definition of Done:
- Latch enemy attaches to a pawn or the tether midpoint with a clear attached state.
- A documented penalty applies while attached.
- Energy Pulse pair-remove is faster when both players use it in a short window.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.', '[{"id":"s1","label":"Latch enemy attaches to a pawn or the tether midpoint with a clear attached state.","done":false},{"id":"s2","label":"A documented penalty applies while attached.","done":false},{"id":"s3","label":"Energy Pulse pair-remove is faster when both players use it in a short window.","done":false}]'::jsonb),
    ('Tether-6', 'Tether-6 First playable surface level', 'First playable surface level.

Blocker: Waiting on Tether-5.1 Latch enemy.', '[]'::jsonb),
    ('Tether-6.1', 'Tether-6.1 Modular graybox kit plus Level_01_Surface', 'Parent for kit pieces and Level_01_Surface blockout. Claim the Smalls.

Blocker: Waiting on Tether-5.1 Latch enemy.', '[]'::jsonb),
    ('Tether-6.1.1', 'Tether-6.1.1 Five modular graybox pieces', 'Five modular graybox pieces in Content/Tether/Modular.

Output: Content/Tether/Modular with at least five graybox pieces.

Definition of Done:
- At least five modular graybox pieces exist in Content/Tether/Modular.

Blocker: Waiting on Tether-5.1 Latch enemy.', '[{"id":"s1","label":"At least five modular graybox pieces exist in Content/Tether/Modular.","done":false}]'::jsonb),
    ('Tether-6.1.2', 'Tether-6.1.2 Block out Level_01_Surface', 'Block out Content/Tether/Maps/Level_01_Surface: start, two traversal sections, resources, one or two enemy points, end checkpoint.

Output: Content/Tether/Maps/Level_01_Surface.

Definition of Done:
- Level_01_Surface has a start, two traversal sections, resources, one or two enemy points, and an end checkpoint.

Blocker: Waiting on Tether-6.1.1 Five modular graybox pieces.', '[{"id":"s1","label":"Level_01_Surface has a start, two traversal sections, resources, one or two enemy points, and an end checkpoint.","done":false}]'::jsonb),
    ('Tether-6.2', 'Tether-6.2 End-to-end 1-4 player loop', 'Recorded 1-4 player loop. Two-window listen server is enough until Tether-10.2 exists. Solo behavior and 3-4 tether topology stay Open.

Definition of Done:
- A recorded successful 1-4 player run exists.
- Two-window listen server is enough until Tether-10.2 exists.

Blocker: Waiting on Tether-6.1.2 Block out Level_01_Surface.', '[{"id":"s1","label":"A recorded successful 1-4 player run exists.","done":false},{"id":"s2","label":"Two-window listen server is enough until Tether-10.2 exists.","done":false}]'::jsonb),
    ('Tether-7', 'Tether-7 Tools, upgrades, between-level flow', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', '[]'::jsonb),
    ('Tether-7.1', 'Tether-7.1 Upgrade screen', 'Parked chapter card: upgrade screen. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', '[]'::jsonb),
    ('Tether-7.2', 'Tether-7.2 First upgrades', 'Parked chapter card: first upgrades — max distance, Anchor, Shared Reinforcer. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', '[]'::jsonb),
    ('Tether-8', 'Tether-8 Final station sequence', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', '[]'::jsonb),
    ('Tether-8.1', 'Tether-8.1 Station blockout', 'Parked chapter card: station blockout. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', '[]'::jsonb),
    ('Tether-8.2', 'Tether-8.2 Creature drive-off', 'Parked chapter card: creature drive-off. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', '[]'::jsonb),
    ('Tether-9', 'Tether-9 Art pipeline', 'Art pipeline. Style lock approval is Staff Only. Art suggestions belong in Open Questions until staff accept StyleLock.md.', '[]'::jsonb),
    ('Tether-9.1', 'Tether-9.1 Style lock approval', 'Staff approve StyleLock.md (palette, silhouettes, materials). StyleLock.md stays Draft until staff accept.

Output: Docs/StyleLock.md accepted by staff.

Definition of Done:
- Staff accept Docs/StyleLock.md.
- Until then StyleLock.md stays Draft.', '[{"id":"s1","label":"Staff accept Docs/StyleLock.md.","done":false},{"id":"s2","label":"Until then StyleLock.md stays Draft.","done":false}]'::jsonb),
    ('Tether-9.2', 'Tether-9.2 Core final assets', 'Core final assets.

Blocker: Style lock not approved.', '[]'::jsonb),
    ('Tether-10', 'Tether-10 Networking foundation', 'Networking foundation. Staff Only. Not claimable.

Founder-owned. Default candidate: Iris on UE 5.8.', '[]'::jsonb),
    ('Tether-10.1', 'Tether-10.1 Core netcode', 'Two-window pawn + beam sync. Do not require two machines. Default candidate: Iris on UE 5.8.

Founder-owned. Staff Only Done.', '[]'::jsonb),
    ('Tether-10.2', 'Tether-10.2 Two-machine test on TetherPrototype', 'Two-machine test on TetherPrototype. Deferred.

Blocker: Two-machine test deferred.

Founder-owned.', '[]'::jsonb),
    ('Tether-11', 'Tether-11 UI', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', '[]'::jsonb),
    ('Tether-12', 'Tether-12 Audio', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', '[]'::jsonb),
    ('Tether-13', 'Tether-13 Playtesting and polish', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', '[]'::jsonb);

  update public.tasks t
  set
    title = r.title,
    description = r.description,
    subtasks = r.subtasks
  from tmp_tether_v06_copy r, public.projects p
  where t.project_id = p.id
    and p.slug in ('tether', 'prototype-systems')
    and (t.title = r.title or t.title like r.code || ' %');
end $$;
