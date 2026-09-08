-- Restore Tether-3..6 on staging (unarchive existing rows) and refresh
-- public + staging copy/state. Does not insert duplicates. Does not
-- touch Tether-7, 8, 9, 10, 11, 12, 13. Safe to re-run.

do $$
declare
  v_project uuid;
begin
  select id into v_project from public.projects where slug = 'tether' limit 1;
  if v_project is null then
    raise exception 'Tether project not found';
  end if;

  begin
    execute 'alter table public.tasks disable trigger trg_protect_task_staff_only';
  exception
    when undefined_object then null;
  end;

  -- Staging 3-6 were archived by publish. Bring them back. Same IDs.
  update public.tasks t
  set archived_at = null
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title ~ '^Tether-[3-6]([. ]|$)';

  -- Copy / flags on both boards for existing 3-6 cards only.
  update public.tasks t
  set
    title = 'Tether-3 Tether-aware movement',
    description = 'Community claims Tether-3.1. Staff retune pull on Tether-3.2. Epic 2 playtest treated as passed.',
    staff_only = false,
    status = 'ToDo',
    category = 'Code',
    parent_task_id = null
  where t.project_id = v_project
    and t.title like 'Tether-3 %'
    and t.title not like 'Tether-3.%';

  update public.tasks t
  set
    title = 'Tether-3.1 Core locomotion and camera',
    description = 'Walk, run, jump, ground detect, keyboard and gamepad. Document speeds in Docs/ or TetherRules.txt. Camera is Open: third-person that keeps both pawns readable, or first-person plus a tether cue. Write Docs/Camera.md. Do not retune pull, L100, or Tether Health.

Output: Docs/Camera.md plus documented walk/run/jump speeds.

Definition of Done:
- Walk, run, jump, and ground detect work on keyboard and gamepad.
- Speeds are documented in Docs/ or TetherRules.txt.
- Camera choice is written in Docs/Camera.md.
- This card does not retune pull, L100, or Tether Health.',
    staff_only = false,
    status = 'ToDo',
    category = 'Code',
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-3.1 %';

  update public.tasks t
  set
    title = 'Tether-3.2 Pull/resist and failure-mode tests',
    description = 'Staff retune pull toward partner and optional resist. Community must not retune pull. Failure-mode playtest is Tether-3.2.1.',
    staff_only = true,
    status = 'ToDo',
    category = 'Code'
  where t.project_id = v_project
    and t.title like 'Tether-3.2 %'
    and t.title not like 'Tether-3.2.%';

  update public.tasks t
  set
    title = 'Tether-3.2.1 Failure-mode playtest',
    description = 'Playtest failure modes. Dated Docs/qa/PlaytestNote. Tests: one falls off a ledge, both jump, one sprints / one stands. Do not change TetherRules numbers.

Output: Dated Docs/qa/PlaytestNote.

Definition of Done:
- A dated Docs/qa/PlaytestNote exists.
- Tested: one falls off a ledge.
- Tested: both jump.
- Tested: one sprints / one stands.
- TetherRules numbers were not changed on this card.

Blocker: Waiting on staff pull/resist work on Tether-3.2.',
    staff_only = false,
    status = 'ToDo',
    category = 'QA',
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-3.2.1 %';

  update public.tasks t
  set
    title = 'Tether-4 Resources and warp',
    description = 'Resources and warp.

Blocker: Waiting on Tether-3.1 Core locomotion and camera.',
    staff_only = false,
    status = 'ToDo',
    category = 'Code',
    parent_task_id = null,
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-4 %'
    and t.title not like 'Tether-4.%';

  update public.tasks t
  set
    title = 'Tether-4.1 ResourceNode and carry limit',
    description = 'ResourceNode prefab, interact volume, carry limit 1 or 2, deliberate drop. Place at least six nodes in the prototype or a test map.

Definition of Done:
- ResourceNode prefab exists with an interact volume.
- Carry limit is 1 or 2 with a deliberate drop.
- At least six nodes are placed in the prototype or a test map.

