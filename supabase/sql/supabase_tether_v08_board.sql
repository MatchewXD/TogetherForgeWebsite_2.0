-- Tether board v0.8 language + Community Decisions.
-- Epic 5 is Enemies. Maps are not blocked by Enemies. Art waits on CD.1.
-- Creates Tether-CD on Staging, then copies the epic + two markers to Public
-- as Staff Only (staging twins stay live). Safe to re-run.
-- Does not touch Tether-3 / 3.1 / 3.2 claimability. Does not touch TF_Guide.

do $$
declare
  v_project uuid;
  v_scope text;
  v_parent uuid;
  v_id uuid;
  v_pub uuid;
  v_st uuid;
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

  -- Titles: Enemies epic, first utility enemy (Latch is one example creature).
  update public.tasks t
  set title = 'Tether-5 Enemies'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-5 %'
    and t.title not like 'Tether-5.%';

  update public.tasks t
  set title = 'Tether-5.1 First utility enemy'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-5.1 %';

  update public.tasks t
  set description = 'Enemies that stress the tether. Threats whose job is coordination, not a DPS sponge. Latch is one example creature, not the name of this epic.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title = 'Tether-5 Enemies';

  update public.tasks t
  set description = 'First utility enemy. One example is a grab-the-person-or-beam creature (a Latch): it moves toward a pawn or the tether midpoint, attaches, applies a documented penalty (extra tension, slow, or drain), and shows a clear attached state. Removal is faster when both players use Energy Pulse inside a short window (pair-remove). Playtest with two people and confirm the pair advantage is obvious.

Definition of Done:
- A first utility enemy attaches to a pawn or the tether midpoint with a clear attached state. A grab-the-person-or-beam Latch is one valid example.
- A documented penalty applies while attached.
- Energy Pulse pair-remove is faster when both players use it in a short window.

Blocker: Waiting on Tether-4.2 Checkpoint warp and session total.'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title = 'Tether-5.1 First utility enemy';

  update public.tasks t
  set description = 'Maps. First playable surface level. Not blocked by Enemies. Official campaign maps must match Vision, StyleLock, Camera.md, and TetherRules.txt.'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-6 %'
    and t.title not like 'Tether-6.%';

  update public.tasks t
  set description = 'Parent for kit pieces and Level_01_Surface blockout. Claim the Smalls. Not blocked by Enemies.'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-6.1 %'
    and t.title not like 'Tether-6.1.%';

  update public.tasks t
  set description = 'Five modular graybox pieces in Content/Tether/Modular.

Output: Content/Tether/Modular with at least five graybox pieces.

Definition of Done:
- At least five modular graybox pieces exist in Content/Tether/Modular.'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-6.1.1 %';

  update public.tasks t
  set description = 'Block out Content/Tether/Maps/Level_01_Surface: start, two traversal sections, resources, one or two enemy points, end checkpoint. Official campaign maps must match Vision, StyleLock, Camera.md, and TetherRules.txt.

Output: Content/Tether/Maps/Level_01_Surface.

Definition of Done:
- Level_01_Surface has a start, two traversal sections, resources, one or two enemy points, and an end checkpoint.

Blocker: Waiting on Tether-6.1.1 Five modular graybox pieces.'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-6.1.2 %';

  update public.tasks t
  set description = 'Art pipeline. Production final assets wait on Tether-CD.1 (palette Adopted into StyleLock.md). Art exploration replies belong on that Open Question, not as a separate public art epic.'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-9 %'
    and t.title not like 'Tether-9.%';

  update public.tasks t
  set description = 'Staff approve StyleLock.md after Tether-CD.1 is Adopted (palette, silhouettes, materials). StyleLock.md stays Draft until staff accept.

Output: Docs/StyleLock.md accepted by staff.

Definition of Done:
- Staff accept Docs/StyleLock.md.
- Until then StyleLock.md stays Draft.'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-9.1 %';

  update public.tasks t
  set description = 'Core final assets. Blocked on Tether-CD.1 Suit and world palette only. Not on Enemies. Not on maps.

