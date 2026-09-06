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
    ('Tether-P', null, 'Tether-P Open game work', 'Tether game work that is not already in the Unreal repo. Staging only. Do not publish. Networking stays Tether-10.', 'Art', 'Medium', 'Medium', true, 15, null, '[]'::jsonb),
    ('Tether-P.2', 'Tether-P', 'Tether-P.2 Art exploration', 'Art exploration for player, beam, and scale. Not final production art. StyleLock.md is Draft. Cite Docs/Vision.md and Docs/StyleLock.md.', 'Art', 'Easy', 'First Spark', true, 10, null, '[]'::jsonb),
    ('Tether-P.2.1', 'Tether-P.2', 'Tether-P.2.1 Player stand-in silhouettes', 'Three readable silhouette thumbnails for a suited colony crew stand-in. Do not model a final character. Do not change the prototype mesh unless staff ask. Cite Docs/StyleLock.md.

Output: Docs/art-explorations/player/ plus a short note saying which silhouette reads at a distance.

Definition of Done:
- Three readable silhouette thumbnails exist in Docs/art-explorations/player/.
- A short note says which silhouette reads at a distance.', 'Art', 'Easy', 'First Spark', true, 10, null, '[{"id":"s1","label":"Three readable silhouette thumbnails exist in Docs/art-explorations/player/.","done":false},{"id":"s2","label":"A short note says which silhouette reads at a distance.","done":false}]'::jsonb),
    ('Tether-P.2.2', 'Tether-P.2', 'Tether-P.2.2 Tether visual directions', 'Three stills or overlays of the shared energy beam at Low vs High tension. Stay a beam between bodies. Cite Docs/StyleLock.md and Docs/TetherRules.txt.

Output: Docs/art-explorations/tether/.

Definition of Done:
- Three stills or overlays of Low vs High tension exist in Docs/art-explorations/tether/.
- The tether stays a beam between bodies, not a physical cable.', 'Art', 'Easy', 'First Spark', true, 20, null, '[{"id":"s1","label":"Three stills or overlays of Low vs High tension exist in Docs/art-explorations/tether/.","done":false},{"id":"s2","label":"The tether stays a beam between bodies, not a physical cable.","done":false}]'::jsonb),
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
    ('Tether-3', null, 'Tether-3 Tether-aware movement', 'Tether-aware movement.

Blocker: Epic 2 playtest not passed.', 'Code', 'Medium', 'Medium', false, 30, 'Tether-2', '[]'::jsonb),
    ('Tether-3.1', 'Tether-3', 'Tether-3.1 Core locomotion and camera', 'Core locomotion and camera choice documented in Docs/.

Blocker: Epic 2 playtest not passed.', 'Code', 'Medium', 'Medium', false, 10, 'Tether-2', '[]'::jsonb),
    ('Tether-3.2', 'Tether-3', 'Tether-3.2 Pull/resist and failure-mode tests', 'Pull/resist and failure-mode tests.

Blocker: Epic 2 playtest not passed.', 'Code', 'Medium', 'Medium', false, 20, 'Tether-2', '[]'::jsonb),
    ('Tether-4', null, 'Tether-4 Resources and warp', 'Resources and warp.

Blocker: Epic 3 not stable.', 'Code', 'Medium', 'Medium', false, 40, 'Tether-3', '[]'::jsonb),
    ('Tether-4.1', 'Tether-4', 'Tether-4.1 ResourceNode and carry limit', 'ResourceNode, carry limit 1 or 2, at least six nodes.

Blocker: Epic 3 not stable.', 'Code', 'Medium', 'Medium', false, 10, 'Tether-3', '[]'::jsonb),
    ('Tether-4.2', 'Tether-4', 'Tether-4.2 Checkpoint warp and session total', 'Checkpoint warp and session total.

Output: Done at collect → carry → warp → total updates.

Definition of Done:
- Collect → carry → warp → session total updates in one loop.

Blocker: Epic 3 not stable.', 'Code', 'Medium', 'Medium', false, 20, 'Tether-3', '[{"id":"s1","label":"Collect → carry → warp → session total updates in one loop.","done":false}]'::jsonb),
    ('Tether-5', null, 'Tether-5 Enemies that stress the tether', 'Enemies that stress the tether.

Blocker: Epic 4 loop not working.', 'Code', 'Medium', 'Medium', false, 50, 'Tether-4', '[]'::jsonb),
    ('Tether-5.1', 'Tether-5', 'Tether-5.1 Latch enemy', 'Latch enemy, attach penalty, Energy Pulse removal.

Blocker: Epic 4 loop not working.', 'Code', 'Medium', 'Medium', false, 10, 'Tether-4', '[]'::jsonb),
    ('Tether-6', null, 'Tether-6 First playable surface level', 'First playable surface level.

Blocker: Epic 5 has no working enemy.', 'Level Design', 'Medium', 'Medium', false, 60, 'Tether-5', '[]'::jsonb),
    ('Tether-6.1', 'Tether-6', 'Tether-6.1 Modular graybox kit plus Level_01_Surface', 'Modular graybox kit plus Level_01_Surface.

Blocker: Epic 5 has no working enemy.', 'Level Design', 'Medium', 'Medium', false, 10, 'Tether-5', '[]'::jsonb),
    ('Tether-6.2', 'Tether-6', 'Tether-6.2 End-to-end 1-4 player loop', 'End-to-end 1-4 player cooperative loop with a recorded successful run. Solo behavior and 3-4 tether topology stay Open.

Definition of Done:
- A recorded successful 1-4 player run exists.

Blocker: Epic 5 has no working enemy.', 'QA', 'Medium', 'Medium', false, 20, 'Tether-5', '[{"id":"s1","label":"A recorded successful 1-4 player run exists.","done":false}]'::jsonb),
    ('Tether-7', null, 'Tether-7 Tools, upgrades, between-level flow', 'Parked placeholder. Do not invent extra Smalls.', 'Code', 'Medium', 'Medium', false, 70, null, '[]'::jsonb),
    ('Tether-7.1', 'Tether-7', 'Tether-7.1 Upgrade screen', 'Parked placeholder: upgrade screen.', 'Design', 'Medium', 'Medium', false, 10, null, '[]'::jsonb),
    ('Tether-7.2', 'Tether-7', 'Tether-7.2 First upgrades', 'Parked placeholder: first upgrades — max distance, Anchor, Shared Reinforcer.', 'Code', 'Medium', 'Medium', false, 20, null, '[]'::jsonb),
    ('Tether-8', null, 'Tether-8 Final station sequence', 'Parked placeholder. Do not invent extra Smalls.', 'Level Design', 'Medium', 'Medium', false, 80, null, '[]'::jsonb),
    ('Tether-8.1', 'Tether-8', 'Tether-8.1 Station blockout', 'Parked placeholder: station blockout.', 'Level Design', 'Medium', 'Medium', false, 10, null, '[]'::jsonb),
    ('Tether-8.2', 'Tether-8', 'Tether-8.2 Creature drive-off', 'Parked placeholder: creature drive-off.', 'Code', 'Medium', 'Medium', false, 20, null, '[]'::jsonb),
    ('Tether-9', null, 'Tether-9 Art pipeline', 'Art pipeline. Exploration is Staff Only until style lock is approved.', 'Art', 'Medium', 'Medium', true, 90, null, '[]'::jsonb),
    ('Tether-9.1', 'Tether-9', 'Tether-9.1 Style lock approval', 'Style lock approval (exploration). Staff Only for now.', 'Art', 'Medium', 'Medium', true, 10, null, '[]'::jsonb),
    ('Tether-9.2', 'Tether-9', 'Tether-9.2 Core final assets', 'Core final assets.

Blocker: Style lock not approved.', 'Art', 'Medium', 'Medium', false, 20, 'Tether-9.1', '[]'::jsonb),
    ('Tether-10', null, 'Tether-10 Networking foundation', 'Networking foundation. Founder-owned.

Founder-owned. Default candidate: Iris on UE 5.8.', 'Code', 'Medium', 'Medium', true, 100, null, '[]'::jsonb),
    ('Tether-10.1', 'Tether-10', 'Tether-10.1 Core netcode', 'Core netcode. Default candidate: Iris on UE 5.8. Host/join, pawn sync, tether sync later.

Founder-owned.', 'Code', 'Medium', 'Medium', true, 10, null, '[]'::jsonb),
    ('Tether-10.2', 'Tether-10', 'Tether-10.2 Two-machine test on TetherPrototype', 'Two-machine test on TetherPrototype.

Founder-owned.', 'Code', 'Medium', 'Medium', true, 20, null, '[]'::jsonb),
    ('Tether-11', null, 'Tether-11 UI', 'Parked placeholder. Do not invent extra Smalls.', 'Design', 'Medium', 'Medium', false, 110, null, '[]'::jsonb),
    ('Tether-12', null, 'Tether-12 Audio', 'Parked placeholder. Do not invent extra Smalls.', 'Audio', 'Medium', 'Medium', false, 120, null, '[]'::jsonb),
    ('Tether-13', null, 'Tether-13 Playtesting and polish', 'Parked placeholder. Do not invent extra Smalls.', 'QA', 'Medium', 'Medium', false, 130, null, '[]'::jsonb);

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
