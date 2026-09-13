-- =============================================================================
-- Polls — staff-written short lists. Members pick one option.
-- Votes inform staff. They do not lock Tether, StyleLock, or any task.
-- No write-in, comments, ranked choice, multi-vote, or weighted votes.
-- Run AFTER is_project_staff() exists (supabase_tasks_schema.sql).
-- Safe to re-run.
-- =============================================================================

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  opened_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  title text not null,
  context text,
  project_tag text,
  status text not null default 'draft'
    check (status in ('draft', 'live', 'closed')),
  closes_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint polls_title_len check (
    char_length(trim(title)) >= 4 and char_length(trim(title)) <= 120
  ),
  constraint polls_context_len check (
    context is null or char_length(context) <= 500
  ),
  constraint polls_staff_note_len check (
    staff_note is null or char_length(staff_note) <= 200
  ),
  constraint polls_project_tag_ok check (
    project_tag is null or project_tag in ('tether', 'studio', 'other')
  )
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  sort_order integer not null default 0,
  name text not null,
  description text not null,
  vote_count integer not null default 0,
  is_none boolean not null default false,
  constraint poll_options_name_len check (
    char_length(trim(name)) >= 1 and char_length(trim(name)) <= 48
  ),
  constraint poll_options_description_len check (
    char_length(trim(description)) >= 1 and char_length(trim(description)) <= 160
  ),
  constraint poll_options_vote_count_nonneg check (vote_count >= 0)
);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists idx_polls_status_created
  on public.polls (status, created_at desc);

create index if not exists idx_polls_closes_at
  on public.polls (closes_at)
  where status = 'live' and closes_at is not null;

create index if not exists idx_poll_options_poll
  on public.poll_options (poll_id, sort_order);

create index if not exists idx_poll_votes_option
  on public.poll_votes (option_id);

create unique index if not exists idx_poll_options_poll_sort
  on public.poll_options (poll_id, sort_order);

create unique index if not exists idx_poll_options_one_none
  on public.poll_options (poll_id)
  where is_none;

comment on table public.polls is
  'Staff-directed polls. Members pick one option. Votes inform staff; they do not lock work.';
comment on table public.poll_options is
  'Two to eight options per poll. vote_count is denormalized; public sees counts, not names.';
comment on table public.poll_votes is
  'One account, one option per poll. Voter may change until the poll closes.';

create or replace function public.touch_polls_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_polls_updated_at on public.polls;
create trigger trg_polls_updated_at
  before update on public.polls
  for each row
  execute function public.touch_polls_updated_at();

create or replace function public.touch_poll_votes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_poll_votes_updated_at on public.poll_votes;
create trigger trg_poll_votes_updated_at
  before update on public.poll_votes
  for each row
  execute function public.touch_poll_votes_updated_at();

