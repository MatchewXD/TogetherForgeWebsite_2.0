-- Suggested Tasks: volunteer proposals staff review before Staging.
-- Not a public board state. Volunteers never see other people's suggestions.
-- Accept copies the card onto Staging. Strike is for troll / fake / malicious
-- / off-project political campaigning. Three strikes lock the author out.
-- Safe to re-run.

create table if not exists public.task_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text,
  difficulty text,
  estimated_effort text,
  subtasks jsonb not null default '[]'::jsonb,
  parent_task_id uuid references public.tasks(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'struck')),
  reject_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  accepted_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_suggestions_title_len check (
    char_length(btrim(title)) between 8 and 120
  ),
  constraint task_suggestions_desc_len check (
    description is null or char_length(description) <= 2000
  )
);

create index if not exists idx_task_suggestions_project_status
  on public.task_suggestions (project_id, status, created_at desc);

create index if not exists idx_task_suggestions_author
  on public.task_suggestions (created_by, created_at desc);

comment on table public.task_suggestions is
  'Volunteer task proposals. Staff accept onto Staging, reject with a reason, or strike.';

create table if not exists public.task_suggestion_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  strike_count integer not null default 0,
  locked_at timestamptz,
  last_strike_at timestamptz,
  last_strike_suggestion_id uuid references public.task_suggestions(id)
    on delete set null,
  notice_seen_count integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.task_suggestion_accounts is
  'Per-user suggestion strike count. Three strikes lock further suggestions.';

create or replace function public.touch_task_suggestions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_task_suggestions_updated_at on public.task_suggestions;
create trigger trg_task_suggestions_updated_at
  before update on public.task_suggestions
  for each row
  execute function public.touch_task_suggestions_updated_at();

alter table public.task_suggestions enable row level security;
alter table public.task_suggestion_accounts enable row level security;

grant select on public.task_suggestions to authenticated;
grant select on public.task_suggestion_accounts to authenticated;

drop policy if exists "Authors read own task suggestions" on public.task_suggestions;
create policy "Authors read own task suggestions"
  on public.task_suggestions for select
  using (auth.uid() = created_by or public.is_project_staff());

drop policy if exists "Staff read all task suggestions" on public.task_suggestions;
-- covered by the policy above

drop policy if exists "No direct suggestion writes" on public.task_suggestions;
-- Inserts go through submit_task_suggestion (definer). Block table inserts.
drop policy if exists "Authors insert own task suggestions" on public.task_suggestions;

drop policy if exists "Users read own suggestion account" on public.task_suggestion_accounts;
create policy "Users read own suggestion account"
  on public.task_suggestion_accounts for select
  using (auth.uid() = user_id or public.is_project_staff());

drop policy if exists "Staff manage suggestion accounts" on public.task_suggestion_accounts;
create policy "Staff manage suggestion accounts"
  on public.task_suggestion_accounts for all
  using (public.is_project_staff())
  with check (public.is_project_staff());

