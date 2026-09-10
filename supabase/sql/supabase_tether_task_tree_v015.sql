-- Tether-7 Stats, weapons, tools from Tether_Task_Breakdown_v0.15
-- plus v0.16 weapon addendum → staging board only.
-- Upsert by title / ID prefix. Does not publish. Does not write public rows.
-- Does not rewrite Tether-4.1, Tether-4.2, Tether-5, or Tether-6.
-- Moves leftover Tether-11 weapons/tools onto Tether-7. Epic 11 stays UI.
-- Safe to re-run.
--
--   supabase db query --linked -f supabase/sql/supabase_tether_task_tree_v015.sql

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

  -- Remap leftover Tether-11 weapons/tools onto Tether-7 (staging only).
  update public.tasks t
  set title = 'Tether-7.2.1 Hand Spark'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-11.1 %'
    and t.title not like 'Tether-11.1.%'
    and t.title ~* 'Hand Spark|spark';

  update public.tasks t
  set title = 'Tether-7.3.5 Crew shields field'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-11.2 %'
    and t.title not like 'Tether-11.2.%'
    and t.title ~* 'shield';

  update public.tasks t
  set title = 'Tether-7.3.3 Grapple hook'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-11.4 %'
    and t.title not like 'Tether-11.4.%'
    and t.title ~* 'Grapple|hook';

  update public.tasks t
  set title = 'Tether-7.3.4 Boost pack'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-11.5 %'
    and t.title not like 'Tether-11.5.%'
    and t.title ~* 'Boost|pack';

  update public.tasks t
  set title = 'Tether-11 UI'
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-11 %'
    and t.title not like 'Tether-11.%'
    and t.title ~* 'Tools and weapons|tools, upgrades';

  create temporary table if not exists tmp_tether_v015 (
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

  delete from tmp_tether_v015;

  insert into tmp_tether_v015 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, blocked_by_codes, subtasks, status
  ) values
    ('Tether-7', null, 'Tether-7 Stats, weapons, tools', 'Player loadout and upgrades. Default weapons live here so Epic 5 has something to hit. Crew shields are a pawn field Tick and Spore use. Numbers wait on playtest and live in Docs/Tools.md.

Source: Tether_Task_Breakdown_v0.15 plus v0.16 weapon addendum. Staging only. Do not publish.', 'Code', 'Medium', 'Medium', true, 70, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-7.1', 'Tether-7', 'Tether-7.1 Stat upgrades', 'First slice: tether health, tether length, shield durability, repair strength, carry. Other stats wait on the Open Question.', 'Code', 'Medium', 'Medium', true, 10, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-7.1.1', 'Tether-7.1', 'Tether-7.1.1 Upgrade row data', 'Name, what it changes, first cost. Numbers Open.

Definition of Done:
- Each first-slice upgrade has a name, what it changes, and a first cost.
- Numbers stay Open until playtest.', 'Code', 'Easy', 'Small', true, 10, '{}'::text[], '[{"id":"s1","label":"Each first-slice upgrade has a name, what it changes, and a first cost.","done":false},{"id":"s2","label":"Numbers stay Open until playtest.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.1.2', 'Tether-7.1', 'Tether-7.1.2 Tether health upgrade', 'Upgrade that raises tether health.

Definition of Done:
- Tether health can be upgraded from the first-slice row data.', 'Code', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"Tether health can be upgraded from the first-slice row data.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.1.3', 'Tether-7.1', 'Tether-7.1.3 Tether length upgrade', 'Upgrade that raises tether length.

Definition of Done:
- Tether length can be upgraded from the first-slice row data.', 'Code', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"Tether length can be upgraded from the first-slice row data.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.1.4', 'Tether-7.1', 'Tether-7.1.4 Shield durability upgrade', 'Upgrade that raises shield durability. Crew shields (7.3.5) spend this field.

Definition of Done:
- Shield durability can be upgraded from the first-slice row data.', 'Code', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Shield durability can be upgraded from the first-slice row data.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.1.5', 'Tether-7.1', 'Tether-7.1.5 Repair strength upgrade', 'Upgrade that raises repair strength.

Definition of Done:
- Repair strength can be upgraded from the first-slice row data.', 'Code', 'Easy', 'Small', true, 50, '{}'::text[], '[{"id":"s1","label":"Repair strength can be upgraded from the first-slice row data.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.1.6', 'Tether-7.1', 'Tether-7.1.6 Carry upgrade', 'Upgrade that raises carry.

Definition of Done:
- Carry can be upgraded from the first-slice row data.', 'Code', 'Easy', 'Small', true, 60, '{}'::text[], '[{"id":"s1","label":"Carry can be upgraded from the first-slice row data.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.1.7', 'Tether-7.1', 'Tether-7.1.7 Spend currency', 'Open until Matthew picks colony total, a separate chip, or something else.

Definition of Done:
- Matthew picks colony total, a separate chip, or something else.
- The pick is written in Docs/Tools.md.', 'Design', 'Easy', 'Small', true, 70, '{}'::text[], '[{"id":"s1","label":"Matthew picks colony total, a separate chip, or something else.","done":false},{"id":"s2","label":"The pick is written in Docs/Tools.md.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.2', 'Tether-7', 'Tether-7.2 Weapons', 'Talk about power as time to kill a 1000 health body, one player, no extra tricks. First slice: Hand Spark, Nano-Knife, Beam Enforcer. Energy Canon and Snare are on the board after those three. Jetpack is a tool, not a gun.', 'Code', 'Medium', 'Medium', true, 20, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-7.2.1', 'Tether-7.2', 'Tether-7.2.1 Hand Spark', 'Default pistol. Slow shot. Each hit adds a short slow that fades on its own clock. If four slows are on the target at the same time, those four burn off and the creature stuns. One gun can build the four. Four guns can land them in one volley. Durations wait on playtest. Solo TTK target about 30 seconds on 1000 health.

Output: Hand Spark default pistol.

Definition of Done:
- Tether-7.2.1.1 Spark projectile and fire rate exist.
- Tether-7.2.1.2 Slow stacks: separate timers. Four live stacks consume into a stun.
- Tether-7.2.1.3 Spark stun read: placeholder cue and readable stun.
- Tether-7.2.1.4 Spark TTK check: about 30 seconds on 1000 health. Playtest overwrites.

Moved from Tether-11.1 if that card existed. Not under Tether-11.', 'Code', 'Medium', 'Medium', true, 10, '{}'::text[], '[{"id":"s1","label":"Tether-7.2.1.1 Spark projectile and fire rate exist.","done":false},{"id":"s2","label":"Tether-7.2.1.2 Slow stacks: separate timers. Four live stacks consume into a stun.","done":false},{"id":"s3","label":"Tether-7.2.1.3 Spark stun read: placeholder cue and readable stun.","done":false},{"id":"s4","label":"Tether-7.2.1.4 Spark TTK check: about 30 seconds on 1000 health. Playtest overwrites.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.2.2', 'Tether-7.2', 'Tether-7.2.2 Nano-Knife', 'Melee. The blade seeds nanites that attack the creature from the inside. The DoT is that swarm eating. Each cut adds a tiny DoT stack and refreshes every stack already on the target. More cutters, more stacks. Spark stun is the dump window. Tick rate, stack cap, and duration wait on playtest.

Output: Nano-Knife melee.

Definition of Done:
- Tether-7.2.2.1 Melee hit lands.
- Tether-7.2.2.2 DoT stacks and refresh: each cut adds a stack and refreshes stacks already on the target.
- Tether-7.2.2.3 Crew dump on stun: Spark stun is the dump window.
- Tether-7.2.2.4 Nanite read: inside-the-body cue while stacks last. Inner glow or crawl.', 'Code', 'Medium', 'Medium', true, 20, '{}'::text[], '[{"id":"s1","label":"Tether-7.2.2.1 Melee hit lands.","done":false},{"id":"s2","label":"Tether-7.2.2.2 DoT stacks and refresh: each cut adds a stack and refreshes stacks already on the target.","done":false},{"id":"s3","label":"Tether-7.2.2.3 Crew dump on stun: Spark stun is the dump window.","done":false},{"id":"s4","label":"Tether-7.2.2.4 Nanite read: inside-the-body cue while stacks last. Inner glow or crawl.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.2.3', 'Tether-7.2', 'Tether-7.2.3 Beam Enforcer', 'Hold a beam on the target. Weak alone. Each extra beam on the same target raises damage a lot. One babysits. The rest can do something else. Starting extra-beam curve 1, 3, 9, 27 per tick. Playtest overwrites.

Output: Beam Enforcer hold-beam.

Definition of Done:
- Tether-7.2.3.1 Hold beam: damage while the beam is on the target.
- Tether-7.2.3.2 Extra-beam multiplier: starting curve 1, 3, 9, 27 per tick. Playtest overwrites.
- Tether-7.2.3.3 Shared-target read: readable who is beaming the same target.', 'Code', 'Medium', 'Medium', true, 30, '{}'::text[], '[{"id":"s1","label":"Tether-7.2.3.1 Hold beam: damage while the beam is on the target.","done":false},{"id":"s2","label":"Tether-7.2.3.2 Extra-beam multiplier: starting curve 1, 3, 9, 27 per tick. Playtest overwrites.","done":false},{"id":"s3","label":"Tether-7.2.3.3 Shared-target read: readable who is beaming the same target.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.2.4', 'Tether-7.2', 'Tether-7.2.4 Energy Canon', 'Later than 7.2.1-7.2.3. Heavy charged shot. Limited ammo. Charge from the tether. Refill at a warp. Slow reload. One shot hits hard. Release early for medium contact and low AOE. Detonate mid-air on a second press. While charging, other players can hold the Canon. Each helper raises charge speed, projectile speed, AOE, and damage. Cap at three helpers so all four can be on one gun.

Output: Energy Canon heavy charged shot.

Definition of Done:
- Tether-7.2.4.1 Canon body, fire, and reload exist.
- Tether-7.2.4.2 Tether charge and warp refill: ammo count, charge from the tether, refill at warp.
- Tether-7.2.4.3 Charge tiers: early release vs held charge.
- Tether-7.2.4.4 Mid-air detonate on a second press.
- Tether-7.2.4.5 Helper interact: up to three extra players. Each adds charge speed, projectile speed, AOE, damage.
- Tether-7.2.4.6 Canon charge read: readable charge and who is helping.

Blocker: Waiting on Tether-7.2.1 and Tether-7.2.2 and Tether-7.2.3.', 'Code', 'Medium', 'Medium', true, 40, ARRAY['Tether-7.2.1', 'Tether-7.2.2', 'Tether-7.2.3']::text[], '[{"id":"s1","label":"Tether-7.2.4.1 Canon body, fire, and reload exist.","done":false},{"id":"s2","label":"Tether-7.2.4.2 Tether charge and warp refill: ammo count, charge from the tether, refill at warp.","done":false},{"id":"s3","label":"Tether-7.2.4.3 Charge tiers: early release vs held charge.","done":false},{"id":"s4","label":"Tether-7.2.4.4 Mid-air detonate on a second press.","done":false},{"id":"s5","label":"Tether-7.2.4.5 Helper interact: up to three extra players. Each adds charge speed, projectile speed, AOE, damage.","done":false},{"id":"s6","label":"Tether-7.2.4.6 Canon charge read: readable charge and who is helping.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.2.5', 'Tether-7.2', 'Tether-7.2.5 Snare', 'Later than 7.2.1-7.2.3. Almost no damage. Pins the target to the ground at the shooter''s spot with a cable. One cable holds for a short time. More cables share the chew, so they last longer. Small creatures break out slow. Large creatures break out fast. A massive creature breaks a basic cable immediately. High Snare upgrades can change that.

Output: Snare pin cable.

Definition of Done:
- Tether-7.2.5.1 Snare projectile and cable to the shooter''s ground point.
- Tether-7.2.5.2 Cable health: chew while the target pulls.
- Tether-7.2.5.3 Extra cables split chew.
- Tether-7.2.5.4 Size modifier: break speed by creature size.
- Tether-7.2.5.5 Snare cable read exists.

Blocker: Waiting on Tether-7.2.1 and Tether-7.2.2 and Tether-7.2.3.', 'Code', 'Medium', 'Medium', true, 50, ARRAY['Tether-7.2.1', 'Tether-7.2.2', 'Tether-7.2.3']::text[], '[{"id":"s1","label":"Tether-7.2.5.1 Snare projectile and cable to the shooter''s ground point.","done":false},{"id":"s2","label":"Tether-7.2.5.2 Cable health: chew while the target pulls.","done":false},{"id":"s3","label":"Tether-7.2.5.3 Extra cables split chew.","done":false},{"id":"s4","label":"Tether-7.2.5.4 Size modifier: break speed by creature size.","done":false},{"id":"s5","label":"Tether-7.2.5.5 Snare cable read exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.3', 'Tether-7', 'Tether-7.3 Tools', 'First slice: Rescue Pull and Tether Lock. Section unlocks: Grapple for Section 2, Boost pack for Section 3. Jetpack is Later.', 'Code', 'Medium', 'Medium', true, 30, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-7.3.1', 'Tether-7.3', 'Tether-7.3.1 Rescue Pull', 'A hanging or stuck partner can be reeled in. Crew interacts with the beam. More people on the pull makes it faster.

Definition of Done:
- Tether-7.3.1.1 Pull interact: interact on the beam while a partner is hanging or adrift.
- Tether-7.3.1.2 Pull scales with hands.', 'Code', 'Medium', 'Medium', true, 10, '{}'::text[], '[{"id":"s1","label":"Tether-7.3.1.1 Pull interact: interact on the beam while a partner is hanging or adrift.","done":false},{"id":"s2","label":"Tether-7.3.1.2 Pull scales with hands.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.3.2', 'Tether-7.3', 'Tether-7.3.2 Tether Lock', 'A falling player can lock the line and stop the fall. The lock stays until that player touches ground. Nobody else can unlock it.

Definition of Done:
- Tether-7.3.2.1 Lock input: lock while falling.
- Tether-7.3.2.2 Hold until grounded: hold at current length until the locker is grounded.
- Tether-7.3.2.3 Locked beam read exists.', 'Code', 'Medium', 'Medium', true, 20, '{}'::text[], '[{"id":"s1","label":"Tether-7.3.2.1 Lock input: lock while falling.","done":false},{"id":"s2","label":"Tether-7.3.2.2 Hold until grounded: hold at current length until the locker is grounded.","done":false},{"id":"s3","label":"Tether-7.3.2.3 Locked beam read exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.3.3', 'Tether-7.3', 'Tether-7.3.3 Grapple hook', 'Section 2 unlock. Reach places walking cannot. Beam rules still apply. Section 2 map playtests wait on a usable hook.

Definition of Done:
- A usable grapple hook exists. Beam rules still apply while hooked.

Moved from Tether-11.4 if that card existed. Not under Tether-11.', 'Code', 'Easy', 'Small', true, 30, '{}'::text[], '[{"id":"s1","label":"A usable grapple hook exists. Beam rules still apply while hooked.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.3.4', 'Tether-7.3', 'Tether-7.3.4 Boost pack', 'Section 3 unstuck assist. Short weak shove while not touching a surface. Cannot finish a space map alone. A stuck player still needs a teammate on a surface or on the line.

Definition of Done:
- Boost pack is a short weak shove while not touching a surface.
- A solo player cannot finish a space map with the pack alone.

Moved from Tether-11.5 if that card existed. Not under Tether-11.', 'Code', 'Easy', 'Small', true, 40, '{}'::text[], '[{"id":"s1","label":"Boost pack is a short weak shove while not touching a surface.","done":false},{"id":"s2","label":"A solo player cannot finish a space map with the pack alone.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.3.5', 'Tether-7.3', 'Tether-7.3.5 Crew shields field', 'Tick and Spore spend this. Stand-in number allowed until 7.1.4 exists.

Definition of Done:
- A crew shields pawn field exists.
- Tick and Spore can spend it. A stand-in number is allowed until Tether-7.1.4 exists.

Moved from Tether-11.2 if that card existed. Not under Tether-11.', 'Code', 'Easy', 'Small', true, 50, '{}'::text[], '[{"id":"s1","label":"A crew shields pawn field exists.","done":false},{"id":"s2","label":"Tick and Spore can spend it. A stand-in number is allowed until Tether-7.1.4 exists.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.3.6', 'Tether-7.3', 'Tether-7.3.6 Jetpack', 'Later. Lethal Company shape: hard to fly, easy to rip the line if you punch it, fuel or weight so it cannot skip a map. Do not add extra smalls this pass.

Definition of Done:
- Jetpack stays a Later note. No extra smalls this pass.', 'Code', 'Easy', 'Small', true, 60, '{}'::text[], '[{"id":"s1","label":"Jetpack stays a Later note. No extra smalls this pass.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.4', 'Tether-7', 'Tether-7.4 Docs and Open Question', 'Docs/Tools.md and the upgrade Open Question.', 'Writing', 'Medium', 'Medium', true, 40, '{}'::text[], '[]'::jsonb, 'ToDo'),
    ('Tether-7.4.1', 'Tether-7.4', 'Tether-7.4.1 Docs/Tools.md', 'Spark, knife, enforcer, Canon, Snare, pull, lock, grapple, pack. Numbers live here.

Output: Docs/Tools.md in the Tether repo.

Definition of Done:
- Docs/Tools.md exists with Spark, knife, enforcer, Canon, Snare, pull, lock, grapple, and pack.
- Numbers for those tools live in Docs/Tools.md.', 'Writing', 'Easy', 'Small', false, 10, '{}'::text[], '[{"id":"s1","label":"Docs/Tools.md exists with Spark, knife, enforcer, Canon, Snare, pull, lock, grapple, and pack.","done":false},{"id":"s2","label":"Numbers for those tools live in Docs/Tools.md.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-7.4.2', 'Tether-7.4', 'Tether-7.4.2 Upgrade Open Question', 'Extra stats after the first five. Extra weapons after these five. Extra tools after pull, lock, grapple, pack. Extra resource types wait for the Tether-4.3 catalog pass. Do not post this until Matthew writes the form copy.

Definition of Done:
- Matthew writes the form copy before this question is posted.
- The question covers extra stats, weapons, and tools. Extra resource types wait for Tether-4.3.', 'Community', 'Easy', 'Small', true, 20, '{}'::text[], '[{"id":"s1","label":"Matthew writes the form copy before this question is posted.","done":false},{"id":"s2","label":"The question covers extra stats, weapons, and tools. Extra resource types wait for Tether-4.3.","done":false}]'::jsonb, 'ToDo'),
    ('Tether-11', null, 'Tether-11 UI', 'Later. Tension read, carry count, tool status, upgrade screen, simple menus. No weapon children.

Empty of weapons. Hand Spark, Grapple, Boost pack, and crew shields live under Tether-7.', 'Code', 'Medium', 'Medium', true, 110, '{}'::text[], '[]'::jsonb, 'ToDo');

  for v_row in
    select *
    from tmp_tether_v015
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
        sort_order = v_row.sort_order
      where id = v_id
        and board_scope = 'staging';
      v_updated := v_updated + 1;
    end if;
  end loop;

  -- Replace blockers for this tree only (staging).
  delete from public.task_dependencies d
  using public.tasks a, tmp_tether_v015 r
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
    select * from tmp_tether_v015 where cardinality(blocked_by_codes) > 0
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

  -- Tether-7 must not wait on Tether-5 or Tether-6, and must not sit under them.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and b.project_id = v_project
    and a.board_scope = 'staging'
    and b.board_scope = 'staging'
    and a.title ~ '^Tether-7([. ]|$)'
    and b.title ~ '^Tether-[56]([. ]|$)';

  update public.tasks t
  set parent_task_id = null
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title like 'Tether-7 %'
    and t.title not like 'Tether-7.%';

  -- Epic 11 must not keep weapon children.
  update public.tasks t
  set parent_task_id = (
    select p.id from public.tasks p
    where p.project_id = v_project
      and p.board_scope = 'staging'
      and p.title like 'Tether-7.3 %'
      and p.title not like 'Tether-7.3.%'
    limit 1
  )
  where t.project_id = v_project
    and t.board_scope = 'staging'
    and t.title ~ '^Tether-7\.3\.[345] '
    and t.parent_task_id in (
      select p.id from public.tasks p
      where p.project_id = v_project
        and p.board_scope = 'staging'
        and p.title like 'Tether-11 %'
        and p.title not like 'Tether-11.%'
    );

  raise notice 'Tether v0.15 staging upsert created=% updated=%',
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