-- Status machine: draft → live → closed. Closed stays closed.
create or replace function public.ensure_poll_none_option(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.poll_options (
    poll_id, sort_order, name, description, is_none
  )
  select p_poll_id, 100, 'None of these', 'I do not want any of these.', true
  where not exists (
    select 1 from public.poll_options o
    where o.poll_id = p_poll_id and o.is_none
  );
end;
$$;

create or replace function public.enforce_poll_status()
returns trigger
language plpgsql
as $$
declare
  v_staff int;
  v_none int;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'closed' and new.status is distinct from 'closed' then
      raise exception 'Closed polls stay closed.';
    end if;
    if old.status = 'live' and new.status = 'draft' then
      raise exception 'A live poll cannot return to draft. Close it instead.';
    end if;
  end if;

  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    perform public.ensure_poll_none_option(new.id);
    select count(*) filter (where not is_none),
           count(*) filter (where is_none)
      into v_staff, v_none
    from public.poll_options
    where poll_id = new.id;
    if v_staff < 2 or v_staff > 8 then
      raise exception 'A live poll needs between 2 and 8 staff options.';
    end if;
    if v_none <> 1 then
      raise exception 'A live poll needs the built-in None of these option.';
    end if;
    new.opened_at := coalesce(new.opened_at, now());
    if new.opened_by is null then
      new.opened_by := auth.uid();
    end if;
  end if;

  if new.status = 'closed' and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    new.closed_at := coalesce(new.closed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_poll_status on public.polls;
create trigger trg_enforce_poll_status
  before insert or update of status, opened_at, opened_by, closed_at
  on public.polls
  for each row
  execute function public.enforce_poll_status();

create or replace function public.enforce_poll_option_count()
returns trigger
language plpgsql
as $$
declare
  v_poll uuid;
  v_status text;
  v_staff int;
  v_none int;
  v_is_none boolean;
begin
  v_poll := coalesce(new.poll_id, old.poll_id);
  v_is_none := coalesce(new.is_none, old.is_none, false);
  select status into v_status from public.polls where id = v_poll;
  select count(*) filter (where not is_none),
         count(*) filter (where is_none)
    into v_staff, v_none
  from public.poll_options
  where poll_id = v_poll;

  if v_staff > 8 then
    raise exception 'A poll can have at most 8 staff options.';
  end if;

  if coalesce(v_status, 'draft') is distinct from 'draft' and v_staff < 2 then
    raise exception 'A poll needs at least 2 staff options.';
  end if;

  if v_none > 1 then
    raise exception 'A poll can have only one None of these option.';
  end if;

  if tg_op = 'DELETE' and coalesce(old.is_none, false) then
    raise exception 'None of these cannot be removed.';
  end if;

  if tg_op = 'UPDATE' and old.is_none and (
       new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.is_none is distinct from old.is_none
  ) then
    raise exception 'None of these cannot be edited.';
  end if;

  if coalesce(v_status, 'draft') in ('live', 'closed') then
    if tg_op = 'INSERT' and v_is_none then
      null;
    elsif not v_is_none then
      raise exception 'Staff options cannot change after a poll opens.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enforce_poll_option_count on public.poll_options;
create trigger trg_enforce_poll_option_count
  after insert or delete or update of poll_id, name, description, is_none
  on public.poll_options
  for each row
  execute function public.enforce_poll_option_count();

create or replace function public.enforce_poll_vote()
returns trigger
language plpgsql
as $$
declare
  v_poll public.polls%rowtype;
  v_opt public.poll_options%rowtype;
begin
  perform public.close_expired_polls();

  select * into v_poll from public.polls where id = new.poll_id;
  if not found then
    raise exception 'Poll not found';
  end if;

  if v_poll.status is distinct from 'live' then
    raise exception 'This poll is not open for votes.';
  end if;

  select * into v_opt from public.poll_options where id = new.option_id;
  if not found or v_opt.poll_id is distinct from new.poll_id then
    raise exception 'That option is not on this poll.';
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'You can only vote as yourself.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_poll_vote on public.poll_votes;
create trigger trg_enforce_poll_vote
  before insert or update of option_id, poll_id, user_id
  on public.poll_votes
  for each row
  execute function public.enforce_poll_vote();

create or replace function public.refresh_poll_option_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.option_id is distinct from new.option_id then
    update public.poll_options o
    set vote_count = (
      select count(*)::integer from public.poll_votes v where v.option_id = o.id
    )
    where o.id in (old.option_id, new.option_id);
  elsif tg_op = 'INSERT' then
    update public.poll_options o
    set vote_count = (
      select count(*)::integer from public.poll_votes v where v.option_id = o.id
    )
    where o.id = new.option_id;
  elsif tg_op = 'DELETE' then
    update public.poll_options o
    set vote_count = (
      select count(*)::integer from public.poll_votes v where v.option_id = o.id
    )
    where o.id = old.option_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_poll_option_vote_count on public.poll_votes;
create trigger trg_refresh_poll_option_vote_count
  after insert or delete or update of option_id
  on public.poll_votes
  for each row
  execute function public.refresh_poll_option_vote_count();

create or replace function public.close_expired_polls()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
begin
  update public.polls
  set status = 'closed',
      closed_at = coalesce(closed_at, now())
  where status = 'live'
    and closes_at is not null
    and closes_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function public.close_expired_polls() to anon, authenticated;
grant execute on function public.ensure_poll_none_option(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

grant select on table public.polls to anon, authenticated;
grant select on table public.poll_options to anon, authenticated;
grant select, insert, update, delete on table public.polls to authenticated;
grant select, insert, update, delete on table public.poll_options to authenticated;
grant select, insert, update, delete on table public.poll_votes to authenticated;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "Public can read live and closed polls" on public.polls;
create policy "Public can read live and closed polls"
  on public.polls for select
  using (
    status in ('live', 'closed')
    or public.is_project_staff()
  );

drop policy if exists "Staff can insert polls" on public.polls;
create policy "Staff can insert polls"
  on public.polls for insert
  to authenticated
  with check (
    public.is_project_staff()
    and created_by = auth.uid()
  );

drop policy if exists "Staff can update polls" on public.polls;
create policy "Staff can update polls"
  on public.polls for update
  to authenticated
  using (public.is_project_staff())
  with check (public.is_project_staff());

drop policy if exists "Staff can delete polls" on public.polls;
create policy "Staff can delete polls"
  on public.polls for delete
  to authenticated
  using (public.is_project_staff());

drop policy if exists "Public can read poll options" on public.poll_options;
create policy "Public can read poll options"
  on public.poll_options for select
  using (
    exists (
      select 1 from public.polls p
      where p.id = poll_id
        and (
          p.status in ('live', 'closed')
          or public.is_project_staff()
        )
    )
  );

drop policy if exists "Staff can insert poll options" on public.poll_options;
create policy "Staff can insert poll options"
  on public.poll_options for insert
  to authenticated
  with check (public.is_project_staff());

drop policy if exists "Staff can update poll options" on public.poll_options;
create policy "Staff can update poll options"
  on public.poll_options for update
  to authenticated
  using (public.is_project_staff())
  with check (public.is_project_staff());

drop policy if exists "Staff can delete poll options" on public.poll_options;
create policy "Staff can delete poll options"
  on public.poll_options for delete
  to authenticated
  using (public.is_project_staff());

drop policy if exists "Voters can read own poll votes" on public.poll_votes;
create policy "Voters can read own poll votes"
  on public.poll_votes for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_project_staff()
  );

drop policy if exists "Members can insert own poll votes" on public.poll_votes;
create policy "Members can insert own poll votes"
  on public.poll_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members can update own poll votes" on public.poll_votes;
create policy "Members can update own poll votes"
  on public.poll_votes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members can delete own poll votes" on public.poll_votes;
create policy "Members can delete own poll votes"
  on public.poll_votes for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
