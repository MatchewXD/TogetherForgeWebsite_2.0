-- Tether staging First Spark / spine upsert (production).
-- Upserts by title (Tether-N …). Does not insert Epic 1 or Epic 2.
-- Does not recreate P.1, P.2.3, P.3.1, or P.4.
-- Unarchives Tether-10 on staging if it was archived after publish.
-- Safe to re-run.

do $$
declare
  v_project uuid;
  r record;
  v_id uuid;
  v_parent uuid;
  v_blocker uuid;
  v_new boolean;
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

  create temporary table if not exists tmp_tether_spark (
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
    subtasks jsonb not null default '[]'::jsonb,
    status text not null,
    unarchive boolean not null default false
  ) on commit drop;

  delete from tmp_tether_spark;

  insert into tmp_tether_spark (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_code, subtasks,
    status, unarchive
  ) values
    ('Tether-P', null, 'Tether-P First Spark', 'Public First Spark lane: docs, art exploration, and QA. Claimable Smalls are Ready. Networking stays Tether-10.', 'Art', 'Easy', 'First Spark', false, 15, null, '[]'::jsonb, 'ToDo', false),
    ('Tether-P.2', 'Tether-P', 'Tether-P.2 Art exploration', 'Art exploration for player, beam, resources, enemies, and kit. Not final production art. StyleLock.md is Draft. Cite Docs/Vision.md and Docs/StyleLock.md.', 'Art', 'Easy', 'First Spark', false, 10, null, '[]'::jsonb, 'ToDo', false),
    ('Tether-P.2.1', 'Tether-P.2', 'Tether-P.2.1 Player stand-in silhouettes', 'Three readable silhouette thumbnails for a suited colony crew stand-in. Do not model a final character. Do not change the prototype mesh unless staff ask. Cite Docs/StyleLock.md.

Output: Docs/art-explorations/player/ plus a short note saying which silhouette reads at a distance.

Definition of Done:
- Three readable silhouette thumbnails exist in Docs/art-explorations/player/.
- A short note says which silhouette reads at a distance.', 'Art', 'Easy', 'First Spark', false, 10, null, '[{"id":"s1","label":"Three readable silhouette thumbnails exist in Docs/art-explorations/player/.","done":false},{"id":"s2","label":"A short note says which silhouette reads at a distance.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-P.2.2', 'Tether-P.2', 'Tether-P.2.2 Tether visual directions', 'Three stills or overlays of the shared energy beam at Low vs High tension. Stay a beam between bodies. Cite Docs/StyleLock.md and Docs/TetherRules.txt.

Output: Docs/art-explorations/tether/.

Definition of Done:
- Three stills or overlays of Low vs High tension exist in Docs/art-explorations/tether/.
- The tether stays a beam between bodies, not a physical cable.', 'Art', 'Easy', 'First Spark', false, 20, null, '[{"id":"s1","label":"Three stills or overlays of Low vs High tension exist in Docs/art-explorations/tether/.","done":false},{"id":"s2","label":"The tether stays a beam between bodies, not a physical cable.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-P.2.4', 'Tether-P.2', 'Tether-P.2.4 Resource node reads', 'Three stills of a handheld colony resource that reads in a glove. No final mesh. Cite Docs/StyleLock.md.

Output: Docs/art-explorations/resources/.

Definition of Done:
- Three stills of a handheld colony resource exist in Docs/art-explorations/resources/.
- The object reads in a glove.
- No final mesh.', 'Art', 'Easy', 'First Spark', false, 40, null, '[{"id":"s1","label":"Three stills of a handheld colony resource exist in Docs/art-explorations/resources/.","done":false},{"id":"s2","label":"The object reads in a glove.","done":false},{"id":"s3","label":"No final mesh.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-P.2.5', 'Tether-P.2', 'Tether-P.2.5 Latch enemy silhouettes', 'Three silhouettes of a creature that grabs a person or the beam. Not a health-bar boss. Cite Docs/Vision.md and Docs/StyleLock.md.

Output: Docs/art-explorations/enemies/.

Definition of Done:
- Three silhouettes exist in Docs/art-explorations/enemies/.
- The creature reads as grabbing a person or the beam.
- Not a health-bar boss.', 'Art', 'Easy', 'First Spark', false, 50, null, '[{"id":"s1","label":"Three silhouettes exist in Docs/art-explorations/enemies/.","done":false},{"id":"s2","label":"The creature reads as grabbing a person or the beam.","done":false},{"id":"s3","label":"Not a health-bar boss.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-P.2.6', 'Tether-P.2', 'Tether-P.2.6 Modular kit thumbnails', 'Thumbs for floor tile, short ledge, ramp, and airlock lip at 200 cm tile. Cite Docs/StyleLock.md. Do not block out Level_01_Surface on this card.

Output: Docs/art-explorations/kit/.

Definition of Done:
- Thumbnails exist in Docs/art-explorations/kit/ for floor tile, short ledge, ramp, and airlock lip.
- Scale is 200 cm tile.
- This card does not block out Level_01_Surface.', 'Art', 'Easy', 'First Spark', false, 60, null, '[{"id":"s1","label":"Thumbnails exist in Docs/art-explorations/kit/ for floor tile, short ledge, ramp, and airlock lip.","done":false},{"id":"s2","label":"Scale is 200 cm tile.","done":false},{"id":"s3","label":"This card does not block out Level_01_Surface.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-P.3', 'Tether-P', 'Tether-P.3 QA templates', 'Templates for the first beam playtests. Staff Only.', 'QA', 'Easy', 'First Spark', true, 20, null, '[]'::jsonb, 'Completed', false),
    ('Tether-P.3.2', 'Tether-P.3', 'Tether-P.3.2 Playtest note template', 'Write Docs/qa/PlaytestNote.md with fields: date, build, testers, what felt good, what broke, recommended task change (not a new feature).

Output: Docs/qa/PlaytestNote.md.

Definition of Done:
- Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).', 'QA', 'Easy', 'First Spark', true, 20, null, '[{"id":"s1","label":"Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).","done":true}]'::jsonb, 'Completed', false),
    ('Tether-3', null, 'Tether-3 Tether-aware movement', 'Tether-aware movement. Epic 2 playtest is treated as passed. Community claims Tether-3.1. Staff retune pull on Tether-3.2.', 'Code', 'Medium', 'Medium', false, 30, null, '[]'::jsonb, 'ToDo', false),
    ('Tether-3.1', 'Tether-3', 'Tether-3.1 Core locomotion and camera', 'Walk, run, jump, ground detect, keyboard and gamepad. Document speeds in Docs/ or TetherRules.txt. Camera is Open: third-person that keeps both pawns readable, or first-person plus a tether cue. Write the choice in Docs/Camera.md. Cite Docs/TetherRules.txt. Do not retune pull, L100, or Tether Health.

Output: Docs/Camera.md plus documented walk/run/jump speeds.

Definition of Done:
- Walk, run, jump, and ground detect work on keyboard and gamepad.
- Speeds are documented in Docs/ or TetherRules.txt.
- Camera choice is written in Docs/Camera.md.
- This card does not retune pull, L100, or Tether Health.', 'Code', 'Medium', 'Medium', false, 10, null, '[{"id":"s1","label":"Walk, run, jump, and ground detect work on keyboard and gamepad.","done":false},{"id":"s2","label":"Speeds are documented in Docs/ or TetherRules.txt.","done":false},{"id":"s3","label":"Camera choice is written in Docs/Camera.md.","done":false},{"id":"s4","label":"This card does not retune pull, L100, or Tether Health.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-3.2', 'Tether-3', 'Tether-3.2 Pull/resist and failure-mode tests', 'Staff retune pull toward partner and optional resist. Community must not retune pull. Failure-mode playtest is Tether-3.2.1.', 'Code', 'Medium', 'Medium', true, 20, null, '[]'::jsonb, 'ToDo', false),
    ('Tether-3.2.1', 'Tether-3.2', 'Tether-3.2.1 Failure-mode playtest', 'Playtest failure modes. Do not change TetherRules numbers on this card.

Output: Dated Docs/qa/PlaytestNote.

Definition of Done:
- A dated Docs/qa/PlaytestNote exists.
- Tested: one falls off a ledge.
- Tested: both jump.
- Tested: one sprints / one stands.
- TetherRules numbers were not changed on this card.

Blocker: Waiting on staff pull/resist work on Tether-3.2.', 'QA', 'Easy', 'Small', false, 10, 'Tether-3.2', '[{"id":"s1","label":"A dated Docs/qa/PlaytestNote exists.","done":false},{"id":"s2","label":"Tested: one falls off a ledge.","done":false},{"id":"s3","label":"Tested: both jump.","done":false},{"id":"s4","label":"Tested: one sprints / one stands.","done":false},{"id":"s5","label":"TetherRules numbers were not changed on this card.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-4', null, 'Tether-4 Resources and warp', 'Resources and warp.

Blocker: Waiting on Tether-3.1 Core locomotion and camera.', 'Code', 'Medium', 'Medium', false, 40, 'Tether-3.1', '[]'::jsonb, 'ToDo', false),
    ('Tether-4.1', 'Tether-4', 'Tether-4.1 ResourceNode and carry limit', 'ResourceNode prefab, interact volume, carry limit 1 or 2, deliberate drop. Place at least six nodes in the prototype or a test map.

Definition of Done:
- ResourceNode prefab exists with an interact volume.
- Carry limit is 1 or 2 with a deliberate drop.
- At least six nodes are placed in the prototype or a test map.

Blocker: Waiting on Tether-3.1 Core locomotion and camera.', 'Code', 'Medium', 'Medium', false, 10, 'Tether-3.1', '[{"id":"s1","label":"ResourceNode prefab exists with an interact volume.","done":false},{"id":"s2","label":"Carry limit is 1 or 2 with a deliberate drop.","done":false},{"id":"s3","label":"At least six nodes are placed in the prototype or a test map.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-4.2', 'Tether-4', 'Tether-4.2 Checkpoint warp and session total', 'Checkpoint warp and session total.

Output: Done at collect → carry → warp → total updates.

Definition of Done:
- Collect → carry → warp → session total updates in one loop.

Blocker: Waiting on Tether-4.1 ResourceNode and carry limit.', 'Code', 'Medium', 'Medium', false, 20, 'Tether-4.1', '[{"id":"s1","label":"Collect → carry → warp → session total updates in one loop.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-5', null, 'Tether-5 Enemies that stress the tether', 'Enemies that stress the tether. Threats whose job is coordination, not a DPS sponge.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.', 'Code', 'Medium', 'Medium', false, 50, 'Tether-4.2', '[]'::jsonb, 'ToDo', false),
    ('Tether-5.1', 'Tether-5', 'Tether-5.1 Latch enemy', 'Latch enemy moves toward a pawn or the tether midpoint, attaches, applies a documented penalty (extra tension, slow, or drain), and shows a clear attached state. Removal is faster when both players use Energy Pulse inside a short window (pair-remove). Playtest with two people and confirm the pair advantage is obvious.

Definition of Done:
- Latch enemy attaches to a pawn or the tether midpoint with a clear attached state.
- A documented penalty applies while attached.
- Energy Pulse pair-remove is faster when both players use it in a short window.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.', 'Code', 'Medium', 'Medium', false, 10, 'Tether-4.2', '[{"id":"s1","label":"Latch enemy attaches to a pawn or the tether midpoint with a clear attached state.","done":false},{"id":"s2","label":"A documented penalty applies while attached.","done":false},{"id":"s3","label":"Energy Pulse pair-remove is faster when both players use it in a short window.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-6', null, 'Tether-6 First playable surface level', 'First playable surface level.

Blocker: Waiting on Tether-5.1 Latch enemy.', 'Level Design', 'Medium', 'Medium', false, 60, 'Tether-5.1', '[]'::jsonb, 'ToDo', false),
    ('Tether-6.1', 'Tether-6', 'Tether-6.1 Modular graybox kit plus Level_01_Surface', 'Parent for kit pieces and Level_01_Surface blockout. Claim the Smalls.

Blocker: Waiting on Tether-5.1 Latch enemy.', 'Level Design', 'Medium', 'Medium', false, 10, 'Tether-5.1', '[]'::jsonb, 'ToDo', false),
    ('Tether-6.1.1', 'Tether-6.1', 'Tether-6.1.1 Five modular graybox pieces', 'Five modular graybox pieces in Content/Tether/Modular.

Output: Content/Tether/Modular with at least five graybox pieces.

Definition of Done:
- At least five modular graybox pieces exist in Content/Tether/Modular.

Blocker: Waiting on Tether-5.1 Latch enemy.', 'Level Design', 'Easy', 'Small', false, 10, 'Tether-5.1', '[{"id":"s1","label":"At least five modular graybox pieces exist in Content/Tether/Modular.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-6.1.2', 'Tether-6.1', 'Tether-6.1.2 Block out Level_01_Surface', 'Block out Content/Tether/Maps/Level_01_Surface: start, two traversal sections, resources, one or two enemy points, end checkpoint.

Output: Content/Tether/Maps/Level_01_Surface.

Definition of Done:
- Level_01_Surface has a start, two traversal sections, resources, one or two enemy points, and an end checkpoint.

Blocker: Waiting on Tether-6.1.1 Five modular graybox pieces.', 'Level Design', 'Easy', 'Small', false, 20, 'Tether-6.1.1', '[{"id":"s1","label":"Level_01_Surface has a start, two traversal sections, resources, one or two enemy points, and an end checkpoint.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-6.2', 'Tether-6', 'Tether-6.2 End-to-end 1-4 player loop', 'Recorded 1-4 player loop. Two-window listen server is enough until Tether-10.2 exists. Solo behavior and 3-4 tether topology stay Open.

Definition of Done:
- A recorded successful 1-4 player run exists.
- Two-window listen server is enough until Tether-10.2 exists.

Blocker: Waiting on Tether-6.1.2 Block out Level_01_Surface.', 'QA', 'Medium', 'Medium', false, 20, 'Tether-6.1.2', '[{"id":"s1","label":"A recorded successful 1-4 player run exists.","done":false},{"id":"s2","label":"Two-window listen server is enough until Tether-10.2 exists.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-7', null, 'Tether-7 Tools, upgrades, between-level flow', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Code', 'Medium', 'Medium', false, 70, 'Tether-6', '[]'::jsonb, 'ToDo', false),
    ('Tether-7.1', 'Tether-7', 'Tether-7.1 Upgrade screen', 'Parked chapter card: upgrade screen. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Design', 'Medium', 'Medium', false, 10, 'Tether-6', '[]'::jsonb, 'ToDo', false),
    ('Tether-7.2', 'Tether-7', 'Tether-7.2 First upgrades', 'Parked chapter card: first upgrades — max distance, Anchor, Shared Reinforcer. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Code', 'Medium', 'Medium', false, 20, 'Tether-6', '[]'::jsonb, 'ToDo', false),
    ('Tether-8', null, 'Tether-8 Final station sequence', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Level Design', 'Medium', 'Medium', false, 80, 'Tether-6', '[]'::jsonb, 'ToDo', false),
    ('Tether-8.1', 'Tether-8', 'Tether-8.1 Station blockout', 'Parked chapter card: station blockout. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Level Design', 'Medium', 'Medium', false, 10, 'Tether-6', '[]'::jsonb, 'ToDo', false),
    ('Tether-8.2', 'Tether-8', 'Tether-8.2 Creature drive-off', 'Parked chapter card: creature drive-off. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Code', 'Medium', 'Medium', false, 20, 'Tether-6', '[]'::jsonb, 'ToDo', false),
    ('Tether-9', null, 'Tether-9 Art pipeline', 'Art pipeline. Style lock approval is Staff Only. First Spark exploration on Tether-P.2 can proceed while StyleLock.md is Draft.', 'Art', 'Medium', 'Medium', true, 90, null, '[]'::jsonb, 'ToDo', false),
    ('Tether-9.1', 'Tether-9', 'Tether-9.1 Style lock approval', 'Staff approve StyleLock.md (palette, silhouettes, materials). StyleLock.md stays Draft until staff accept.

Output: Docs/StyleLock.md accepted by staff.

Definition of Done:
- Staff accept Docs/StyleLock.md.
- Until then StyleLock.md stays Draft.', 'Art', 'Medium', 'Medium', true, 10, null, '[{"id":"s1","label":"Staff accept Docs/StyleLock.md.","done":false},{"id":"s2","label":"Until then StyleLock.md stays Draft.","done":false}]'::jsonb, 'ToDo', false),
    ('Tether-9.2', 'Tether-9', 'Tether-9.2 Core final assets', 'Core final assets.

Blocker: Style lock not approved.', 'Art', 'Medium', 'Medium', false, 20, 'Tether-9.1', '[]'::jsonb, 'ToDo', false),
    ('Tether-10', null, 'Tether-10 Networking foundation', 'Networking foundation. Staff Only. Not claimable.

Founder-owned. Default candidate: Iris on UE 5.8.', 'Code', 'Medium', 'Medium', true, 100, null, '[]'::jsonb, 'ToDo', true),
    ('Tether-10.1', 'Tether-10', 'Tether-10.1 Core netcode', 'Two-window pawn + beam sync. Do not require two machines. Default candidate: Iris on UE 5.8.

Founder-owned. Staff Only Done.', 'Code', 'Medium', 'Medium', true, 10, null, '[]'::jsonb, 'Completed', true),
    ('Tether-10.2', 'Tether-10', 'Tether-10.2 Two-machine test on TetherPrototype', 'Two-machine test on TetherPrototype. Deferred.

Blocker: Two-machine test deferred.

Founder-owned.', 'Code', 'Medium', 'Medium', true, 20, null, '[]'::jsonb, 'ToDo', true),
    ('Tether-11', null, 'Tether-11 UI', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Design', 'Medium', 'Medium', false, 110, 'Tether-6', '[]'::jsonb, 'ToDo', false),
    ('Tether-12', null, 'Tether-12 Audio', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'Audio', 'Medium', 'Medium', false, 120, 'Tether-6', '[]'::jsonb, 'ToDo', false),
    ('Tether-13', null, 'Tether-13 Playtesting and polish', 'Parked chapter. Do not invent extra Smalls.

Blocker: Parked until Epic 6 is playtested.', 'QA', 'Medium', 'Medium', false, 130, 'Tether-6', '[]'::jsonb, 'ToDo', false);

  create temporary table if not exists tmp_tether_spark_applied (
    code text primary key,
    task_id uuid not null,
    is_new boolean not null
  ) on commit drop;

  delete from tmp_tether_spark_applied;

  for r in
    select *
    from tmp_tether_spark
    order by
      (parent_code is not null)::int,
      char_length(code),
      sort_order,
      code
  loop
    v_parent := null;
    v_new := false;
    if r.parent_code is not null then
      select a.task_id into v_parent
      from tmp_tether_spark_applied a
      where a.code = r.parent_code;
      if v_parent is null then
        select t.id into v_parent
        from public.tasks t
        where t.project_id = v_project
          and t.board_scope = 'staging'
          and t.title like r.parent_code || ' %'
        order by t.archived_at nulls first, t.created_at
        limit 1;
      end if;
    end if;

    select t.id into v_id
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = 'staging'
      and (t.title = r.title or t.title like r.code || ' %')
    order by t.archived_at nulls first, t.created_at
    limit 1;

    if v_id is null then
      insert into public.tasks (
        project_id, parent_task_id, title, description, category, difficulty,
        estimated_effort, status, subtasks, staff_only, board_scope, sort_order
      ) values (
        v_project, v_parent, r.title, r.description, r.category, r.difficulty,
        r.estimated_effort, r.status, r.subtasks, r.staff_only, 'staging', r.sort_order
      )
      returning id into v_id;
      v_new := true;
    else
      update public.tasks set
        title = r.title,
        description = r.description,
        category = r.category,
        difficulty = r.difficulty,
        estimated_effort = r.estimated_effort,
        subtasks = r.subtasks,
        staff_only = r.staff_only,
        sort_order = r.sort_order,
        status = r.status,
        parent_task_id = coalesce(v_parent, parent_task_id),
        archived_at = case
          when r.unarchive then null
          else archived_at
        end
      where id = v_id;
    end if;

    insert into tmp_tether_spark_applied (code, task_id, is_new)
    values (r.code, v_id, v_new)
    on conflict (code) do update set task_id = excluded.task_id, is_new = excluded.is_new;
  end loop;

  -- Replace blockers for this spine set only.
  if to_regclass('public.task_dependencies') is not null then
    delete from public.task_dependencies d
    using tmp_tether_spark_applied a
    where d.task_id = a.task_id;

    for r in
      select * from tmp_tether_spark where blocked_by_code is not null
    loop
      select a.task_id into v_id
      from tmp_tether_spark_applied a
      where a.code = r.code;

      select a.task_id into v_blocker
      from tmp_tether_spark_applied a
      where a.code = r.blocked_by_code;

      if v_blocker is null then
        select t.id into v_blocker
        from public.tasks t
        where t.project_id = v_project
          and t.board_scope = 'staging'
          and t.title like r.blocked_by_code || ' %'
        order by t.archived_at nulls first, t.created_at
        limit 1;
      end if;

      if v_id is not null and v_blocker is not null then
        insert into public.task_dependencies (task_id, blocks_on_task_id)
        values (v_id, v_blocker)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Public Tether-10.1 stays Done; 10.2 is deferred (not Done).
  update public.tasks t
  set
    description = s.description,
    subtasks = s.subtasks,
    staff_only = true,
    status = s.status
  from tmp_tether_spark s
  where t.project_id = v_project
    and t.board_scope = 'public'
    and s.code in ('Tether-10.1', 'Tether-10.2')
    and (t.title = s.title or t.title like s.code || ' %');

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