Blocker: Waiting on Tether-CD.1 Suit and world palette.'
  where t.project_id = v_project
    and t.archived_at is null
    and t.title like 'Tether-9.2 %';

  -- Maps must not wait on Enemies / Tether-5.1. Never self-wait.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and b.project_id = v_project
    and a.archived_at is null
    and (
      d.task_id = d.blocks_on_task_id
      or (
        (
          a.title like 'Tether-6 %'
          or a.title like 'Tether-6.1 %'
          or a.title like 'Tether-6.1.1 %'
          or a.title like 'Tether-6.1.2 %'
          or a.title like 'Tether-6.2 %'
        )
        and (
          b.title like 'Tether-5 %'
          or b.title like 'Tether-5.1 %'
        )
      )
    );

  -- Tether-CD on Staging first, then Public copies. Staff Only.
  foreach v_scope in array array['staging', 'public']
  loop
    select t.id into v_parent
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = v_scope
      and t.archived_at is null
      and t.title like 'Tether-CD %'
      and t.title not like 'Tether-CD.%'
    order by t.created_at
    limit 1;

    if v_parent is null then
      insert into public.tasks (
        project_id, parent_task_id, title, description, category, difficulty,
        estimated_effort, status, subtasks, staff_only, board_scope, sort_order
      ) values (
        v_project, null,
        'Tether-CD Community Decisions',
        'Holds live Open Questions. Each child is a status marker. Nobody claims these cards. People post one suggestion and vote on the Open Questions board. When staff close a vote, update the GDD and then write production Smalls.',
        'Community', 'Medium', 'Medium', 'ToDo', '[]'::jsonb, true, v_scope, 45
      )
      returning id into v_parent;
    else
      update public.tasks
      set
        title = 'Tether-CD Community Decisions',
        description = 'Holds live Open Questions. Each child is a status marker. Nobody claims these cards. People post one suggestion and vote on the Open Questions board. When staff close a vote, update the GDD and then write production Smalls.',
        category = 'Community',
        staff_only = true,
        sort_order = 45,
        parent_task_id = null
      where id = v_parent;
    end if;

    select t.id into v_id
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = v_scope
      and t.archived_at is null
      and t.title like 'Tether-CD.1 %'
    order by t.created_at
    limit 1;

    if v_id is null then
      insert into public.tasks (
        project_id, parent_task_id, title, description, category, difficulty,
        estimated_effort, status, subtasks, staff_only, board_scope, sort_order
      ) values (
        v_project, v_parent,
        'Tether-CD.1 Suit and world palette',
        'Open Question marker. Not claimable work.

Prompt to post on Open Questions:
The crew wears future-tech survival suits that have been used. Helmets, packs, manufactured gear, dirt and scuffs. Cool colony tech in the world. The beam carries the energy color. What color palette would look good with that? Stay readable at a distance. No real-world party marks. No slogan decals. One suggestion per reply. Vote the ones you want staff to take seriously.

When Adopted: write the palette into Docs/StyleLock.md. Then production art cards may leave Blocked.',
        'Community', 'Medium', 'Medium', 'InProgress', '[]'::jsonb, true, v_scope, 10
      );
    else
      update public.tasks
      set
        title = 'Tether-CD.1 Suit and world palette',
        description = 'Open Question marker. Not claimable work.

Prompt to post on Open Questions:
The crew wears future-tech survival suits that have been used. Helmets, packs, manufactured gear, dirt and scuffs. Cool colony tech in the world. The beam carries the energy color. What color palette would look good with that? Stay readable at a distance. No real-world party marks. No slogan decals. One suggestion per reply. Vote the ones you want staff to take seriously.

When Adopted: write the palette into Docs/StyleLock.md. Then production art cards may leave Blocked.',
        category = 'Community',
        staff_only = true,
        status = 'InProgress',
        parent_task_id = v_parent,
        sort_order = 10
      where id = v_id;
    end if;

    select t.id into v_id
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = v_scope
      and t.archived_at is null
      and t.title like 'Tether-CD.2 %'
    order by t.created_at
    limit 1;

    if v_id is null then
      insert into public.tasks (
        project_id, parent_task_id, title, description, category, difficulty,
        estimated_effort, status, subtasks, staff_only, board_scope, sort_order
      ) values (
        v_project, v_parent,
        'Tether-CD.2 What kinds of enemies should we add',
        'Open Question marker. Not claimable work.

Prompt to post on Open Questions:
We want enemies that hinder utility, not a shooter roster. Example jobs: grab a person or the beam, pick a friend up and carry them toward a drop, make a stretch of ground unsafe to linger on, tax the beam without becoming a health-bar boss. What kinds of enemies should we add? Name. What it does to a person or the beam. How the crew answers it together. One enemy per reply.',
        'Community', 'Medium', 'Medium', 'InProgress', '[]'::jsonb, true, v_scope, 20
      );
    else
      update public.tasks
      set
        title = 'Tether-CD.2 What kinds of enemies should we add',
        description = 'Open Question marker. Not claimable work.