-- ---------------------------------------------------------------------------
-- Submit
-- ---------------------------------------------------------------------------
create or replace function public.submit_task_suggestion(
  p_project_id uuid,
  p_title text,
  p_description text default null,
  p_category text default null,
  p_difficulty text default null,
  p_estimated_effort text default null,
  p_subtasks jsonb default '[]'::jsonb,
  p_parent_task_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_acct public.task_suggestion_accounts%rowtype;
  v_pending int;
  v_recent int;
  v_parent public.tasks%rowtype;
  v_row public.task_suggestions%rowtype;
  v_sub jsonb := coalesce(p_subtasks, '[]'::jsonb);
begin
  if v_uid is null then
    raise exception 'Sign in to suggest a task.';
  end if;
  if p_project_id is null then
    raise exception 'Project is required.';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Project not found.';
  end if;
  if char_length(v_title) < 8 or char_length(v_title) > 120 then
    raise exception 'Title must be 8 to 120 characters.';
  end if;
  if v_desc is not null and char_length(v_desc) > 2000 then
    raise exception 'Description is too long.';
  end if;
  if jsonb_typeof(v_sub) is distinct from 'array' then
    v_sub := '[]'::jsonb;
  end if;

  insert into public.task_suggestion_accounts (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_acct
  from public.task_suggestion_accounts
  where user_id = v_uid
  for update;

  if v_acct.strike_count >= 3 or v_acct.locked_at is not null then
    raise exception 'SUGGEST_LOCKED: You have three task board suggestion strikes and can no longer suggest tasks.';
  end if;

  select count(*)::int into v_pending
  from public.task_suggestions
  where created_by = v_uid and status = 'pending';
  if v_pending >= 5 then
    raise exception 'You already have 5 suggestions waiting on staff. Wait for a review before sending more.';
  end if;

  select count(*)::int into v_recent
  from public.task_suggestions
  where created_by = v_uid
    and created_at > now() - interval '24 hours';
  if v_recent >= 8 then
    raise exception 'You can send at most 8 task suggestions per day.';
  end if;

  if p_parent_task_id is not null then
    select * into v_parent from public.tasks where id = p_parent_task_id;
    if not found or v_parent.project_id is distinct from p_project_id then
      raise exception 'That parent task is not on this project.';
    end if;
    if v_parent.archived_at is not null then
      raise exception 'That parent task is no longer on the board.';
    end if;
  end if;

  insert into public.task_suggestions (
    project_id, created_by, title, description, category, difficulty,
    estimated_effort, subtasks, parent_task_id, status
  ) values (
    p_project_id, v_uid, v_title, v_desc, nullif(p_category, ''),
    nullif(p_difficulty, ''), nullif(p_estimated_effort, ''),
    v_sub, p_parent_task_id, 'pending'
  )
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'title', v_row.title
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff review: accept | reject | strike
-- ---------------------------------------------------------------------------
create or replace function public.review_task_suggestion(
  p_suggestion_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.task_suggestions%rowtype;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_parent uuid;
  v_parent_row public.tasks%rowtype;
  v_depth int := 0;
  v_new_task uuid;
  v_acct public.task_suggestion_accounts%rowtype;
  v_strikes int;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;
  if not public.is_project_staff() then
    raise exception 'Only staff can review suggested tasks.';
  end if;
  if v_action not in ('accept', 'reject', 'strike') then
    raise exception 'Action must be accept, reject, or strike.';
  end if;

  select * into v_row
  from public.task_suggestions
  where id = p_suggestion_id
  for update;
  if not found then
    raise exception 'Suggestion not found.';
  end if;
  if v_row.status is distinct from 'pending' then
    raise exception 'That suggestion was already reviewed.';
  end if;

  if v_action = 'reject' then
    if v_reason is null or char_length(v_reason) < 8 then
      raise exception 'Write a short reason so the author knows why this was rejected.';
    end if;
    update public.task_suggestions
    set
      status = 'rejected',
      reject_reason = v_reason,
      reviewed_by = v_uid,
      reviewed_at = now()
    where id = v_row.id;
    return jsonb_build_object('id', v_row.id, 'status', 'rejected');
  end if;

  if v_action = 'strike' then
    insert into public.task_suggestion_accounts (user_id)
    values (v_row.created_by)
    on conflict (user_id) do nothing;

    select * into v_acct
    from public.task_suggestion_accounts
    where user_id = v_row.created_by
    for update;

    v_strikes := least(3, coalesce(v_acct.strike_count, 0) + 1);

    update public.task_suggestion_accounts
    set
      strike_count = v_strikes,
      last_strike_at = now(),
      last_strike_suggestion_id = v_row.id,
      locked_at = case when v_strikes >= 3 then coalesce(locked_at, now()) else locked_at end,
      updated_at = now()
    where user_id = v_row.created_by;

    update public.task_suggestions
    set
      status = 'struck',
      reject_reason = coalesce(
        v_reason,
        'Struck: troll, fake, malicious, or off-project political campaigning.'
      ),
      reviewed_by = v_uid,
      reviewed_at = now()
    where id = v_row.id;

    return jsonb_build_object(
      'id', v_row.id,
      'status', 'struck',
      'strike_count', v_strikes,
      'locked', v_strikes >= 3
    );
  end if;

  -- accept → Staging copy
  v_parent := v_row.parent_task_id;
  if v_parent is not null then
    select * into v_parent_row from public.tasks where id = v_parent;
    if not found or v_parent_row.project_id is distinct from v_row.project_id
       or v_parent_row.archived_at is not null then
      v_parent := null;
    elsif coalesce(v_parent_row.board_scope, 'public') is distinct from 'staging' then
      select t.id into v_parent
      from public.tasks t
      where t.project_id = v_row.project_id
        and t.board_scope = 'staging'
        and t.archived_at is null
        and t.published_task_id = v_parent_row.id
      order by t.created_at
      limit 1;
      if v_parent is null then
        -- Parent is public-only; drop nest so staff can place it on Staging.
        v_parent := null;
      end if;
    end if;
  end if;

  if v_parent is not null then
    begin
      v_depth := public.task_nesting_depth(v_parent);
    exception when undefined_function then
      v_depth := 0;
    end;
    if v_depth >= 2 then
      v_parent := null;
    end if;
  end if;

  insert into public.tasks (
    project_id, parent_task_id, title, description, category, difficulty,
    estimated_effort, status, subtasks, staff_only, board_scope, sort_order,
    created_by
  ) values (
    v_row.project_id,
    v_parent,
    v_row.title,
    v_row.description,
    v_row.category,
    v_row.difficulty,
    v_row.estimated_effort,
    'ToDo',
    coalesce(v_row.subtasks, '[]'::jsonb),
    false,
    'staging',
    0,
    v_row.created_by
  )
  returning id into v_new_task;

  update public.task_suggestions
  set
    status = 'accepted',
    reviewed_by = v_uid,
    reviewed_at = now(),
    accepted_task_id = v_new_task
  where id = v_row.id;

  return jsonb_build_object(
    'id', v_row.id,
    'status', 'accepted',
    'accepted_task_id', v_new_task
  );
end;
$$;

create or replace function public.dismiss_task_suggestion_strike_notice()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  update public.task_suggestion_accounts
  set
    notice_seen_count = strike_count,
    updated_at = now()
  where user_id = v_uid
  returning strike_count into v_count;
  return jsonb_build_object('ok', true, 'strike_count', coalesce(v_count, 0));
end;
$$;

grant execute on function public.submit_task_suggestion(uuid, text, text, text, text, text, jsonb, uuid)
  to authenticated;
grant execute on function public.review_task_suggestion(uuid, text, text)
  to authenticated;
grant execute on function public.dismiss_task_suggestion_strike_notice()
  to authenticated;
