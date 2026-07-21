-- =============================================================================
-- Together Forge — Tasks, Claims, Activity Log, Projects
-- Paste this ENTIRE script into Supabase → SQL Editor → Run
-- Safe to re-run (idempotent where possible)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Profiles: ensure role column exists (used by useIsModerator + RLS)
-- ---------------------------------------------------------------------------
alter table if exists profiles add column if not exists role text default 'user';
-- Roles: user | contributor | project_lead | moderator | admin

-- ---------------------------------------------------------------------------
-- 1. Projects (workspace hubs; slug matches /projects/:id routes)
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  phase text default 'Early',
  status text default 'In Development',
  created_at timestamptz default now()
);

create index if not exists idx_projects_slug on projects (slug);

-- ---------------------------------------------------------------------------
-- 2. Tasks
-- ---------------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  category text,
  difficulty text,
  status text not null default 'ToDo'
    check (status in ('ToDo', 'InProgress', 'Completed')),
  estimated_effort text,
  subtasks jsonb default '[]'::jsonb,
  created_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_tasks_project on tasks (project_id);
create index if not exists idx_tasks_status on tasks (status);

-- ---------------------------------------------------------------------------
-- 3. Task claims (one Active claim per task recommended / enforced)
-- ---------------------------------------------------------------------------
create table if not exists task_claims (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  claimed_at timestamptz default now(),
  progress_percent integer not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  last_activity_at timestamptz default now(),
  status text not null default 'Active'
    check (status in ('Active', 'Completed', 'Returned')),
  helpers jsonb default '[]'::jsonb,
  notes text
);

create index if not exists idx_task_claims_task on task_claims (task_id);
create index if not exists idx_task_claims_user on task_claims (user_id);
create index if not exists idx_task_claims_status on task_claims (status);

-- Only one Active claim per task
create unique index if not exists idx_one_active_claim_per_task
  on task_claims (task_id)
  where status = 'Active';

-- ---------------------------------------------------------------------------
-- 4. Activity log (claims, progress, completions, returns)
-- ---------------------------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text default 'task',
  target_id uuid,
  target_title text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_activity_project on activity_log (project_id, created_at desc);
create index if not exists idx_activity_created on activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Helper: staff check for RLS (admin / moderator / project_lead)
-- ---------------------------------------------------------------------------
create or replace function public.is_project_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and coalesce(role, 'user') in ('admin', 'moderator', 'project_lead')
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table projects enable row level security;
alter table tasks enable row level security;
alter table task_claims enable row level security;
alter table activity_log enable row level security;

-- Projects: public read; staff write
drop policy if exists "Public can read projects" on projects;
create policy "Public can read projects" on projects for select using (true);

drop policy if exists "Staff can insert projects" on projects;
create policy "Staff can insert projects" on projects for insert
  with check (public.is_project_staff());

drop policy if exists "Staff can update projects" on projects;
create policy "Staff can update projects" on projects for update
  using (public.is_project_staff());

drop policy if exists "Staff can delete projects" on projects;
create policy "Staff can delete projects" on projects for delete
  using (public.is_project_staff());

-- Tasks: public read; staff create/edit/delete
drop policy if exists "Public can read tasks" on tasks;
create policy "Public can read tasks" on tasks for select using (true);

drop policy if exists "Staff can insert tasks" on tasks;
create policy "Staff can insert tasks" on tasks for insert
  with check (public.is_project_staff());

drop policy if exists "Staff can update tasks" on tasks;
create policy "Staff can update tasks" on tasks for update
  using (public.is_project_staff());

drop policy if exists "Staff can delete tasks" on tasks;
create policy "Staff can delete tasks" on tasks for delete
  using (public.is_project_staff());

-- Authenticated members can update task status when they hold the active claim
-- (used by claim/complete flows from the client). Staff already covered above.
drop policy if exists "Claimants can update claimed tasks" on tasks;
create policy "Claimants can update claimed tasks" on tasks for update
  using (
    auth.uid() is not null
    and exists (
      select 1 from task_claims tc
      where tc.task_id = tasks.id
        and tc.user_id = auth.uid()
        and tc.status = 'Active'
    )
  );

-- Task claims: public read; members insert own; own or staff update
drop policy if exists "Public can read task_claims" on task_claims;
create policy "Public can read task_claims" on task_claims for select using (true);

drop policy if exists "Members can claim tasks" on task_claims;
create policy "Members can claim tasks" on task_claims for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners or staff can update claims" on task_claims;
create policy "Owners or staff can update claims" on task_claims for update
  using (auth.uid() = user_id or public.is_project_staff());

drop policy if exists "Owners or staff can delete claims" on task_claims;
create policy "Owners or staff can delete claims" on task_claims for delete
  using (auth.uid() = user_id or public.is_project_staff());

