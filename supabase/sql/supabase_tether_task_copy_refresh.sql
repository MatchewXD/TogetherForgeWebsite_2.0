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
    ('Tether-P.2', 'Tether-P.2 Art exploration', 'Art exploration for player, beam, and scale. Not final production art. StyleLock.md is Draft. Cite Docs/Vision.md and Docs/StyleLock.md.', '[]'::jsonb),
    ('Tether-P.2.1', 'Tether-P.2.1 Player stand-in silhouettes', 'Three readable silhouette thumbnails for a suited colony crew stand-in. Do not model a final character. Do not change the prototype mesh unless staff ask. Cite Docs/StyleLock.md.

Output: Docs/art-explorations/player/ plus a short note saying which silhouette reads at a distance.

Definition of Done:
- Three readable silhouette thumbnails exist in Docs/art-explorations/player/.
- A short note says which silhouette reads at a distance.', '[{"id":"s1","label":"Three readable silhouette thumbnails exist in Docs/art-explorations/player/.","done":false},{"id":"s2","label":"A short note says which silhouette reads at a distance.","done":false}]'::jsonb),
    ('Tether-P.2.2', 'Tether-P.2.2 Tether visual directions', 'Three stills or overlays of the shared energy beam at Low vs High tension. Stay a beam between bodies. Cite Docs/StyleLock.md and Docs/TetherRules.txt.

Output: Docs/art-explorations/tether/.

Definition of Done:
- Three stills or overlays of Low vs High tension exist in Docs/art-explorations/tether/.
- The tether stays a beam between bodies, not a physical cable.', '[{"id":"s1","label":"Three stills or overlays of Low vs High tension exist in Docs/art-explorations/tether/.","done":false},{"id":"s2","label":"The tether stays a beam between bodies, not a physical cable.","done":false}]'::jsonb),
    ('Tether-P.2.3', 'Tether-P.2.3 Modular kit scale sheet', 'One scale sheet so later blockout pieces match. Starting sizes are already in Docs/StyleLock.md. Cite Docs/StyleLock.md.

Output: Docs/art-explorations/scale-sheet.md with player height, airlock height, ramp, resource size, one floor tile, and a simple diagram.

Definition of Done:
- Docs/art-explorations/scale-sheet.md documents player height, airlock height, ramp, resource size, and one floor tile.
- The sheet includes a simple diagram.', '[{"id":"s1","label":"Docs/art-explorations/scale-sheet.md documents player height, airlock height, ramp, resource size, and one floor tile.","done":false},{"id":"s2","label":"The sheet includes a simple diagram.","done":false}]'::jsonb),
    ('Tether-P.3', 'Tether-P.3 QA templates', 'Templates for the first beam playtests. Staff Only.', '[]'::jsonb),
    ('Tether-P.3.1', 'Tether-P.3.1 Dual-control checklist', 'Write Docs/qa/DualControlChecklist.md. Leave result rows blank. Do not tune physics in this task.

Output: Docs/qa/DualControlChecklist.md with rows: one player moves, two players move apart, one jumps, one walks off a ledge, short hang on the beam, tension readable from a spectator view. Leave a row for 3-4 when that layout is no longer Open.

Definition of Done:
- Docs/qa/DualControlChecklist.md exists with the listed rows.
- A 3-4 player row is left for when that layout is no longer Open.
- Result rows are blank.
- This task does not tune physics.', '[{"id":"s1","label":"Docs/qa/DualControlChecklist.md exists with the listed rows.","done":false},{"id":"s2","label":"A 3-4 player row is left for when that layout is no longer Open.","done":false},{"id":"s3","label":"Result rows are blank.","done":false},{"id":"s4","label":"This task does not tune physics.","done":false}]'::jsonb),
    ('Tether-P.3.2', 'Tether-P.3.2 Playtest note template', 'Write Docs/qa/PlaytestNote.md with fields: date, build, testers, what felt good, what broke, recommended task change (not a new feature).

Output: Docs/qa/PlaytestNote.md.

Definition of Done:
- Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).', '[{"id":"s1","label":"Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).","done":false}]'::jsonb),
    ('Tether-P.4', 'Tether-P.4 Community credit', 'Credit current off-site helpers. Blocked until the Grant Credit staff tool exists on the site.

Blocker: Blocked until the Grant Credit staff tool exists on the site.', '[]'::jsonb),
    ('Tether-P.4.1', 'Tether-P.4.1 Credit current off-site helpers', 'Staff: use Grant Credit for current Discord moderators and any off-site help already given. Public line example: Discord moderation, September 2026. Pending email credits are allowed if they do not yet have a site account. Do not invent placeholder people. Do not complete this card without the real tool.

Output: Grant Credit entries for current off-site helpers (no invented people).

Definition of Done:
- Current Discord moderators and existing off-site help are credited with the Grant Credit staff tool.
- No placeholder people were invented.

Blocker: Blocked until the Grant Credit staff tool exists on the site.', '[{"id":"s1","label":"Current Discord moderators and existing off-site help are credited with the Grant Credit staff tool.","done":false},{"id":"s2","label":"No placeholder people were invented.","done":false}]'::jsonb),
    ('Tether-2', 'Tether-2 Core tether physics', 'Shared tether feels good and is readable. First feel test uses two pawns. Do not unlock later gameplay until that test is playtested and TetherRules.txt is updated. Solo behavior and 3-4 tether topology stay Open.', '[]'::jsonb),
    ('Tether-2.1', 'Tether-2.1 Basic tether between two pawns', 'First feel test: a basic tether between two pawns.', '[]'::jsonb),
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
    ('Tether-2.2', 'Tether-2.2 Tension states', 'Tension states tethered players can read.', '[]'::jsonb),
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
    ('Tether-2.3', 'Tether-2.3 Over-stretch and recovery', 'Over-stretch and recovery.', '[]'::jsonb),
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
    ('Tether-3', 'Tether-3 Tether-aware movement', 'Tether-aware movement.

Blocker: Epic 2 playtest not passed.', '[]'::jsonb),
    ('Tether-3.1', 'Tether-3.1 Core locomotion and camera', 'Core locomotion and camera choice documented in Docs/.

Blocker: Epic 2 playtest not passed.', '[]'::jsonb),
    ('Tether-3.2', 'Tether-3.2 Pull/resist and failure-mode tests', 'Pull/resist and failure-mode tests.

Blocker: Epic 2 playtest not passed.', '[]'::jsonb),
    ('Tether-4', 'Tether-4 Resources and warp', 'Resources and warp.

Blocker: Epic 3 not stable.', '[]'::jsonb),
    ('Tether-4.1', 'Tether-4.1 ResourceNode and carry limit', 'ResourceNode, carry limit 1 or 2, at least six nodes.

Blocker: Epic 3 not stable.', '[]'::jsonb),
    ('Tether-4.2', 'Tether-4.2 Checkpoint warp and session total', 'Checkpoint warp and session total.

Output: Done at collect → carry → warp → total updates.

Definition of Done:
- Collect → carry → warp → session total updates in one loop.

Blocker: Epic 3 not stable.', '[{"id":"s1","label":"Collect → carry → warp → session total updates in one loop.","done":false}]'::jsonb),
    ('Tether-5', 'Tether-5 Enemies that stress the tether', 'Enemies that stress the tether.

Blocker: Epic 4 loop not working.', '[]'::jsonb),
    ('Tether-5.1', 'Tether-5.1 Latch enemy', 'Latch enemy, attach penalty, Energy Pulse removal.

Blocker: Epic 4 loop not working.', '[]'::jsonb),
    ('Tether-6', 'Tether-6 First playable surface level', 'First playable surface level.

Blocker: Epic 5 has no working enemy.', '[]'::jsonb),
    ('Tether-6.1', 'Tether-6.1 Modular graybox kit plus Level_01_Surface', 'Modular graybox kit plus Level_01_Surface.

Blocker: Epic 5 has no working enemy.', '[]'::jsonb),
    ('Tether-6.2', 'Tether-6.2 End-to-end 1-4 player loop', 'End-to-end 1-4 player cooperative loop with a recorded successful run. Solo behavior and 3-4 tether topology stay Open.

Definition of Done:
- A recorded successful 1-4 player run exists.

Blocker: Epic 5 has no working enemy.', '[{"id":"s1","label":"A recorded successful 1-4 player run exists.","done":false}]'::jsonb),
    ('Tether-7', 'Tether-7 Tools, upgrades, between-level flow', 'Parked placeholder. Do not invent extra Smalls.', '[]'::jsonb),
    ('Tether-7.1', 'Tether-7.1 Upgrade screen', 'Parked placeholder: upgrade screen.', '[]'::jsonb),
    ('Tether-7.2', 'Tether-7.2 First upgrades', 'Parked placeholder: first upgrades — max distance, Anchor, Shared Reinforcer.', '[]'::jsonb),
    ('Tether-8', 'Tether-8 Final station sequence', 'Parked placeholder. Do not invent extra Smalls.', '[]'::jsonb),
    ('Tether-8.1', 'Tether-8.1 Station blockout', 'Parked placeholder: station blockout.', '[]'::jsonb),
    ('Tether-8.2', 'Tether-8.2 Creature drive-off', 'Parked placeholder: creature drive-off.', '[]'::jsonb),
    ('Tether-9', 'Tether-9 Art pipeline', 'Art pipeline. Exploration is Staff Only until style lock is approved.', '[]'::jsonb),
    ('Tether-9.1', 'Tether-9.1 Style lock approval', 'Style lock approval (exploration). Staff Only for now.', '[]'::jsonb),
    ('Tether-9.2', 'Tether-9.2 Core final assets', 'Core final assets.

Blocker: Style lock not approved.', '[]'::jsonb),
    ('Tether-10', 'Tether-10 Networking foundation', 'Networking foundation. Founder-owned.

Founder-owned. Default candidate: Iris on UE 5.8.', '[]'::jsonb),
    ('Tether-10.1', 'Tether-10.1 Core netcode', 'Core netcode. Default candidate: Iris on UE 5.8. Host/join, pawn sync, tether sync later.

Founder-owned.', '[]'::jsonb),
    ('Tether-10.2', 'Tether-10.2 Two-machine test on TetherPrototype', 'Two-machine test on TetherPrototype.

Founder-owned.', '[]'::jsonb),
    ('Tether-11', 'Tether-11 UI', 'Parked placeholder. Do not invent extra Smalls.', '[]'::jsonb),
    ('Tether-12', 'Tether-12 Audio', 'Parked placeholder. Do not invent extra Smalls.', '[]'::jsonb),
    ('Tether-13', 'Tether-13 Playtesting and polish', 'Parked placeholder. Do not invent extra Smalls.', '[]'::jsonb);

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