Blocker: Waiting on Tether-3.1 Core locomotion and camera.',
    staff_only = false,
    status = 'ToDo',
    category = 'Code',
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-4.1 %';

  update public.tasks t
  set
    title = 'Tether-4.2 Checkpoint warp and session total',
    description = 'Checkpoint warp and session total.

Output: Done at collect → carry → warp → total updates.

Definition of Done:
- Collect → carry → warp → session total updates in one loop.

Blocker: Waiting on Tether-4.1 ResourceNode and carry limit.',
    staff_only = false,
    status = 'ToDo',
    category = 'Code',
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-4.2 %';

  update public.tasks t
  set
    title = 'Tether-5 Enemies that stress the tether',
    description = 'Enemies that stress the tether. Threats whose job is coordination, not a DPS sponge.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.',
    staff_only = false,
    status = 'ToDo',
    category = 'Code',
    parent_task_id = null,
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-5 %'
    and t.title not like 'Tether-5.%';

  update public.tasks t
  set
    title = 'Tether-5.1 Latch enemy',
    description = 'Latch enemy moves toward a pawn or the tether midpoint, attaches, applies a documented penalty, and shows a clear attached state. Energy Pulse pair-remove is faster when both players use it in a short window.

Definition of Done:
- Latch enemy attaches to a pawn or the tether midpoint with a clear attached state.
- A documented penalty applies while attached.
- Energy Pulse pair-remove is faster when both players use it in a short window.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.',
    staff_only = false,
    status = 'ToDo',
    category = 'Code',
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-5.1 %';

  update public.tasks t
  set
    title = 'Tether-6 First playable surface level',
    description = 'First playable surface level.

Blocker: Waiting on Tether-5.1 Latch enemy.',
    staff_only = false,
    status = 'ToDo',
    category = 'Level Design',
    parent_task_id = null,
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-6 %'
    and t.title not like 'Tether-6.%';

  update public.tasks t
  set
    title = 'Tether-6.1 Modular graybox kit plus Level_01_Surface',
    description = 'Parent for kit pieces and Level_01_Surface blockout. Claim the Smalls.

Blocker: Waiting on Tether-5.1 Latch enemy.',
    staff_only = false,
    status = 'ToDo',
    category = 'Level Design',
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-6.1 %'
    and t.title not like 'Tether-6.1.%';

  update public.tasks t
  set
    title = 'Tether-6.1.1 Five modular graybox pieces',
    description = 'Five modular graybox pieces in Content/Tether/Modular.

Output: Content/Tether/Modular with at least five graybox pieces.

Definition of Done:
- At least five modular graybox pieces exist in Content/Tether/Modular.

Blocker: Waiting on Tether-5.1 Latch enemy.',
    staff_only = false,
    status = 'ToDo',
    category = 'Level Design',
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-6.1.1 %';

  update public.tasks t
  set
    title = 'Tether-6.1.2 Block out Level_01_Surface',
    description = 'Block out Content/Tether/Maps/Level_01_Surface: start, two traversal sections, resources, one or two enemy points, end checkpoint.

Output: Content/Tether/Maps/Level_01_Surface.

Definition of Done:
- Level_01_Surface has a start, two traversal sections, resources, one or two enemy points, and an end checkpoint.

Blocker: Waiting on Tether-6.1.1 Five modular graybox pieces.',
    staff_only = false,
    status = 'ToDo',
    category = 'Level Design',
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-6.1.2 %';

  update public.tasks t
  set
    title = 'Tether-6.2 End-to-end 1-4 player loop',
    description = 'Recorded 1-4 player loop. Two-window listen server is enough until Tether-10.2 exists.

Definition of Done:
- A recorded successful 1-4 player run exists.
- Two-window listen server is enough until Tether-10.2 exists.