-- Activity log: public read; authenticated insert own rows
drop policy if exists "Public can read activity_log" on activity_log;
create policy "Public can read activity_log" on activity_log for select using (true);

drop policy if exists "Members can insert activity" on activity_log;
create policy "Members can insert activity" on activity_log for insert
  with check (auth.uid() = user_id or public.is_project_staff());

-- ---------------------------------------------------------------------------
-- 7. Seed demo projects + tasks (skip if slug already exists)
-- ---------------------------------------------------------------------------
insert into projects (slug, title, description, phase, status)
values
  (
    'prototype-systems',
    'Prototype Systems',
    'Core loop prototyping and networking tests. We are validating multiplayer foundations, claim/credit flows, and the volunteer task board itself — with design, code, and art volunteers welcome.',
    'Early',
    'In Development'
  ),
  (
    'core-features',
    'Core Features Sprint',
    'Design work and early integrations for systems that make cooperative play feel great. Focused sprints, clear ownership, and public progress.',
    'Mid',
    'Planning'
  ),
  (
    'polish-playtests',
    'Stability & Polish',
    'Polish passes, optimization, and wider playtests. Help stress-test builds and report what breaks — or what delights.',
    'Late',
    'Vision'
  )
on conflict (slug) do nothing;

-- Seed tasks only when project has none yet
do $$
declare
  pid uuid;
  task_count int;
begin
  select id into pid from projects where slug = 'prototype-systems';
  if pid is null then
    return;
  end if;

  select count(*) into task_count from tasks where project_id = pid;
  if task_count > 0 then
    return;
  end if;

  insert into tasks (project_id, title, description, category, difficulty, status, estimated_effort, subtasks)
  values
    (pid, 'Design core loop doc', 'Short doc for the collect → deliver → defend loop.', 'Design', 'Medium', 'ToDo', '2-4h',
      '[{"id":"s1","label":"Outline loop stages","done":false},{"id":"s2","label":"Share for feedback","done":false}]'::jsonb),
    (pid, 'Enemy pathing prototype', 'Simple pathfinding and chase for early playtests.', 'Code', 'Hard', 'ToDo', '1 day',
      '[{"id":"s1","label":"Basic chase AI","done":false},{"id":"s2","label":"Obstacle avoidance","done":false}]'::jsonb),
    (pid, 'Networking stomp test', 'Packet-loss tolerance and prediction smoke test.', 'Code', 'Hard', 'ToDo', '4-6h', '[]'::jsonb),
    (pid, 'Collectible item icons', 'Quick icons for prototype pickups and resources.', 'Art', 'Easy', 'ToDo', '2h', '[]'::jsonb),
    (pid, 'Prototype player movement', 'Basic movement with interpolation and jitter fixes.', 'Code', 'Hard', 'ToDo', '1 day',
      '[{"id":"s1","label":"Client prediction","done":false},{"id":"s2","label":"Server reconciliation","done":false}]'::jsonb),
    (pid, 'UI mockups for HUD', 'HUD mockups for resources, objectives, and party status.', 'Design', 'Medium', 'ToDo', '3-5h', '[]'::jsonb),
    (pid, 'Add task claim UI', 'Frontend for claiming tasks and progress notes.', 'Code', 'Medium', 'ToDo', '4h',
      '[{"id":"s1","label":"Claim button","done":false},{"id":"s2","label":"Progress modal","done":false}]'::jsonb),
    (pid, 'Demo map layout', 'Small test map with spawn points for playtests.', 'Level Design', 'Easy', 'ToDo', '3h', '[]'::jsonb),
    (pid, 'Placeholder art set A', 'Placeholder sprites/models for quick playtests.', 'Art', 'Easy', 'ToDo', '4h', '[]'::jsonb),
    (pid, 'Tutorial text flow', 'First-time player prompts for the prototype session.', 'Writing', 'Medium', 'ToDo', '2h', '[]'::jsonb);
end $$;

-- Optional: verify
-- select slug, title from projects;
-- select title, status from tasks t join projects p on p.id = t.project_id where p.slug = 'prototype-systems';

-- ---------------------------------------------------------------------------
-- 8. Atomic RPCs (SECURITY DEFINER) — claim / progress / complete / return
-- Run after tables + RLS above. Safe to re-run.
-- ---------------------------------------------------------------------------

