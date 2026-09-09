-- Tether-4 and Tether-5 from Tether_Task_Breakdown_v0.11 → staging board only.
-- Upsert by title / ID prefix. Does not publish. Does not write public rows.
-- Does not add Epic 11. Does not nest Tether-5 under Tether-4.
-- Snatch is the first enemy (5.1). Latch is 5.2. Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v011.sql

do $$
declare
  v_project uuid;
  v_row record;
  v_id uuid;
  v_parent uuid;
  v_created int := 0;
  v_updated int := 0;
  v_archived_dupes int := 0;
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

  create temporary table if not exists tmp_tether_v011 (
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

  delete from tmp_tether_v011;

  insert into tmp_tether_v011 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_code, subtasks
  ) values
    ('Tether-4', null, 'Tether-4 Resources and warp', 'Staff or trusted. Graybox. Can run beside maps. Carry weight vs L100 stays Open.

Source: Tether_Task_Breakdown_v0.11. Staging only. Do not publish.', 'Code', 'Medium', 'Medium', true, 40, null, '[]'::jsonb),
    ('Tether-4.1', 'Tether-4', 'Tether-4.1 Resource nodes', 'Resource nodes the crew can pick up and carry.', 'Code', 'Medium', 'Medium', true, 10, null, '[]'::jsonb),
    ('Tether-4.1.1', 'Tether-4.1', 'Tether-4.1.1 ResourceNode prefab and interact', 'Prefab a ResourceNode the player can interact with. Output in the Tether content tree used by Epic 4. Graybox only.

Output: Graybox ResourceNode prefab in the Tether content tree used by Epic 4.

Definition of Done:
- A ResourceNode prefab exists that the player can interact with.
- Output lives in the Tether content tree used by Epic 4.
- Graybox only. No final mesh.', 'Code', 'Easy', 'Small', true, 10, null, '[{"id":"s1","label":"A ResourceNode prefab exists that the player can interact with.","done":false},{"id":"s2","label":"Output lives in the Tether content tree used by Epic 4.","done":false},{"id":"s3","label":"Graybox only. No final mesh.","done":false}]'::jsonb),
    ('Tether-4.1.2', 'Tether-4.1', 'Tether-4.1.2 Carry 1 or 2 and deliberate drop', 'A pawn can carry 1 or 2 nodes and drop on purpose. No accidental lose-on-bump unless a later rule says so.

Definition of Done:
- A pawn can carry 1 or 2 nodes.
- The pawn can drop a node on purpose.
- Nodes are not lost on bump unless a later rule says so.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"A pawn can carry 1 or 2 nodes.","done":false},{"id":"s2","label":"The pawn can drop a node on purpose.","done":false},{"id":"s3","label":"Nodes are not lost on bump unless a later rule says so.","done":false}]'::jsonb),
    ('Tether-4.1.3', 'Tether-4.1', 'Tether-4.1.3 Place six nodes on a test map', 'At least six nodes on the Epic 4 test map.

Output: Epic 4 test map with at least six ResourceNode instances.

Definition of Done:
- At least six nodes are placed on the Epic 4 test map.', 'Level Design', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"At least six nodes are placed on the Epic 4 test map.","done":false}]'::jsonb),
    ('Tether-4.2', 'Tether-4', 'Tether-4.2 Warp', 'Warp banks carried resources into the session total.', 'Code', 'Medium', 'Medium', true, 20, null, '[]'::jsonb),
    ('Tether-4.2.1', 'Tether-4.2', 'Tether-4.2.1 Warp transfers carry to session total', 'Using warp moves carried resources onto the session total and clears carry.

Definition of Done:
- Warp moves carried resources onto the session total.
- Carry is cleared after a successful warp.', 'Code', 'Easy', 'Small', true, 10, null, '[{"id":"s1","label":"Warp moves carried resources onto the session total.","done":false},{"id":"s2","label":"Carry is cleared after a successful warp.","done":false}]'::jsonb),
    ('Tether-4.2.2', 'Tether-4.2', 'Tether-4.2.2 Placeholder confirm', 'A readable confirm when warp accepts the carry.

Definition of Done:
- A readable confirm plays when warp accepts the carry.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"A readable confirm plays when warp accepts the carry.","done":false}]'::jsonb),
    ('Tether-4.2.3', 'Tether-4.2', 'Tether-4.2.3 Visible running total', 'Session total stays visible after warp.

Definition of Done:
- The session total stays visible after warp.', 'Code', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"The session total stays visible after warp.","done":false}]'::jsonb),
    ('Tether-5', null, 'Tether-5 Enemies', 'Current work. Pressure the net. Tools and shields live on Epic 11, which is out of this pass. Lmax hold already exists from Epic 2. If a creature pulls a pawn to the end of the line, that existing hold stops travel and the creature keeps straining. Maps may leave spawn markers and wire a creature later.

Canon for numbers later: Docs/Enemies.md in the Tether repo. Beam numbers stay in Docs/TetherRules.txt. Source: Tether_Task_Breakdown_v0.11. Staging only. Do not publish. Does not block Tether-4 or Tether-6.', 'Code', 'Medium', 'Medium', true, 50, null, '[]'::jsonb),
    ('Tether-5.0', 'Tether-5', 'Tether-5.0 Shared enemy kit', 'One base every starter creature uses. Until Hand Spark exists, staff debug apply-damage is enough to test stagger.', 'Code', 'Medium', 'Medium', true, 5, null, '[]'::jsonb),
    ('Tether-5.0.1', 'Tether-5.0', 'Tether-5.0.1 Enemy base', 'Content/Tether/Enemies/ base actor or component. Fields: health, stagger step, stagger lockout, held pawn, current job. Collision a pawn and a trace can hit. Done when a dummy takes debug damage, staggers, and prints its job.

Output: Content/Tether/Enemies/ base actor or component.

Definition of Done:
- Base actor or component exists under Content/Tether/Enemies/.
- Fields exist: health, stagger step, stagger lockout, held pawn, current job.
- Collision can be hit by a pawn and a trace.
- A dummy takes debug damage, staggers, and prints its job.', 'Code', 'Easy', 'Small', true, 10, null, '[{"id":"s1","label":"Base actor or component exists under Content/Tether/Enemies/.","done":false},{"id":"s2","label":"Fields exist: health, stagger step, stagger lockout, held pawn, current job.","done":false},{"id":"s3","label":"Collision can be hit by a pawn and a trace.","done":false},{"id":"s4","label":"A dummy takes debug damage, staggers, and prints its job.","done":false}]'::jsonb),
    ('Tether-5.0.2', 'Tether-5.0', 'Tether-5.0.2 Health and stagger', 'Shared component. Each creature sets its own max health and stagger step. On stagger: stop moving a few seconds, drop anything held, readable cue. Starting lockout 2.5s unless a creature card says otherwise. Staff debug print allowed.

Definition of Done:
- Shared health and stagger component exists.
- Each creature sets its own max health and stagger step.
- On stagger the creature stops moving a few seconds, drops anything held, and shows a readable cue.
- Starting lockout is 2.5s unless a creature card says otherwise.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"Shared health and stagger component exists.","done":false},{"id":"s2","label":"Each creature sets its own max health and stagger step.","done":false},{"id":"s3","label":"On stagger the creature stops moving a few seconds, drops anything held, and shows a readable cue.","done":false},{"id":"s4","label":"Starting lockout is 2.5s unless a creature card says otherwise.","done":false}]'::jsonb),
    ('Tether-5.0.3', 'Tether-5.0', 'Tether-5.0.3 Hit pipeline', 'Accept damage from player tools and from staff debug apply-damage. Hit flash or short flinch. Distinct stagger pose or color on threshold. Friendly fire off. Does not create a weapon.

Definition of Done:
- Damage is accepted from player tools and from staff debug apply-damage.
- A hit flash or short flinch plays.
- Stagger threshold has a distinct pose or color.
- Friendly fire is off.
- This card does not create a weapon.', 'Code', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"Damage is accepted from player tools and from staff debug apply-damage.","done":false},{"id":"s2","label":"A hit flash or short flinch plays.","done":false},{"id":"s3","label":"Stagger threshold has a distinct pose or color.","done":false},{"id":"s4","label":"Friendly fire is off.","done":false},{"id":"s5","label":"This card does not create a weapon.","done":false}]'::jsonb),
    ('Tether-5.0.4', 'Tether-5.0', 'Tether-5.0.4 Spawn marker', 'Content/Tether/Enemies/BP_EnemySpawn. Fields: enemy type, count, radius. Maps may place it without wiring behavior. Tick groups use count > 1. Snatch, Latch, Guard default to 1.

Output: Content/Tether/Enemies/BP_EnemySpawn.

Definition of Done:
- BP_EnemySpawn exists under Content/Tether/Enemies/.
- Fields exist: enemy type, count, radius.
- Maps may place it without wiring behavior.
- Tick groups use count > 1. Snatch, Latch, and Guard default to 1.', 'Code', 'Easy', 'Small', true, 40, null, '[{"id":"s1","label":"BP_EnemySpawn exists under Content/Tether/Enemies/.","done":false},{"id":"s2","label":"Fields exist: enemy type, count, radius.","done":false},{"id":"s3","label":"Maps may place it without wiring behavior.","done":false},{"id":"s4","label":"Tick groups use count > 1. Snatch, Latch, and Guard default to 1.","done":false}]'::jsonb),
    ('Tether-5.0.5', 'Tether-5.0', 'Tether-5.0.5 Docs/Enemies.md', 'One page in the Tether repo: starter roster, per-creature numbers, target pick, Downed-from-drop, what CD.2 is for. Point at Docs/Tools.md for Hand Spark and shields. Link from README.

Output: Docs/Enemies.md in the Tether repo, linked from README.

Definition of Done:
- Docs/Enemies.md exists in the Tether repo.
- It covers starter roster, per-creature numbers, target pick, Downed-from-drop, and what CD.2 is for.
- It points at Docs/Tools.md for Hand Spark and shields.
- README links Docs/Enemies.md.', 'Writing', 'Easy', 'Small', false, 50, null, '[{"id":"s1","label":"Docs/Enemies.md exists in the Tether repo.","done":false},{"id":"s2","label":"It covers starter roster, per-creature numbers, target pick, Downed-from-drop, and what CD.2 is for.","done":false},{"id":"s3","label":"It points at Docs/Tools.md for Hand Spark and shields.","done":false},{"id":"s4","label":"README links Docs/Enemies.md.","done":false}]'::jsonb),
    ('Tether-5.0.6', 'Tether-5.0', 'Tether-5.0.6 Enemy QA sheet', 'Docs/qa/EnemyNote.md using the PlaytestNote shape. One row per starter enemy.

Output: Docs/qa/EnemyNote.md.

Definition of Done:
- Docs/qa/EnemyNote.md exists using the PlaytestNote shape.
- There is one row per starter enemy.', 'QA', 'Easy', 'Small', false, 60, null, '[{"id":"s1","label":"Docs/qa/EnemyNote.md exists using the PlaytestNote shape.","done":false},{"id":"s2","label":"There is one row per starter enemy.","done":false}]'::jsonb),
    ('Tether-5.1', 'Tether-5', 'Tether-5.1 Snatch', 'First enemy. Beginner flyer. Working name Snatch. Latch is 5.2.

What it does:
Flies a loose patrol. When close to a player it stops and watches a few seconds, then dives to grab one person. On touch, that pawn is grabbed. Snatch tries to drop them off a high place. If there is no high place it flies up a ways and drops them. Carry is slow enough the crew can act. When the beam hits Lmax the existing hold stops travel. Snatch keeps pulling and straining for the normal hang window. That struggle is the attack window. If the hang ends and Snatch was not staggered or killed, existing snap or drain can kill the beam and Snatch may finish the drop. 1000 health, stagger every 100. Stagger stops it and drops whoever it holds. If the drop downs a player, Snatch stops hunting everyone else, flies to the body, and eats. Attacked while eating: fly away a short while, return to the body, keep eating, leave the rest of the crew alone. If the crew fights it far from the body it returns to Hunt until it dies or they leave it alone long enough to go back to eating.', 'Code', 'Medium', 'Medium', true, 10, null, '[]'::jsonb),
    ('Tether-5.1.1', 'Tether-5.1', 'Tether-5.1.1 Graybox body and spawn', 'Readable flying silhouette, bigger than a pawn, wings or a lift sac. Content/Tether/Enemies/Snatch/. Body collision plus a grab volume in front.

Output: Content/Tether/Enemies/Snatch/ graybox body with grab volume.

Definition of Done:
- A readable flying silhouette exists, bigger than a pawn, with wings or a lift sac.
- Assets live under Content/Tether/Enemies/Snatch/.
- Body collision plus a grab volume in front.', 'Art', 'Easy', 'Small', false, 10, null, '[{"id":"s1","label":"A readable flying silhouette exists, bigger than a pawn, with wings or a lift sac.","done":false},{"id":"s2","label":"Assets live under Content/Tether/Enemies/Snatch/.","done":false},{"id":"s3","label":"Body collision plus a grab volume in front.","done":false}]'::jsonb),
    ('Tether-5.1.2', 'Tether-5.1', 'Tether-5.1.2 Fly and patrol', 'Hover and fly between points or a radius around spawn. Does not clip floors. May pass over gaps. Crew can keep up on foot if they commit. Write fly speed into Docs/Enemies.md after the first playtest.

Definition of Done:
- Snatch hovers and flies between points or a radius around spawn.
- It does not clip floors and may pass over gaps.
- Crew can keep up on foot if they commit.
- Fly speed is written into Docs/Enemies.md after the first playtest.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"Snatch hovers and flies between points or a radius around spawn.","done":false},{"id":"s2","label":"It does not clip floors and may pass over gaps.","done":false},{"id":"s3","label":"Crew can keep up on foot if they commit.","done":false},{"id":"s4","label":"Fly speed is written into Docs/Enemies.md after the first playtest.","done":false}]'::jsonb),
    ('Tether-5.1.3', 'Tether-5.1', 'Tether-5.1.3 Detect, watch, dive', 'Starting aggro about 18m. Watch about 2.5s with a readable lean or eye cue. Dive can miss. Miss returns to hover after a short cool-down. Target pick: prefer a pawn farther from the group center. If everyone is stacked, nearest. Solo answer stays Open.

Definition of Done:
- Starting aggro is about 18m.
- Watch is about 2.5s with a readable lean or eye cue.
- Dive can miss and miss returns to hover after a short cool-down.
- Target pick prefers a pawn farther from the group center; if everyone is stacked, nearest.
- Solo answer stays Open.', 'Code', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"Starting aggro is about 18m.","done":false},{"id":"s2","label":"Watch is about 2.5s with a readable lean or eye cue.","done":false},{"id":"s3","label":"Dive can miss and miss returns to hover after a short cool-down.","done":false},{"id":"s4","label":"Target pick prefers a pawn farther from the group center; if everyone is stacked, nearest.","done":false},{"id":"s5","label":"Solo answer stays Open.","done":false}]'::jsonb),
    ('Tether-5.1.4', 'Tether-5.1', 'Tether-5.1.4 Grab, carry, and keep pulling', 'On touch during dive, attach the pawn to a hold socket. Pawn cannot walk. Pawn can still look and fire once Hand Spark exists. Carry is deliberate. Grabbed pawn stays on the beam. Existing beam rules own length, pull, Lmax, hang, and snap. At Lmax, Snatch keeps trying to fly away. Animate strain. One Snatch holds one pawn.

Definition of Done:
- On touch during dive the pawn attaches to a hold socket.
- The grabbed pawn cannot walk and stays on the beam.
- Existing beam rules own length, pull, Lmax, hang, and snap.
- At Lmax, Snatch keeps trying to fly away and animates strain.
- One Snatch holds one pawn.', 'Code', 'Easy', 'Small', true, 40, null, '[{"id":"s1","label":"On touch during dive the pawn attaches to a hold socket.","done":false},{"id":"s2","label":"The grabbed pawn cannot walk and stays on the beam.","done":false},{"id":"s3","label":"Existing beam rules own length, pull, Lmax, hang, and snap.","done":false},{"id":"s4","label":"At Lmax, Snatch keeps trying to fly away and animates strain.","done":false},{"id":"s5","label":"One Snatch holds one pawn.","done":false}]'::jsonb),
    ('Tether-5.1.5', 'Tether-5.1', 'Tether-5.1.5 Drop targeting', 'If a tagged high place exists (ledge volume or drop marker), fly there and release. If none exists, fly up about 8 to 12m above the grab point and release. Release is a drop. Map helpers may place BP_SnatchDropMarker volumes.

Definition of Done:
- If a tagged high place exists, Snatch flies there and releases.
- If none exists, it flies up about 8 to 12m above the grab point and releases.
- Release is a drop.
- Map helpers may place BP_SnatchDropMarker volumes.', 'Code', 'Easy', 'Small', true, 50, null, '[{"id":"s1","label":"If a tagged high place exists, Snatch flies there and releases.","done":false},{"id":"s2","label":"If none exists, it flies up about 8 to 12m above the grab point and releases.","done":false},{"id":"s3","label":"Release is a drop.","done":false},{"id":"s4","label":"Map helpers may place BP_SnatchDropMarker volumes.","done":false}]'::jsonb),
    ('Tether-5.1.6', 'Tether-5.1', 'Tether-5.1.6 Health, stagger, drop on stagger', '1000 health, stagger every 100. Stagger always drops a held pawn. After lockout: Hunt if the body is not downed. Eat if a downed body exists and no one is hitting Snatch.

Definition of Done:
- Snatch has 1000 health and staggers every 100.
- Stagger always drops a held pawn.
- After lockout: Hunt if the body is not downed; Eat if a downed body exists and no one is hitting Snatch.', 'Code', 'Easy', 'Small', true, 60, null, '[{"id":"s1","label":"Snatch has 1000 health and staggers every 100.","done":false},{"id":"s2","label":"Stagger always drops a held pawn.","done":false},{"id":"s3","label":"After lockout: Hunt if the body is not downed; Eat if a downed body exists and no one is hitting Snatch.","done":false}]'::jsonb),
    ('Tether-5.1.7', 'Tether-5.1', 'Tether-5.1.7 Downed-from-drop', 'A Snatch drop from a marked high place or from the fly-up height puts that pawn in Downed. Downed cannot walk. Teammates can see the body. A flag and a pose are enough. Revive stays Open. Playtest reset or end session is allowed. Write the Open in Docs/Enemies.md.

Definition of Done:
- A drop from a marked high place or the fly-up height puts that pawn in Downed.
- Downed cannot walk and teammates can see the body.
- A flag and a pose are enough. Revive stays Open.
- The Open is written in Docs/Enemies.md.', 'Code', 'Easy', 'Small', true, 70, null, '[{"id":"s1","label":"A drop from a marked high place or the fly-up height puts that pawn in Downed.","done":false},{"id":"s2","label":"Downed cannot walk and teammates can see the body.","done":false},{"id":"s3","label":"A flag and a pose are enough. Revive stays Open.","done":false},{"id":"s4","label":"The Open is written in Docs/Enemies.md.","done":false}]'::jsonb),
    ('Tether-5.1.8', 'Tether-5.1', 'Tether-5.1.8 Eat loop', 'On a downing drop: cancel Hunt on everyone else, fly to the body, eat. Damaged during Eat: flee a short way, then return to the same body. Fought far from the body: Hunt the living crew until dead or left alone long enough to return to Eat. If the body is gone, Hunt.

Definition of Done:
- A downing drop cancels Hunt on everyone else; Snatch flies to the body and eats.
- Damaged during Eat: flee a short way, then return to the same body.
- Fought far from the body: Hunt the living crew until dead or left alone long enough to return to Eat.
- If the body is gone, Hunt.', 'Code', 'Easy', 'Small', true, 80, null, '[{"id":"s1","label":"A downing drop cancels Hunt on everyone else; Snatch flies to the body and eats.","done":false},{"id":"s2","label":"Damaged during Eat: flee a short way, then return to the same body.","done":false},{"id":"s3","label":"Fought far from the body: Hunt the living crew until dead or left alone long enough to return to Eat.","done":false},{"id":"s4","label":"If the body is gone, Hunt.","done":false}]'::jsonb),
    ('Tether-5.1.9', 'Tether-5.1', 'Tether-5.1.9 Death and cleanup', 'At 0 health: drop anything held, short death, despawn or graybox corpse.

Definition of Done:
- At 0 health Snatch drops anything held.
- A short death plays, then despawn or a graybox corpse.', 'Code', 'Easy', 'Small', true, 90, null, '[{"id":"s1","label":"At 0 health Snatch drops anything held.","done":false},{"id":"s2","label":"A short death plays, then despawn or a graybox corpse.","done":false}]'::jsonb),
    ('Tether-5.1.10', 'Tether-5.1', 'Tether-5.1.10 SnatchYard', 'Graybox yard: flat floor, one high ledge with a SnatchDropMarker, two spawn markers, room to stretch to Lmax. Content/Tether/Maps/Enemy_SnatchYard or a named sublevel on TetherPrototype.

Output: Content/Tether/Maps/Enemy_SnatchYard or a named sublevel on TetherPrototype.

Definition of Done:
- A graybox yard exists with a flat floor, one high ledge with a SnatchDropMarker, two spawn markers, and room to stretch to Lmax.
- It lives at Content/Tether/Maps/Enemy_SnatchYard or a named sublevel on TetherPrototype.', 'Level Design', 'Easy', 'Small', false, 100, null, '[{"id":"s1","label":"A graybox yard exists with a flat floor, one high ledge with a SnatchDropMarker, two spawn markers, and room to stretch to Lmax.","done":false},{"id":"s2","label":"It lives at Content/Tether/Maps/Enemy_SnatchYard or a named sublevel on TetherPrototype.","done":false}]'::jsonb),
    ('Tether-5.1.11', 'Tether-5.1', 'Tether-5.1.11 Concept and graybox art', '2 to 4 concept stills or a turnaround. Cite StyleLock. Hostile planet creature. Improved graybox with grab pose and eat pose. Hero mesh, materials, and anim set stay Blocked on CD.1. Do not put the hero mesh on this card as Ready work.

Definition of Done:
- 2 to 4 concept stills or a turnaround exist and cite StyleLock.
- Improved graybox has a grab pose and an eat pose.
- Hero mesh, materials, and anim set are not Ready work on this card; they stay Blocked on CD.1.', 'Art', 'Easy', 'Small', false, 110, null, '[{"id":"s1","label":"2 to 4 concept stills or a turnaround exist and cite StyleLock.","done":false},{"id":"s2","label":"Improved graybox has a grab pose and an eat pose.","done":false},{"id":"s3","label":"Hero mesh, materials, and anim set are not Ready work on this card; they stay Blocked on CD.1.","done":false}]'::jsonb),
    ('Tether-5.1.12', 'Tether-5.1', 'Tether-5.1.12 Placeholder audio and VFX', 'Cues: patrol wing, watch hiss, dive, grab, strain against the line, stagger, drop, eat, flee. Placeholder wav or MetaSound on at least watch, grab, stagger, and eat. Production mix stays Epic 12.

Definition of Done:
- Placeholder cues exist for patrol wing, watch hiss, dive, grab, strain, stagger, drop, eat, and flee.
- Placeholder wav or MetaSound covers at least watch, grab, stagger, and eat.
- Production mix stays Epic 12.', 'Audio', 'Easy', 'Small', false, 120, null, '[{"id":"s1","label":"Placeholder cues exist for patrol wing, watch hiss, dive, grab, strain, stagger, drop, eat, and flee.","done":false},{"id":"s2","label":"Placeholder wav or MetaSound covers at least watch, grab, stagger, and eat.","done":false},{"id":"s3","label":"Production mix stays Epic 12.","done":false}]'::jsonb),
    ('Tether-5.1.13', 'Tether-5.1', 'Tether-5.1.13 Snatch net replicate', 'Replicate job, health, held pawn, and transform. Follow Epic 10. Two-window listen server is enough. Two-machine stays deferred with 10.2.

Definition of Done:
- Job, health, held pawn, and transform replicate.
- Follows Epic 10. Two-window listen server is enough.
- Two-machine stays deferred with 10.2.', 'Code', 'Easy', 'Small', true, 130, null, '[{"id":"s1","label":"Job, health, held pawn, and transform replicate.","done":false},{"id":"s2","label":"Follows Epic 10. Two-window listen server is enough.","done":false},{"id":"s3","label":"Two-machine stays deferred with 10.2.","done":false}]'::jsonb),
    ('Tether-5.1.14', 'Tether-5.1', 'Tether-5.1.14 Snatch playtest', 'Two or more people. Docs/qa/EnemyNote.md. Must pass: watch readable, grab can miss, existing Lmax hold stops travel while Snatch keeps straining, stagger drops the held pawn, four people stagger it more than one person, eat starts only after a downing drop, hit-during-eat flees then returns, fight-away-from-body returns to Hunt. Medium 5.1 is Done only after this write-up.

Output: Docs/qa/EnemyNote.md write-up for Snatch.

Definition of Done:
- Playtest used two or more people and wrote Docs/qa/EnemyNote.md.
- Watch is readable and grab can miss.
- Existing Lmax hold stops travel while Snatch keeps straining.
- Stagger drops the held pawn; four people stagger it more than one person.
- Eat starts only after a downing drop; hit-during-eat flees then returns; fight-away-from-body returns to Hunt.
- Medium 5.1 is marked Done only after this write-up.', 'QA', 'Easy', 'Small', true, 140, null, '[{"id":"s1","label":"Playtest used two or more people and wrote Docs/qa/EnemyNote.md.","done":false},{"id":"s2","label":"Watch is readable and grab can miss.","done":false},{"id":"s3","label":"Existing Lmax hold stops travel while Snatch keeps straining.","done":false},{"id":"s4","label":"Stagger drops the held pawn; four people stagger it more than one person.","done":false},{"id":"s5","label":"Eat starts only after a downing drop; hit-during-eat flees then returns; fight-away-from-body returns to Hunt.","done":false},{"id":"s6","label":"Medium 5.1 is marked Done only after this write-up.","done":false}]'::jsonb),
    ('Tether-5.2', 'Tether-5', 'Tether-5.2 Latch', 'Fast closer. Runs at people, lunges, rides one pawn. Not the first enemy.

What it does:
Moves quickly and lunges. On grab it latches on and slows that player a lot. Bites and scratches until that player is dead. Then eats the body and ignores other players unless attacked. If left alone it keeps eating that body for the rest of the round.', 'Code', 'Medium', 'Medium', true, 20, null, '[]'::jsonb),
    ('Tether-5.2.1', 'Tether-5.2', 'Tether-5.2.1 Latch graybox', 'Low, clingy, readable on a pawn''s back or chest. Content/Tether/Enemies/Latch/.

Output: Content/Tether/Enemies/Latch/ graybox.

Definition of Done:
- Graybox is low, clingy, and readable on a pawn''s back or chest.
- Assets live under Content/Tether/Enemies/Latch/.', 'Art', 'Easy', 'Small', false, 10, null, '[{"id":"s1","label":"Graybox is low, clingy, and readable on a pawn''s back or chest.","done":false},{"id":"s2","label":"Assets live under Content/Tether/Enemies/Latch/.","done":false}]'::jsonb),
    ('Tether-5.2.2', 'Tether-5.2', 'Tether-5.2.2 Fast move and lunge', 'Fast ground move plus a lunge. Lunge can miss. Miss has a short recover.

Definition of Done:
- Latch has a fast ground move plus a lunge.
- Lunge can miss and miss has a short recover.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"Latch has a fast ground move plus a lunge.","done":false},{"id":"s2","label":"Lunge can miss and miss has a short recover.","done":false}]'::jsonb),
    ('Tether-5.2.3', 'Tether-5.2', 'Tether-5.2.3 Latch-on and slow', 'Significant slow on the ridden pawn. Pawn can still look and fire.

Definition of Done:
- The ridden pawn is significantly slowed.
- The pawn can still look and fire.', 'Code', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"The ridden pawn is significantly slowed.","done":false},{"id":"s2","label":"The pawn can still look and fire.","done":false}]'::jsonb),
    ('Tether-5.2.4', 'Tether-5.2', 'Tether-5.2.4 Bite and scratch', 'Small hits on a timer until the pawn is Downed. Write the tick in Docs/Enemies.md.

Definition of Done:
- Small hits land on a timer until the pawn is Downed.
- The tick is written in Docs/Enemies.md.', 'Code', 'Easy', 'Small', true, 40, null, '[{"id":"s1","label":"Small hits land on a timer until the pawn is Downed.","done":false},{"id":"s2","label":"The tick is written in Docs/Enemies.md.","done":false}]'::jsonb),
    ('Tether-5.2.5', 'Tether-5.2', 'Tether-5.2.5 Eat body', 'Eats for the rest of the round if left alone. Attacked while eating: fight the attacker, then return to the body if left alone again.

Definition of Done:
- If left alone, Latch eats for the rest of the round.
- Attacked while eating: fight the attacker, then return to the body if left alone again.', 'Code', 'Easy', 'Small', true, 50, null, '[{"id":"s1","label":"If left alone, Latch eats for the rest of the round.","done":false},{"id":"s2","label":"Attacked while eating: fight the attacker, then return to the body if left alone again.","done":false}]'::jsonb),
    ('Tether-5.2.6', 'Tether-5.2', 'Tether-5.2.6 Latch health', '400 health, stagger every 100. Stagger knocks it off the pawn.

Definition of Done:
- Latch has 400 health and staggers every 100.
- Stagger knocks it off the pawn.', 'Code', 'Easy', 'Small', true, 60, null, '[{"id":"s1","label":"Latch has 400 health and staggers every 100.","done":false},{"id":"s2","label":"Stagger knocks it off the pawn.","done":false}]'::jsonb),
    ('Tether-5.2.7', 'Tether-5.2', 'Tether-5.2.7 Latch concept and audio', 'Concept, graybox art, placeholder audio: scurry, lunge, latch, bite, eat. Hero mesh Blocked on CD.1.

Definition of Done:
- Concept and graybox art exist.
- Placeholder audio covers scurry, lunge, latch, bite, and eat.
- Hero mesh stays Blocked on CD.1.', 'Art', 'Easy', 'Small', false, 70, null, '[{"id":"s1","label":"Concept and graybox art exist.","done":false},{"id":"s2","label":"Placeholder audio covers scurry, lunge, latch, bite, and eat.","done":false},{"id":"s3","label":"Hero mesh stays Blocked on CD.1.","done":false}]'::jsonb),
    ('Tether-5.2.8', 'Tether-5.2', 'Tether-5.2.8 Latch QA', 'Slow is obvious. Solo peel is possible but ugly. Two people shooting it off is the clean answer. Eat lasts the round if ignored.

Definition of Done:
- Slow is obvious in playtest.
- Solo peel is possible but ugly; two people shooting it off is the clean answer.
- Eat lasts the round if ignored.', 'QA', 'Easy', 'Small', false, 80, null, '[{"id":"s1","label":"Slow is obvious in playtest.","done":false},{"id":"s2","label":"Solo peel is possible but ugly; two people shooting it off is the clean answer.","done":false},{"id":"s3","label":"Eat lasts the round if ignored.","done":false}]'::jsonb),
    ('Tether-5.3', 'Tether-5', 'Tether-5.3 Tick', 'Small swarm pests. Weak alone. Dangerous in a group. Eat the line and the shields first, then the person.

What it does:
Travel in groups. Hide in small pockets, cracks, under ledges, and surprise the crew. Crawl the beam and the players'' shields. Try to eat everything they touch. Each try does small damage. On a player who still has a shield, stay on that shield and keep chewing. On a player with no shield, stick and attack until the Tick is killed or that player is dead. When the player is dead, eat the body. Small and hard to hit. Once they have grabbed beam, shield, or body they crawl slowly while they attack.', 'Code', 'Medium', 'Medium', true, 30, null, '[]'::jsonb),
    ('Tether-5.3.1', 'Tether-5.3', 'Tether-5.3.1 Tick graybox', 'Small. Must read on the beam and on a pawn. Content/Tether/Enemies/Tick/.

Output: Content/Tether/Enemies/Tick/ graybox.

Definition of Done:
- Graybox is small and reads on the beam and on a pawn.
- Assets live under Content/Tether/Enemies/Tick/.', 'Art', 'Easy', 'Small', false, 10, null, '[{"id":"s1","label":"Graybox is small and reads on the beam and on a pawn.","done":false},{"id":"s2","label":"Assets live under Content/Tether/Enemies/Tick/.","done":false}]'::jsonb),
    ('Tether-5.3.2', 'Tether-5.3', 'Tether-5.3.2 Group spawn and hide', 'Nest marker drops several Ticks. Starting pack 4 to 8. Hide until the crew is close.

Definition of Done:
- A nest marker drops several Ticks.
- Starting pack is 4 to 8.
- They hide until the crew is close.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"A nest marker drops several Ticks.","done":false},{"id":"s2","label":"Starting pack is 4 to 8.","done":false},{"id":"s3","label":"They hide until the crew is close.","done":false}]'::jsonb),
    ('Tether-5.3.3', 'Tether-5.3', 'Tether-5.3.3 Surprise leave-cover', 'Short burst of speed out of the nest, then attach.

Definition of Done:
- Ticks leave cover with a short burst of speed, then attach.', 'Code', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"Ticks leave cover with a short burst of speed, then attach.","done":false}]'::jsonb),
    ('Tether-5.3.4', 'Tether-5.3', 'Tether-5.3.4 Crawl the beam', 'Small damage to beam health on a timer while attached to the line.

Definition of Done:
- While attached to the line, a Tick deals small beam-health damage on a timer.', 'Code', 'Easy', 'Small', true, 40, null, '[{"id":"s1","label":"While attached to the line, a Tick deals small beam-health damage on a timer.","done":false}]'::jsonb),
    ('Tether-5.3.5', 'Tether-5.3', 'Tether-5.3.5 Crawl a shield', 'Small damage to that pawn''s shield on a timer. Uses the shield field Epic 11 will own. Until 11.2 exists, a stand-in shield value on the pawn is enough and must use that same field.

Definition of Done:
- While on a shield, a Tick deals small damage to that pawn''s shield on a timer.
- Uses the shield field Epic 11 will own. Until 11.2 exists, a stand-in on that same field is enough.', 'Code', 'Easy', 'Small', true, 50, null, '[{"id":"s1","label":"While on a shield, a Tick deals small damage to that pawn''s shield on a timer.","done":false},{"id":"s2","label":"Uses the shield field Epic 11 will own. Until 11.2 exists, a stand-in on that same field is enough.","done":false}]'::jsonb),
    ('Tether-5.3.6', 'Tether-5.3', 'Tether-5.3.6 Stick to an unshielded pawn', 'Slow crawl on the body. Attack until the pawn is dead or the Tick dies.

Definition of Done:
- On an unshielded pawn the Tick slow-crawls the body.
- It attacks until the pawn is dead or the Tick dies.', 'Code', 'Easy', 'Small', true, 60, null, '[{"id":"s1","label":"On an unshielded pawn the Tick slow-crawls the body.","done":false},{"id":"s2","label":"It attacks until the pawn is dead or the Tick dies.","done":false}]'::jsonb),
    ('Tether-5.3.7', 'Tether-5.3', 'Tether-5.3.7 Tick eat body', 'After that pawn is Downed, eat the body. Ignore others unless attacked.

Definition of Done:
- After that pawn is Downed, the Tick eats the body.
- It ignores others unless attacked.', 'Code', 'Easy', 'Small', true, 70, null, '[{"id":"s1","label":"After that pawn is Downed, the Tick eats the body.","done":false},{"id":"s2","label":"It ignores others unless attacked.","done":false}]'::jsonb),
    ('Tether-5.3.8', 'Tether-5.3', 'Tether-5.3.8 Hard to hit', 'Small collision. Hip-fire on a moving Tick should miss often. Once latched, crawl is slow so the crew can peel them.

Definition of Done:
- Collision is small. Hip-fire on a moving Tick misses often.
- Once latched, crawl is slow so the crew can peel them.', 'Code', 'Easy', 'Small', true, 80, null, '[{"id":"s1","label":"Collision is small. Hip-fire on a moving Tick misses often.","done":false},{"id":"s2","label":"Once latched, crawl is slow so the crew can peel them.","done":false}]'::jsonb),
    ('Tether-5.3.9', 'Tether-5.3', 'Tether-5.3.9 Tick health', '80 to 120 health. One stagger knocks a Tick off beam, shield, or body.

Definition of Done:
- A Tick has 80 to 120 health.
- One stagger knocks it off beam, shield, or body.', 'Code', 'Easy', 'Small', true, 90, null, '[{"id":"s1","label":"A Tick has 80 to 120 health.","done":false},{"id":"s2","label":"One stagger knocks it off beam, shield, or body.","done":false}]'::jsonb),
    ('Tether-5.3.10', 'Tether-5.3', 'Tether-5.3.10 Nest dressing', 'Cracks, underside of a ledge, pipe mouth.

Definition of Done:
- Nest dressing exists: cracks, underside of a ledge, or a pipe mouth.', 'Level Design', 'Easy', 'Small', false, 100, null, '[{"id":"s1","label":"Nest dressing exists: cracks, underside of a ledge, or a pipe mouth.","done":false}]'::jsonb),
    ('Tether-5.3.11', 'Tether-5.3', 'Tether-5.3.11 Tick concept and audio', 'Concept, audio (skitter, chew, pack hiss), VFX on beam chew. Hero mesh Blocked on CD.1.

Definition of Done:
- Concept art exists.
- Placeholder audio covers skitter, chew, and pack hiss.
- VFX plays on beam chew.
- Hero mesh stays Blocked on CD.1.', 'Art', 'Easy', 'Small', false, 110, null, '[{"id":"s1","label":"Concept art exists.","done":false},{"id":"s2","label":"Placeholder audio covers skitter, chew, and pack hiss.","done":false},{"id":"s3","label":"VFX plays on beam chew.","done":false},{"id":"s4","label":"Hero mesh stays Blocked on CD.1.","done":false}]'::jsonb),
    ('Tether-5.3.12', 'Tether-5.3', 'Tether-5.3.12 Tick QA', 'One Tick is a nuisance. A group on the line is a problem. Unshielded stick is worse than shielded chew. Hard to hit until latched.

Definition of Done:
- One Tick is a nuisance; a group on the line is a problem.
- Unshielded stick is worse than shielded chew.
- Hard to hit until latched.', 'QA', 'Easy', 'Small', false, 120, null, '[{"id":"s1","label":"One Tick is a nuisance; a group on the line is a problem.","done":false},{"id":"s2","label":"Unshielded stick is worse than shielded chew.","done":false},{"id":"s3","label":"Hard to hit until latched.","done":false}]'::jsonb),
    ('Tether-5.4', 'Tether-5', 'Tether-5.4 Guard', 'Big slow eater. Finds the most valuable resource in its area and sits on it for most of the map. Leave the six Tether-4 cards unchanged. Give the node a value field on the Guard cards that touch it.

What it does:
Finds the most valuable resource in its area and slowly eats it. That item''s value drops while it is eaten, very slowly. If the players want that resource they have to fight. Moves slowly when going for food. Moves quickly when attacking. Charges in a straight line. Getting hit hurts a lot. If it keeps missing it spits stones or metal balls. Spit animation is predictable. Getting hit still hurts. Walks on walls and ceilings. A charge does not knock it off a ledge. Jump is slow and obvious: stand still, wait, then jump very high and fast to the destination. Only jumps to reach a hard place, in or out of combat.', 'Code', 'Medium', 'Medium', true, 40, null, '[]'::jsonb),
    ('Tether-5.4.1', 'Tether-5.4', 'Tether-5.4.1 Guard graybox', 'Big. Heavy. Must read on a wall and on a ceiling. Content/Tether/Enemies/Guard/.

Output: Content/Tether/Enemies/Guard/ graybox.

Definition of Done:
- Graybox is big, heavy, and reads on a wall and on a ceiling.
- Assets live under Content/Tether/Enemies/Guard/.', 'Art', 'Easy', 'Small', false, 10, null, '[{"id":"s1","label":"Graybox is big, heavy, and reads on a wall and on a ceiling.","done":false},{"id":"s2","label":"Assets live under Content/Tether/Enemies/Guard/.","done":false}]'::jsonb),
    ('Tether-5.4.2', 'Tether-5.4', 'Tether-5.4.2 Pick and eat the best node', 'Pick the highest-value ResourceNode in a radius. Walk to it slowly. Sit and eat.

Definition of Done:
- Guard picks the highest-value ResourceNode in a radius.
- It walks there slowly, then sits and eats.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"Guard picks the highest-value ResourceNode in a radius.","done":false},{"id":"s2","label":"It walks there slowly, then sits and eats.","done":false}]'::jsonb),
    ('Tether-5.4.3', 'Tether-5.4', 'Tether-5.4.3 Node value drain', 'Give the node a value field. Drain is slow. A full eat should take most of a map-length stay. Warping a carried item is unchanged. Eating a node still in the world lowers what it is worth when picked up. Do not rewrite the six Tether-4 cards for this field.

Definition of Done:
- The node has a value field added from this Guard card, not by rewriting Tether-4.
- Drain is slow; a full eat takes most of a map-length stay.
- Warping a carried item is unchanged.
- Eating a node still in the world lowers what it is worth when picked up.', 'Code', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"The node has a value field added from this Guard card, not by rewriting Tether-4.","done":false},{"id":"s2","label":"Drain is slow; a full eat takes most of a map-length stay.","done":false},{"id":"s3","label":"Warping a carried item is unchanged.","done":false},{"id":"s4","label":"Eating a node still in the world lowers what it is worth when picked up.","done":false}]'::jsonb),
    ('Tether-5.4.4', 'Tether-5.4', 'Tether-5.4.4 Aggro on contest', 'Aggro when the crew contests the node or hits the Guard.

Definition of Done:
- Guard aggros when the crew contests the node or hits the Guard.', 'Code', 'Easy', 'Small', true, 40, null, '[{"id":"s1","label":"Guard aggros when the crew contests the node or hits the Guard.","done":false}]'::jsonb),
    ('Tether-5.4.5', 'Tether-5.4', 'Tether-5.4.5 Straight charge', 'Fast straight charge. High damage. Miss recovery is readable.

Definition of Done:
- Guard has a fast straight charge with high damage.
- Miss recovery is readable.', 'Code', 'Easy', 'Small', true, 50, null, '[{"id":"s1","label":"Guard has a fast straight charge with high damage.","done":false},{"id":"s2","label":"Miss recovery is readable.","done":false}]'::jsonb),
    ('Tether-5.4.6', 'Tether-5.4', 'Tether-5.4.6 Spit after misses', 'Spit stones or metal after a documented number of missed charges. Predictable wind-up. High damage.

Definition of Done:
- After a documented number of missed charges, Guard spits stones or metal.
- Wind-up is predictable. Damage is high.', 'Code', 'Easy', 'Small', true, 60, null, '[{"id":"s1","label":"After a documented number of missed charges, Guard spits stones or metal.","done":false},{"id":"s2","label":"Wind-up is predictable. Damage is high.","done":false}]'::jsonb),
    ('Tether-5.4.7', 'Tether-5.4', 'Tether-5.4.7 Wall and ceiling walk', 'Charge along those surfaces stays on the surface.

Definition of Done:
- A charge along a wall or ceiling stays on that surface.', 'Code', 'Easy', 'Small', true, 70, null, '[{"id":"s1","label":"A charge along a wall or ceiling stays on that surface.","done":false}]'::jsonb),
    ('Tether-5.4.8', 'Tether-5.4', 'Tether-5.4.8 Tell jump', 'Stand, delay, then a high fast jump to a hard-to-reach point. Used to reach food and to reach the crew.

Definition of Done:
- Jump tell is stand, delay, then a high fast jump.
- Used to reach food and to reach the crew.', 'Code', 'Easy', 'Small', true, 80, null, '[{"id":"s1","label":"Jump tell is stand, delay, then a high fast jump.","done":false},{"id":"s2","label":"Used to reach food and to reach the crew.","done":false}]'::jsonb),
    ('Tether-5.4.9', 'Tether-5.4', 'Tether-5.4.9 Guard health', '800 health, stagger every 200. Stagger interrupts a charge, a spit, and a jump tell.

Definition of Done:
- Guard has 800 health and staggers every 200.
- Stagger interrupts a charge, a spit, and a jump tell.', 'Code', 'Easy', 'Small', true, 90, null, '[{"id":"s1","label":"Guard has 800 health and staggers every 200.","done":false},{"id":"s2","label":"Stagger interrupts a charge, a spit, and a jump tell.","done":false}]'::jsonb),
    ('Tether-5.4.10', 'Tether-5.4', 'Tether-5.4.10 Guard on the six-node map', 'Place at least one Guard on the six-node test map from 4.1.3. That node has the highest value. Other nodes stay clean so Epic 4 still plays without a fight.

Definition of Done:
- At least one Guard is on the six-node test map from 4.1.3.
- That node has the highest value.
- Other nodes stay clean so Epic 4 still plays without a fight.', 'Level Design', 'Easy', 'Small', false, 100, null, '[{"id":"s1","label":"At least one Guard is on the six-node test map from 4.1.3.","done":false},{"id":"s2","label":"That node has the highest value.","done":false},{"id":"s3","label":"Other nodes stay clean so Epic 4 still plays without a fight.","done":false}]'::jsonb),
    ('Tether-5.4.11', 'Tether-5.4', 'Tether-5.4.11 Guard concept and audio', 'Concept, audio (idle chew, charge roar, spit, jump tell), floor-to-wall transition. Hero mesh Blocked on CD.1.

Definition of Done:
- Concept art exists.
- Placeholder audio covers idle chew, charge roar, spit, and jump tell.
- Floor-to-wall transition reads.
- Hero mesh stays Blocked on CD.1.', 'Art', 'Easy', 'Small', false, 110, null, '[{"id":"s1","label":"Concept art exists.","done":false},{"id":"s2","label":"Placeholder audio covers idle chew, charge roar, spit, and jump tell.","done":false},{"id":"s3","label":"Floor-to-wall transition reads.","done":false},{"id":"s4","label":"Hero mesh stays Blocked on CD.1.","done":false}]'::jsonb),
    ('Tether-5.4.12', 'Tether-5.4', 'Tether-5.4.12 Guard QA', 'Value drops while ignored. Charge hurts. Spit is readable. Wall walk holds. Jump tell is obvious. Slow on food, fast on fight.

Definition of Done:
- Value drops while ignored.
- Charge hurts. Spit is readable. Wall walk holds. Jump tell is obvious.
- Slow on food, fast on fight.', 'QA', 'Easy', 'Small', false, 120, null, '[{"id":"s1","label":"Value drops while ignored.","done":false},{"id":"s2","label":"Charge hurts. Spit is readable. Wall walk holds. Jump tell is obvious.","done":false},{"id":"s3","label":"Slow on food, fast on fight.","done":false}]'::jsonb),
    ('Tether-5.5', 'Tether-5', 'Tether-5.5 Spore', 'Natural trap. Hard to see. Walking onto it snares one player. Vines whip that player until they die. The body stays wrapped until the Spore dies.

What it does:
Hard to spot. When walked on, snares a player. A snared player gets whipped by vines until they die. A dead player is wrapped in vines until someone kills the Spore. The trapped player can use a weapon to attack the Spore. One or two players attacking the Spore is slower to kill it than the Spore is to break that player''s shields. Three or four on the core is the clean answer. Write the numbers so that rule holds.', 'Code', 'Medium', 'Medium', true, 50, null, '[]'::jsonb),
    ('Tether-5.5.1', 'Tether-5.5', 'Tether-5.5.1 Spore graybox', 'Core plus low foliage that reads late. Content/Tether/Enemies/Spore/.

Output: Content/Tether/Enemies/Spore/ graybox.

Definition of Done:
- Graybox is a core plus low foliage that reads late.
- Assets live under Content/Tether/Enemies/Spore/.', 'Art', 'Easy', 'Small', false, 10, null, '[{"id":"s1","label":"Graybox is a core plus low foliage that reads late.","done":false},{"id":"s2","label":"Assets live under Content/Tether/Enemies/Spore/.","done":false}]'::jsonb),
    ('Tether-5.5.2', 'Tether-5.5', 'Tether-5.5.2 Snare volume', 'One pawn at a time in this slice. Snared pawn cannot walk.

Definition of Done:
- One pawn at a time can be snared in this slice.
- The snared pawn cannot walk.', 'Code', 'Easy', 'Small', true, 20, null, '[{"id":"s1","label":"One pawn at a time can be snared in this slice.","done":false},{"id":"s2","label":"The snared pawn cannot walk.","done":false}]'::jsonb),
    ('Tether-5.5.3', 'Tether-5.5', 'Tether-5.5.3 Vine whip', 'Whip the snared pawn. Shield first, then the pawn. Same shield field as Ticks.

Definition of Done:
- Vines whip the snared pawn.
- Damage hits shield first, then the pawn, using the same shield field as Ticks.', 'Code', 'Easy', 'Small', true, 30, null, '[{"id":"s1","label":"Vines whip the snared pawn.","done":false},{"id":"s2","label":"Damage hits shield first, then the pawn, using the same shield field as Ticks.","done":false}]'::jsonb),
    ('Tether-5.5.4', 'Tether-5.5', 'Tether-5.5.4 Shield race numbers', '1 to 2 players on the core lose the race against shield break. 3 to 4 win it. Curve in Docs/Enemies.md. Shield numbers in Docs/Tools.md.

Definition of Done:
- 1 to 2 players on the core lose the race against shield break. 3 to 4 win it.
- Curve is written in Docs/Enemies.md. Shield numbers stay in Docs/Tools.md.', 'Code', 'Easy', 'Small', true, 40, null, '[{"id":"s1","label":"1 to 2 players on the core lose the race against shield break. 3 to 4 win it.","done":false},{"id":"s2","label":"Curve is written in Docs/Enemies.md. Shield numbers stay in Docs/Tools.md.","done":false}]'::jsonb),
    ('Tether-5.5.5', 'Tether-5.5', 'Tether-5.5.5 Snared player can fire', 'Snared pawn may fire Hand Spark at the core. That shot counts in the 1 to 2 vs 3 to 4 race.

Definition of Done:
- A snared pawn may fire Hand Spark at the core.
- That shot counts in the 1 to 2 vs 3 to 4 race.', 'Code', 'Easy', 'Small', true, 50, null, '[{"id":"s1","label":"A snared pawn may fire Hand Spark at the core.","done":false},{"id":"s2","label":"That shot counts in the 1 to 2 vs 3 to 4 race.","done":false}]'::jsonb),
    ('Tether-5.5.6', 'Tether-5.5', 'Tether-5.5.6 Wrap the body', 'On Downed, wrap the body in vines until the Spore dies.

Definition of Done:
- On Downed, the body is wrapped in vines until the Spore dies.', 'Code', 'Easy', 'Small', true, 60, null, '[{"id":"s1","label":"On Downed, the body is wrapped in vines until the Spore dies.","done":false}]'::jsonb),
    ('Tether-5.5.7', 'Tether-5.5', 'Tether-5.5.7 Spore health', '500 health. Stagger pauses the whip for the shared lockout.

Definition of Done:
- Spore has 500 health.
- Stagger pauses the whip for the shared lockout.', 'Code', 'Easy', 'Small', true, 70, null, '[{"id":"s1","label":"Spore has 500 health.","done":false},{"id":"s2","label":"Stagger pauses the whip for the shared lockout.","done":false}]'::jsonb),
    ('Tether-5.5.8', 'Tether-5.5', 'Tether-5.5.8 Spore placement', 'Place spores on routes people actually walk. Leave at least one clean path.

Definition of Done:
- Spores sit on routes people actually walk.
- At least one clean path remains.', 'Level Design', 'Easy', 'Small', false, 80, null, '[{"id":"s1","label":"Spores sit on routes people actually walk.","done":false},{"id":"s2","label":"At least one clean path remains.","done":false}]'::jsonb),
    ('Tether-5.5.9', 'Tether-5.5', 'Tether-5.5.9 Spore concept and audio', 'Concept, audio (quiet idle, snare snap, whip, wrap), hard-to-spot art brief. Hero mesh Blocked on CD.1.

Definition of Done:
- Concept art and a hard-to-spot art brief exist.
- Placeholder audio covers quiet idle, snare snap, whip, and wrap.
- Hero mesh stays Blocked on CD.1.', 'Art', 'Easy', 'Small', false, 90, null, '[{"id":"s1","label":"Concept art and a hard-to-spot art brief exist.","done":false},{"id":"s2","label":"Placeholder audio covers quiet idle, snare snap, whip, and wrap.","done":false},{"id":"s3","label":"Hero mesh stays Blocked on CD.1.","done":false}]'::jsonb),
    ('Tether-5.5.10', 'Tether-5.5', 'Tether-5.5.10 Spore QA', 'Spotting is late. Snare is obvious once it hits. 1 to 2 lose the shield race. 3 to 4 win. Wrapped body frees when the Spore dies.

Definition of Done:
- Spotting is late. Snare is obvious once it hits.
- 1 to 2 lose the shield race. 3 to 4 win.
- Wrapped body frees when the Spore dies.', 'QA', 'Easy', 'Small', false, 100, null, '[{"id":"s1","label":"Spotting is late. Snare is obvious once it hits.","done":false},{"id":"s2","label":"1 to 2 lose the shield race. 3 to 4 win.","done":false},{"id":"s3","label":"Wrapped body frees when the Spore dies.","done":false}]'::jsonb);

  -- Parents before children: epics, then mediums, then smalls.
  for v_row in
    select *
    from tmp_tether_v011
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
        v_row.estimated_effort, 'ToDo', v_row.subtasks, v_row.staff_only, 'staging', v_row.sort_order
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

  -- Archive leftover staging cards that share an ID but are not the upserted title
  -- (old Latch-as-first-enemy / First utility enemy twins).
  with keep as (
    select src.code, src.title,
      (
        select t.id
        from public.tasks t
        where t.project_id = v_project
          and t.board_scope = 'staging'
          and (
            t.title = src.title
            or (
              t.title like src.code || ' %'
              and t.title not like src.code || '.%'
            )
          )
        order by t.archived_at nulls first, t.created_at
        limit 1
      ) as keep_id
    from tmp_tether_v011 src
  ),
  extras as (
    select distinct t.id
    from public.tasks t
    join keep k
      on t.title = k.title
      or (
        t.title like k.code || ' %'
        and t.title not like k.code || '.%'
      )
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and t.id is distinct from k.keep_id
      and t.archived_at is null
  )
  update public.tasks t
  set archived_at = now()
  from extras e
  where t.id = e.id
    and t.board_scope = 'staging';

  get diagnostics v_archived_dupes = row_count;

  -- Tether-5 does not block Tether-4 or Tether-6. Tether-4/6 do not block Tether-5.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and b.project_id = v_project
    and a.board_scope = 'staging'
    and b.board_scope = 'staging'
    and (
      (a.title ~ '^Tether-5([. ]|$)' and b.title ~ '^Tether-4([. ]|$)')
      or (a.title ~ '^Tether-4([. ]|$)' and b.title ~ '^Tether-5([. ]|$)')
      or (a.title ~ '^Tether-5([. ]|$)' and b.title ~ '^Tether-6([. ]|$)')
      or (a.title ~ '^Tether-6([. ]|$)' and b.title ~ '^Tether-5([. ]|$)')
    );

  raise notice 'Tether v0.11 staging upsert created=% updated=% archived_dupes=%',
    v_created, v_updated, v_archived_dupes;

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
