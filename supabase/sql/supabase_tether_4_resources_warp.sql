-- Tether-4 Resources and warp (board upsert).
-- Reuses existing 4 / 4.1 / 4.2 ids. Adds 4.1.1–4.1.3 and 4.2.1–4.2.3 if missing.
-- Smalls are Staff Only. Tether-3 is Done so these are Ready (no 3.1 lock).
-- Does not touch Tether-3 claims, TF_Guide, or Tether-5/6. Safe to re-run.

do $$
declare
  v_project uuid;
  v_scope text;
  r record;
  v_id uuid;
  v_parent uuid;
  v_created int := 0;
  v_updated int := 0;
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

  create temporary table if not exists tmp_tether4 (
    code text primary key,
    parent_code text,
    title text not null,
    description text not null,
    category text not null,
    difficulty text not null,
    estimated_effort text not null,
    staff_only boolean not null,
    sort_order integer not null,
    match_old text
  ) on commit drop;
  delete from tmp_tether4;

  insert into tmp_tether4 (
    code, parent_code, title, description, category, difficulty,
    estimated_effort, staff_only, sort_order, match_old
  ) values
  (
    'Tether-4', null,
    'Tether-4 Resources and warp',
    $d$Goal: two players can pick up a resource, carry it, bank it at a warp, and see a session total go up.
Done when that full loop works on a test map. Debug text is enough.

Graybox only. No final meshes. Staff or trusted work. Not a first-time public claim. Not a blocker on Tether-6 maps. Maps are not a blocker on this epic. Test map Content/Tether/Maps/TetherPrototype is allowed. Do not require Level_01_Surface.

Canon: Docs/Vision.md, Docs/StyleLock.md, Docs/TetherRules.txt.
Output folder: Content/Tether/Interact.$d$,
    'Code', 'Medium', 'Medium', false, 40, 'Tether-4 Resources and warp'
  ),
  (
    'Tether-4.1', 'Tether-4',
    'Tether-4.1 Pickup and carry',
    $d$Pickup and carry.
Done when a player can take a node, hold 1 or 2, walk, drop on purpose, and pick up again.

Graybox only. Carry band is 1 or 2. Interact is the existing key (E / west face).$d$,
    'Code', 'Medium', 'Medium', false, 10, 'Tether-4.1 ResourceNode and carry limit'
  ),
  (
    'Tether-4.1.1', 'Tether-4.1',
    'Tether-4.1.1 ResourceNode prefab and interact volume',
    $d$Goal: one reusable pickup actor.

Steps:
1. Create a graybox ResourceNode in Content/Tether/Interact.
2. Add an interact volume. Same interact key as reattach and repair.
3. On success the node is taken and the pawn is holding it.
4. One prefab, not unique actors per pickup.

Output: Content/Tether/Interact ResourceNode prefab.
Canon: StyleLock scale (readable in a gloved hand). Vision (colony support).
Turn-in: PR Tether-4.1.1 against develop.$d$,
    'Code', 'Easy', 'Small', true, 10, null
  ),
  (
    'Tether-4.1.2', 'Tether-4.1',
    'Tether-4.1.2 Carry 1 or 2, plus a deliberate drop',
    $d$Goal: carrying costs inventory space and can be put down on purpose.

Steps:
1. Lock a carry limit of 1 or 2. Write the chosen number on this card when you pick it.
2. Block pickup when the pawn is already at the limit.
3. Add a deliberate drop action. Drop is not “walk off the world and lose it.”
4. Dropped item can be picked up again.
Do not add weight vs L100, drain, or walk-speed penalty.

Output: carry component or equivalent on the pawn, limit documented on the card.
Canon: GDD Epic 4 band (1 or 2). TetherRules.txt (do not invent a weight number).
Turn-in: PR Tether-4.1.2 against develop.$d$,
    'Code', 'Easy', 'Small', true, 20, null
  ),
  (
    'Tether-4.1.3', 'Tether-4.1',
    'Tether-4.1.3 Place at least six nodes on a test map',
    $d$Goal: the prefab is used as a route, not a single button test.

Steps:
1. Place at least six ResourceNode instances on TetherPrototype or a small test map.
2. Spread them so a player walks between pickups. Do not stack them on one pad.
3. Confirm each instance uses the same prefab.
Do not build Level_01_Surface for this card.

Output: saved map with six plus nodes.
Canon: StyleLock floor tile 200 cm. TetherPrototype.md (harness map is allowed).
Turn-in: PR Tether-4.1.3 against develop.$d$,
    'Level Design', 'Easy', 'Small', true, 30, null
  ),
  (
    'Tether-4.2', 'Tether-4',
    'Tether-4.2 Warp and session total',
    $d$Warp and session total.
Done when carried count moves into a run total, hands are empty, and the total stays visible.$d$,
    'Code', 'Medium', 'Medium', false, 20, 'Tether-4.2 Checkpoint warp and session total'
  ),
  (
    'Tether-4.2.1', 'Tether-4.2',
    'Tether-4.2.1 Warp transfers carry into a session total',
    $d$Goal: a warp volume banks what the pawn is holding.

Steps:
1. Create a graybox warp / checkpoint in Content/Tether/Interact.
2. Standing in the volume and confirming moves carried count into a session total.
3. Clear the pawn carry after a successful bank.
4. Session total persists for the rest of the run. It is not a per-player backpack after the bank.

Output: warp actor plus session total.
Canon: StyleLock (small portal that sends resources home). Vision.
Turn-in: PR Tether-4.2.1 against develop.$d$,
    'Code', 'Easy', 'Small', true, 10, null
  ),
  (
    'Tether-4.2.2', 'Tether-4.2',
    'Tether-4.2.2 Placeholder confirm',
    $d$Goal: the player can tell the bank happened.

Steps:
1. On successful warp, play one placeholder confirm: print, flash, or short cue.
2. Do not build the final UI epic here.

Output: confirm on successful bank only.
Canon: none beyond readable feedback.
Turn-in: PR Tether-4.2.2 against develop.$d$,
    'Code', 'Easy', 'Small', true, 20, null
  ),
  (
    'Tether-4.2.3', 'Tether-4.2',
    'Tether-4.2.3 Running total stays visible',
    $d$Goal: after a bank, both clients can still see the session total.

Steps:
1. Show the running session total on screen. Debug text is enough.
2. Update it when a warp succeeds.
3. Do not hide the number after the confirm.

Output: visible session total on the test map.
Canon: GDD Epic 4 done-when line (collect, carry, warp, total updates).
Turn-in: PR Tether-4.2.3 against develop.$d$,
    'Code', 'Easy', 'Small', true, 30, null
  );

  foreach v_scope in array array['staging', 'public']
  loop
    for r in
      select *
      from tmp_tether4
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
          and t.board_scope = v_scope
          and (
            t.title like r.parent_code || ' %'
            and t.title not like r.parent_code || '.%'
          )
        order by t.archived_at nulls first, t.created_at
        limit 1;
      end if;

      select t.id into v_id
      from public.tasks t
      where t.project_id = v_project
        and t.board_scope = v_scope
        and (
          t.title = r.title
          or (r.match_old is not null and t.title = r.match_old)
          or (
            t.title like r.code || ' %'
            and t.title not like r.code || '.%'
          )
        )
      order by t.archived_at nulls first, t.created_at
      limit 1;

      if v_id is null then
        insert into public.tasks (
          project_id, parent_task_id, title, description, category, difficulty,
          estimated_effort, status, subtasks, staff_only, board_scope, sort_order
        ) values (
          v_project, v_parent, r.title, r.description, r.category, r.difficulty,
          r.estimated_effort, 'ToDo', '[]'::jsonb, r.staff_only, v_scope, r.sort_order
        )
        returning id into v_id;
        v_created := v_created + 1;
      else
        update public.tasks
        set
          title = r.title,
          description = r.description,
          category = r.category,
          difficulty = r.difficulty,
          estimated_effort = r.estimated_effort,
          staff_only = r.staff_only,
          parent_task_id = v_parent,
          sort_order = r.sort_order,
          archived_at = case
            when v_scope = 'staging' then null
            else archived_at
          end
        where id = v_id;
        v_updated := v_updated + 1;
      end if;
    end loop;
  end loop;

  -- Link staging twins to public siblings by title.
  update public.tasks s
  set
    published_task_id = p.id,
    published_at = coalesce(s.published_at, now())
  from public.tasks p
  where s.project_id = v_project
    and p.project_id = v_project
    and s.board_scope = 'staging'
    and p.board_scope = 'public'
    and p.archived_at is null
    and s.title = p.title
    and s.title ~ '^Tether-4([. ]|$)'
    and s.published_task_id is distinct from p.id;

  -- Tether-3 is Done. Drop linear 3.1 / 4.1 locks on this epic.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and (
      (
        a.title ~ '^Tether-4([. ]|$)'
        and b.title ~ '^Tether-3'
      )
      or (
        a.title ~ '^Tether-4\.2([. ]|$)'
        and b.title ~ '^Tether-4\.1([. ]|$)'
        and b.title !~ '^Tether-4\.1\.[0-9]'
      )
    );

  -- Maps are not a blocker on Tether-4, and Tether-4 is not a blocker on maps.
  delete from public.task_dependencies d
  using public.tasks a, public.tasks b
  where d.task_id = a.id
    and d.blocks_on_task_id = b.id
    and a.project_id = v_project
    and (
      (a.title ~ '^Tether-4([. ]|$)' and b.title ~ '^Tether-6([. ]|$)')
      or (a.title ~ '^Tether-6([. ]|$)' and b.title ~ '^Tether-4([. ]|$)')
    );

  raise notice 'Tether-4 upsert created=% updated=%', v_created, v_updated;

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