Blocker: Waiting on Tether-6.1.2 Block out Level_01_Surface.',
    staff_only = false,
    status = 'ToDo',
    category = 'QA',
    dependency_override = false
  where t.project_id = v_project
    and t.title like 'Tether-6.2 %';

  -- Re-parent children on each board using same-scope parents.
  update public.tasks c
  set parent_task_id = p.id
  from public.tasks p
  where c.project_id = v_project
    and p.project_id = v_project
    and c.board_scope = p.board_scope
    and (
      (c.title like 'Tether-3.1 %' and p.title like 'Tether-3 %' and p.title not like 'Tether-3.%')
      or (c.title like 'Tether-3.2 %' and c.title not like 'Tether-3.2.%' and p.title like 'Tether-3 %' and p.title not like 'Tether-3.%')
      or (c.title like 'Tether-3.2.1 %' and p.title like 'Tether-3.2 %' and p.title not like 'Tether-3.2.%')
      or (c.title like 'Tether-4.1 %' and p.title like 'Tether-4 %' and p.title not like 'Tether-4.%')
      or (c.title like 'Tether-4.2 %' and p.title like 'Tether-4 %' and p.title not like 'Tether-4.%')
      or (c.title like 'Tether-5.1 %' and p.title like 'Tether-5 %' and p.title not like 'Tether-5.%')
      or (c.title like 'Tether-6.1 %' and c.title not like 'Tether-6.1.%' and p.title like 'Tether-6 %' and p.title not like 'Tether-6.%')
      or (c.title like 'Tether-6.1.1 %' and p.title like 'Tether-6.1 %' and p.title not like 'Tether-6.1.%')
      or (c.title like 'Tether-6.1.2 %' and p.title like 'Tether-6.1 %' and p.title not like 'Tether-6.1.%')
      or (c.title like 'Tether-6.2 %' and p.title like 'Tether-6 %' and p.title not like 'Tether-6.%')
    );

  -- 3.1 has no blocker.
  delete from public.task_dependencies d
  using public.tasks t
  where d.task_id = t.id
    and t.project_id = v_project
    and t.title like 'Tether-3.1 %';

  -- Named blockers, same board_scope only.
  delete from public.task_dependencies d
  using public.tasks t
  where d.task_id = t.id
    and t.project_id = v_project
    and t.title ~ '^Tether-(3\.2\.1 |4 |4\.1 |4\.2 |5 |5\.1 |6 |6\.1 |6\.1\.1 |6\.1\.2 |6\.2 )';

  insert into public.task_dependencies (task_id, blocks_on_task_id)
  select a.id, b.id
  from public.tasks a
  join public.tasks b
    on b.project_id = a.project_id
   and b.board_scope = a.board_scope
  where a.project_id = v_project
    and a.title ~ '^Tether-[3-6]'
    and b.title ~ '^Tether-[3-6]'
    and a.id is distinct from b.id
    and (
      (a.title like 'Tether-3.2.1 %' and b.title like 'Tether-3.2 %' and b.title not like 'Tether-3.2.%')
      or (a.title like 'Tether-4 %' and a.title not like 'Tether-4.%' and b.title like 'Tether-3.1 %')
      or (a.title like 'Tether-4.1 %' and b.title like 'Tether-3.1 %')
      or (a.title like 'Tether-4.2 %' and b.title like 'Tether-4.1 %')
      or (a.title like 'Tether-5 %' and a.title not like 'Tether-5.%' and b.title like 'Tether-4.2 %')
      or (a.title like 'Tether-5.1 %' and b.title like 'Tether-4.2 %')
      or (a.title like 'Tether-6 %' and a.title not like 'Tether-6.%' and b.title like 'Tether-5.1 %')
      or (a.title like 'Tether-6.1 %' and a.title not like 'Tether-6.1.%' and b.title like 'Tether-5.1 %')
      or (a.title like 'Tether-6.1.1 %' and b.title like 'Tether-5.1 %')
      or (a.title like 'Tether-6.1.2 %' and b.title like 'Tether-6.1.1 %')
      or (a.title like 'Tether-6.2 %' and b.title like 'Tether-6.1.2 %')
    )
  on conflict do nothing;

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