create or replace function public.claim_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in to claim a task';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status = 'Completed' then
    raise exception 'This task is already completed';
  end if;

  if exists (
    select 1 from task_claims
    where task_id = p_task_id and status = 'Active'
  ) then
    raise exception 'This task is already claimed';
  end if;

  -- Cap concurrent claims per volunteer (site-wide)
  if (
    select count(*) from task_claims
    where user_id = v_uid and status = 'Active'
  ) >= 5 then
    raise exception 'You already have 5 active tasks. Finish or return one before claiming another.';
  end if;

  insert into task_claims (task_id, user_id, status, progress_percent, last_activity_at)
  values (p_task_id, v_uid, 'Active', 0, now())
  returning * into v_claim;

  update tasks
  set status = 'InProgress'
  where id = p_task_id;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'claimed',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object('claim_id', v_claim.id)
  );

  return jsonb_build_object('claim', to_jsonb(v_claim), 'task_id', p_task_id, 'status', 'InProgress');
end;
$$;

create or replace function public.update_task_progress(
  p_task_id uuid,
  p_progress_percent integer default null,
  p_subtasks jsonb default null,
  p_notes text default null,
  p_helpers jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'Active'
  for update;

  if not found then
    raise exception 'No active claim on this task';
  end if;

  if v_claim.user_id <> v_uid and not v_is_staff then
    raise exception 'Only the claimant or project staff can update progress';
  end if;

  if p_progress_percent is not null then
    if p_progress_percent < 0 or p_progress_percent > 100 then
      raise exception 'Progress must be between 0 and 100';
    end if;
  end if;

  update task_claims set
    progress_percent = coalesce(p_progress_percent, progress_percent),
    notes = coalesce(p_notes, notes),
    helpers = coalesce(p_helpers, helpers),
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  if p_subtasks is not null then
    update tasks set subtasks = p_subtasks where id = p_task_id
    returning * into v_task;
  end if;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'updated progress on',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'progress_percent', v_claim.progress_percent,
      'claim_id', v_claim.id
    )
  );

  return jsonb_build_object('claim', to_jsonb(v_claim), 'task', to_jsonb(v_task));
end;
$$;

create or replace function public.complete_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'Active'
  for update;

  if found then
    if v_claim.user_id <> v_uid and not v_is_staff then
      raise exception 'Only the claimant or project staff can complete this task';
    end if;

    update task_claims set
      status = 'Completed',
      progress_percent = 100,
      last_activity_at = now()
    where id = v_claim.id
    returning * into v_claim;
  elsif not v_is_staff then
    raise exception 'No active claim — claim the task first, or ask a project lead';
  end if;

  update tasks set
    status = 'Completed',
    completed_at = now(),
    subtasks = (
      select coalesce(jsonb_agg(
        case
          when jsonb_typeof(elem) = 'object'
            then elem || jsonb_build_object('done', true)
          else elem
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(coalesce(v_task.subtasks, '[]'::jsonb)) elem
    )
  where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'completed',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object('claim_id', v_claim.id)
  );

  return jsonb_build_object('task', to_jsonb(v_task), 'claim', to_jsonb(v_claim));
end;
$$;

create or replace function public.return_task_claim(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'Active'
  for update;

  if not found then
    raise exception 'No active claim to return';
  end if;

  if v_claim.user_id <> v_uid and not v_is_staff then
    raise exception 'Only the claimant or project staff can return this claim';
  end if;

  update task_claims set
    status = 'Returned',
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  update tasks set
    status = 'ToDo',
    completed_at = null
  where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'returned',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object('claim_id', v_claim.id)
  );

  return jsonb_build_object('task', to_jsonb(v_task), 'claim', to_jsonb(v_claim));
end;
$$;

-- Stale claim helper: return Active claims with no activity for N days (default 14)
-- Call manually or schedule via pg_cron / Edge Function later.
create or replace function public.return_stale_claims(p_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select tc.id as claim_id, tc.task_id, t.project_id, t.title, tc.user_id
    from task_claims tc
    join tasks t on t.id = tc.task_id
    where tc.status = 'Active'
      and tc.last_activity_at < now() - make_interval(days => p_days)
  loop
    update task_claims set status = 'Returned', last_activity_at = now()
    where id = r.claim_id;

    update tasks set status = 'ToDo', completed_at = null
    where id = r.task_id and status = 'InProgress';

    insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
    values (
      r.project_id,
      r.user_id,
      'auto-returned',
      'task',
      r.task_id,
      r.title,
      jsonb_build_object('reason', 'stale', 'days', p_days, 'claim_id', r.claim_id)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Allow authenticated clients to execute RPCs
grant execute on function public.claim_task(uuid) to authenticated;
grant execute on function public.update_task_progress(uuid, integer, jsonb, text, jsonb) to authenticated;
grant execute on function public.complete_task(uuid) to authenticated;
grant execute on function public.return_task_claim(uuid) to authenticated;
grant execute on function public.return_stale_claims(integer) to authenticated;
grant execute on function public.is_project_staff() to authenticated, anon;