Prompt to post on Open Questions:
We want enemies that hinder utility, not a shooter roster. Example jobs: grab a person or the beam, pick a friend up and carry them toward a drop, make a stretch of ground unsafe to linger on, tax the beam without becoming a health-bar boss. What kinds of enemies should we add? Name. What it does to a person or the beam. How the crew answers it together. One enemy per reply.',
        category = 'Community',
        staff_only = true,
        status = 'InProgress',
        parent_task_id = v_parent,
        sort_order = 20
      where id = v_id;
    end if;

    -- Unofficial maps lane under Tether-6.
    select t.id into v_parent
    from public.tasks t
    where t.project_id = v_project
      and t.board_scope = v_scope
      and t.archived_at is null
      and t.title like 'Tether-6 %'
      and t.title not like 'Tether-6.%'
    order by t.created_at
    limit 1;

    if v_parent is not null then
      select t.id into v_id
      from public.tasks t
      where t.project_id = v_project
        and t.board_scope = v_scope
        and t.archived_at is null
        and t.title like 'Tether-6.3 %'
      order by t.created_at
      limit 1;

      if v_id is null then
        insert into public.tasks (
          project_id, parent_task_id, title, description, category, difficulty,
          estimated_effort, status, subtasks, staff_only, board_scope, sort_order
        ) values (
          v_project, v_parent,
          'Tether-6.3 Unofficial community maps',
          'Lane for unofficial maps. Output Content/Tether/Maps/Community/ plus a short note (author, intended player count, what the line is asked to do). Off-campaign but playable maps stay in that folder. Off-brand work (nuke the map, and similar) is declined, not filed as unofficial. Not blocked by Enemies.

Output: Content/Tether/Maps/Community/ with a short author note per map.

Definition of Done:
- Unofficial playable maps live in Content/Tether/Maps/Community/.
- Each map has a short note: author, intended player count, what the line is asked to do.
- Off-brand work is declined, not filed as unofficial.',
          'Level Design', 'Easy', 'Small', 'ToDo', '[]'::jsonb, true, v_scope, 30
        );
      else
        update public.tasks
        set
          title = 'Tether-6.3 Unofficial community maps',
          description = 'Lane for unofficial maps. Output Content/Tether/Maps/Community/ plus a short note (author, intended player count, what the line is asked to do). Off-campaign but playable maps stay in that folder. Off-brand work (nuke the map, and similar) is declined, not filed as unofficial. Not blocked by Enemies.

Output: Content/Tether/Maps/Community/ with a short author note per map.

Definition of Done:
- Unofficial playable maps live in Content/Tether/Maps/Community/.
- Each map has a short note: author, intended player count, what the line is asked to do.
- Off-brand work is declined, not filed as unofficial.',
          category = 'Level Design',
          staff_only = true,
          parent_task_id = v_parent,
          sort_order = 30
        where id = v_id;
      end if;
    end if;
  end loop;

  -- Point staging published_task_id at public twins.
  for v_st, v_pub in
    select s.id, p.id
    from public.tasks s
    join public.tasks p
      on p.project_id = s.project_id
     and p.board_scope = 'public'
     and p.archived_at is null
     and p.title = s.title
    where s.project_id = v_project
      and s.board_scope = 'staging'
      and s.archived_at is null
      and (
        s.title like 'Tether-CD %'
        or s.title like 'Tether-CD.1 %'
        or s.title like 'Tether-CD.2 %'
        or s.title like 'Tether-6.3 %'
      )
  loop
    update public.tasks
    set published_task_id = v_pub, published_at = coalesce(published_at, now())
    where id = v_st;
  end loop;

  -- Production art waits on CD.1 only (same board). Drop 9.2 → 9.1.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and a.archived_at is null
    and a.title like 'Tether-9.2 %'
    and b.title like 'Tether-9.1 %';

  insert into public.task_dependencies (task_id, blocks_on_task_id)
  select a.id, b.id
  from public.tasks a
  join public.tasks b
    on b.project_id = a.project_id
   and b.board_scope = a.board_scope
   and b.archived_at is null
  where a.project_id = v_project
    and a.archived_at is null
    and a.id is distinct from b.id
    and a.title like 'Tether-9.2 %'
    and b.title like 'Tether-CD.1 %'
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
