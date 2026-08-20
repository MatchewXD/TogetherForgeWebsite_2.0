-- =============================================================================
-- Practical anti-abuse: rate limits, delayed public counts, spam checks
-- Safe to re-run. Apply after core schema, votes RLS, showcase likes, tasks.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Shared log tables
-- ---------------------------------------------------------------------------
create table if not exists public.action_rate_events (
  id uuid primary key default gen_random_uuid(),
  actor_key text not null,
  action text not null,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_action_rate_actor_action_created
  on public.action_rate_events (actor_key, action, created_at desc);

create table if not exists public.abuse_flags (
  id uuid primary key default gen_random_uuid(),
  actor_key text,
  user_id uuid,
  action text,
  reason text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_abuse_flags_created
  on public.abuse_flags (created_at desc);
create index if not exists idx_abuse_flags_user
  on public.abuse_flags (user_id, created_at desc);

alter table public.action_rate_events enable row level security;
alter table public.abuse_flags enable row level security;

drop policy if exists "Staff read rate events" on public.action_rate_events;
drop policy if exists "Staff read abuse flags" on public.abuse_flags;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_staff'
  ) then
    create policy "Staff read rate events"
      on public.action_rate_events for select
      to authenticated
      using (public.is_staff());
    create policy "Staff read abuse flags"
      on public.abuse_flags for select
      to authenticated
      using (public.is_staff());
  end if;
end $$;

grant select on public.action_rate_events to authenticated;
grant select on public.abuse_flags to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.user_bypasses_abuse_limits()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  begin
    if public.is_staff() then
      return true;
    end if;
  exception
    when undefined_function then
      null;
  end;
  begin
    if public.is_project_staff() then
      return true;
    end if;
  exception
    when undefined_function then
      null;
  end;
  begin
    if public.user_bypasses_task_limits(auth.uid()) then
      return true;
    end if;
  exception
    when undefined_function then
      null;
  end;
  return false;
end;
$$;

grant execute on function public.user_bypasses_abuse_limits() to authenticated;

create or replace function public.flag_abuse(
  p_reason text,
  p_action text default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.abuse_flags (actor_key, user_id, action, reason, meta)
  values (
    case
      when auth.uid() is not null then 'user:' || auth.uid()::text
      else 'anon'
    end,
    auth.uid(),
    p_action,
    left(coalesce(p_reason, 'flag'), 240),
    coalesce(p_meta, '{}'::jsonb)
  );
exception
  when others then
    null;
end;
$$;

create or replace function public.assert_action_allowed(
  p_action text,
  p_limit integer,
  p_window interval,
  p_min_gap interval default null,
  p_actor_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text;
  v_count integer;
  v_last timestamptz;
begin
  if public.user_bypasses_abuse_limits() then
    return;
  end if;

  v_actor := nullif(trim(coalesce(p_actor_key, '')), '');
  if v_actor is null then
    if auth.uid() is null then
      raise exception 'SIGN_IN_REQUIRED'
        using errcode = 'P0001';
    end if;
    v_actor := 'user:' || auth.uid()::text;
  end if;

  if p_min_gap is not null then
    select max(created_at) into v_last
    from public.action_rate_events
    where actor_key = v_actor
      and action = p_action;
    if v_last is not null and v_last > now() - p_min_gap then
      perform public.flag_abuse('min_gap', p_action, jsonb_build_object('gap', p_min_gap::text));
      raise exception 'RATE_LIMITED'
        using errcode = 'P0001';
    end if;
  end if;

  select count(*)::integer into v_count
  from public.action_rate_events
  where actor_key = v_actor
    and action = p_action
    and created_at > now() - p_window;

  insert into public.action_rate_events (actor_key, action, meta)
  values (
    v_actor,
    p_action,
    jsonb_build_object('window', p_window::text, 'limit', p_limit)
  );

  if coalesce(v_count, 0) >= p_limit then
    if v_count in (p_limit, p_limit + 5, p_limit + 15) then
      perform public.flag_abuse(
        'rate_window',
        p_action,
        jsonb_build_object('count', v_count + 1, 'limit', p_limit)
      );
    end if;
    raise exception 'RATE_LIMITED'
      using errcode = 'P0001';
  end if;
end;
$$;

grant execute on function public.assert_action_allowed(text, integer, interval, interval, text)
  to authenticated;

-- Delayed / lightly bucketed public metric. Exact below 10.
create or replace function public.public_count_display(p_true integer, p_salt text)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_true, 0) < 10 then greatest(0, coalesce(p_true, 0))
    else greatest(
      0,
      (round(coalesce(p_true, 0) / 5.0) * 5)::integer
        + (('x' || substr(md5(coalesce(p_salt, 'x')), 1, 4))::bit(16)::int % 5)
        - 2
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Ideas: public_id, delayed votes, vote RPC, submit spam checks
-- ---------------------------------------------------------------------------
alter table public.ideas add column if not exists votes_public integer;
alter table public.ideas add column if not exists votes_public_at timestamptz;
alter table public.ideas add column if not exists public_id uuid;

update public.ideas
set public_id = gen_random_uuid()
where public_id is null;

create unique index if not exists idx_ideas_public_id
  on public.ideas (public_id);

alter table public.ideas
  alter column public_id set default gen_random_uuid();

update public.ideas
set
  votes_public = public.public_count_display(coalesce(votes, 0), id::text),
  votes_public_at = coalesce(votes_public_at, now())
where votes_public is null;

revoke update (votes, votes_public, votes_public_at) on table public.ideas
  from anon, authenticated;

create or replace function public.refresh_idea_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_idea bigint;
  new_count integer;
  due boolean;
begin
  target_idea := coalesce(new.idea_id, old.idea_id);
  select count(*)::integer into new_count from votes where idea_id = target_idea;
  select
    new_count < 10
    or votes_public_at is null
    or now() - votes_public_at > interval '12 minutes'
    or coalesce(votes_public, 0) < 10
  into due
  from ideas
  where id = target_idea;

  update ideas
  set
    votes = new_count,
    last_vote_time = case
      when new_count > 0 then now()
      else last_vote_time
    end,
    votes_public = case
      when new_count < 10 then new_count
      when due then public.public_count_display(new_count, id::text)
      else coalesce(votes_public, public.public_count_display(new_count, id::text))
    end,
    votes_public_at = case
      when new_count < 10 or due then now()
      else coalesce(votes_public_at, now())
    end
  where id = target_idea;
  return coalesce(new, old);
exception
  when undefined_column then
    update ideas set votes = new_count where id = target_idea;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_votes_refresh_count on votes;
create trigger trg_votes_refresh_count
  after insert or delete on votes
  for each row
  execute function public.refresh_idea_vote_count();

create or replace function public.enforce_idea_vote_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_action_allowed(
    'idea_vote',
    200,
    interval '15 minutes',
    interval '200 milliseconds'
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_votes_rate on votes;
create trigger trg_votes_rate
  before insert or delete on votes
  for each row
  execute function public.enforce_idea_vote_rate();

-- Own rows only so the public cannot COUNT(*) exact totals
drop policy if exists "Public can read votes" on votes;
drop policy if exists "Users read own votes" on votes;
create policy "Users read own votes"
  on votes for select
  using (
    auth.uid() = user_id
    or public.user_bypasses_abuse_limits()
  );

create or replace function public.toggle_idea_vote(p_idea_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_exists boolean;
  v_public integer;
begin
  if v_user is null then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;
  if p_idea_id is null or p_idea_id <= 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from ideas where id = p_idea_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from votes where idea_id = p_idea_id and user_id = v_user
  ) into v_exists;

  if v_exists then
    delete from votes where idea_id = p_idea_id and user_id = v_user;
  else
    insert into votes (idea_id, user_id) values (p_idea_id, v_user);
  end if;

  select coalesce(votes_public, votes, 0)
  into v_public
  from ideas
  where id = p_idea_id;

  return json_build_object(
    'voted', not v_exists,
    'votes', coalesce(v_public, 0)
  );
end;
$$;

grant execute on function public.toggle_idea_vote(bigint) to authenticated;

create or replace function public.normalize_idea_title(p_title text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.enforce_idea_submit_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_is_draft boolean;
  v_was_draft boolean;
  v_publishing boolean;
begin
  if tg_op = 'INSERT' then
    new.votes := 0;
    new.votes_public := 0;
    new.votes_public_at := now();
    if new.public_id is null then
      new.public_id := gen_random_uuid();
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.user_bypasses_abuse_limits() then
      new.votes := old.votes;
      new.votes_public := old.votes_public;
      new.votes_public_at := old.votes_public_at;
      new.public_id := coalesce(old.public_id, new.public_id);
    end if;
  end if;

  if public.user_bypasses_abuse_limits() then
    return new;
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;

  v_is_draft := coalesce(new.status, 'Proposed') = 'Draft';
  v_was_draft := tg_op = 'UPDATE' and coalesce(old.status, 'Proposed') = 'Draft';
  v_publishing :=
    (tg_op = 'INSERT' and not v_is_draft)
    or (tg_op = 'UPDATE' and v_was_draft and not v_is_draft);

  if v_is_draft and tg_op = 'INSERT' then
    perform public.assert_action_allowed(
      'idea_draft',
      30,
      interval '24 hours',
      interval '8 seconds'
    );
    return new;
  end if;

  if v_publishing then
    perform public.assert_action_allowed(
      'idea_publish',
      8,
      interval '24 hours',
      interval '90 seconds'
    );

    v_title := public.normalize_idea_title(new.title);
    if length(v_title) >= 8 then
      if exists (
        select 1
        from ideas i
        where i.user_id = new.user_id
          and i.id is distinct from new.id
          and coalesce(i.status, 'Proposed') is distinct from 'Draft'
          and public.normalize_idea_title(i.title) = v_title
          and i.created_at > now() - interval '48 hours'
      ) then
        perform public.flag_abuse('duplicate_title', 'idea_publish');
        raise exception 'DUPLICATE_CONTENT' using errcode = 'P0001';
      end if;
    end if;

    if length(trim(coalesce(new.description, new.summary, ''))) >= 80 then
      if exists (
        select 1
        from ideas i
        where i.user_id = new.user_id
          and i.id is distinct from new.id
          and coalesce(i.status, 'Proposed') is distinct from 'Draft'
          and left(lower(trim(coalesce(i.description, i.summary, ''))), 160)
            = left(lower(trim(coalesce(new.description, new.summary, ''))), 160)
          and i.created_at > now() - interval '24 hours'
      ) then
        perform public.flag_abuse('duplicate_body', 'idea_publish');
        raise exception 'DUPLICATE_CONTENT' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ideas_submit_rules on ideas;
create trigger trg_ideas_submit_rules
  before insert or update on ideas
  for each row
  execute function public.enforce_idea_submit_rules();

-- ---------------------------------------------------------------------------
-- 4. Idea comments
-- ---------------------------------------------------------------------------
create or replace function public.enforce_idea_comment_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_bypasses_abuse_limits() then
    return new;
  end if;
  if new.user_id is distinct from auth.uid() then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(new.content, ''))) < 2 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  perform public.assert_action_allowed(
    'idea_comment',
    45,
    interval '15 minutes',
    interval '2 seconds'
  );

  if exists (
    select 1
    from comments c
    where c.user_id = new.user_id
      and c.idea_id = new.idea_id
      and lower(trim(c.content)) = lower(trim(new.content))
      and c.created_at > now() - interval '20 minutes'
  ) then
    perform public.flag_abuse('duplicate_comment', 'idea_comment');
    raise exception 'DUPLICATE_CONTENT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comments_abuse on comments;
create trigger trg_comments_abuse
  before insert on comments
  for each row
  execute function public.enforce_idea_comment_rules();

-- ---------------------------------------------------------------------------
-- 5. Showcase likes + submissions
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.community_showcase_posts') is null then
    return;
  end if;

  alter table public.community_showcase_posts
    add column if not exists likes_public integer;
  alter table public.community_showcase_posts
    add column if not exists likes_public_at timestamptz;

  update public.community_showcase_posts
  set
    likes_public = public.public_count_display(coalesce(likes, 0), id::text),
    likes_public_at = coalesce(likes_public_at, now())
  where likes_public is null;

  begin
    revoke update (likes, likes_public, likes_public_at)
      on table public.community_showcase_posts from anon, authenticated;
  exception
    when others then
      null;
  end;
end $$;

create or replace function public.refresh_community_showcase_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post uuid;
  new_count integer;
  due boolean;
begin
  target_post := coalesce(new.post_id, old.post_id);
  if target_post is null then
    return null;
  end if;

  select count(*)::integer into new_count
  from community_showcase_likes
  where post_id = target_post;

  select
    new_count < 10
    or likes_public_at is null
    or now() - likes_public_at > interval '12 minutes'
    or coalesce(likes_public, 0) < 10
  into due
  from community_showcase_posts
  where id = target_post;

  update community_showcase_posts
  set
    likes = coalesce(new_count, 0),
    likes_public = case
      when new_count < 10 then new_count
      when due then public.public_count_display(new_count, id::text)
      else coalesce(likes_public, public.public_count_display(new_count, id::text))
    end,
    likes_public_at = case
      when new_count < 10 or due then now()
      else coalesce(likes_public_at, now())
    end
  where id = target_post;

  return null;
exception
  when undefined_column then
    update community_showcase_posts
    set likes = coalesce(new_count, 0)
    where id = target_post;
    return null;
end;
$$;

create or replace function public.enforce_showcase_like_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_action_allowed(
    'showcase_like',
    200,
    interval '15 minutes',
    interval '200 milliseconds'
  );
  return coalesce(new, old);
end;
$$;

do $$
begin
  if to_regclass('public.community_showcase_likes') is null then
    return;
  end if;

  drop trigger if exists trg_showcase_likes_refresh on community_showcase_likes;
  create trigger trg_showcase_likes_refresh
    after insert or delete on community_showcase_likes
    for each row
    execute function public.refresh_community_showcase_likes_count();

  drop trigger if exists trg_showcase_likes_rate on community_showcase_likes;
  create trigger trg_showcase_likes_rate
    before insert or delete on community_showcase_likes
    for each row
    execute function public.enforce_showcase_like_rate();

  drop policy if exists "Public can read showcase likes" on community_showcase_likes;
  drop policy if exists "Users read own showcase likes" on community_showcase_likes;
  create policy "Users read own showcase likes"
    on community_showcase_likes for select
    using (
      auth.uid() = user_id
      or public.user_bypasses_abuse_limits()
    );
end $$;

create or replace function public.toggle_showcase_like(p_post_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_exists boolean;
  v_public integer;
begin
  if v_user is null then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;
  if p_post_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from community_showcase_posts
    where id = p_post_id and status = 'approved'
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from community_showcase_likes
    where post_id = p_post_id and user_id = v_user
  ) into v_exists;

  if v_exists then
    delete from community_showcase_likes
    where post_id = p_post_id and user_id = v_user;
  else
    insert into community_showcase_likes (post_id, user_id)
    values (p_post_id, v_user);
  end if;

  select coalesce(likes_public, likes, 0)
  into v_public
  from community_showcase_posts
  where id = p_post_id;

  return json_build_object(
    'liked', not v_exists,
    'likes', coalesce(v_public, 0)
  );
end;
$$;

grant execute on function public.toggle_showcase_like(uuid) to authenticated;

create or replace function public.enforce_showcase_submit_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.user_bypasses_abuse_limits() then
      return new;
    end if;
    perform public.assert_action_allowed(
      'showcase_submit',
      8,
      interval '24 hours',
      interval '2 minutes'
    );
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.community_showcase_posts') is null then
    return;
  end if;
  drop trigger if exists trg_showcase_submit_rules on community_showcase_posts;
  create trigger trg_showcase_submit_rules
    before insert on community_showcase_posts
    for each row
    execute function public.enforce_showcase_submit_rules();
end $$;

-- ---------------------------------------------------------------------------
-- 6. Task claims (extra burst cap on top of existing quota RPC)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_task_claim_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_action_allowed(
    'task_claim',
    12,
    interval '10 minutes',
    interval '2 seconds'
  );
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.task_claims') is null then
    return;
  end if;
  drop trigger if exists trg_task_claims_rate on task_claims;
  create trigger trg_task_claims_rate
    before insert on task_claims
    for each row
    execute function public.enforce_task_claim_rate();
end $$;

-- ---------------------------------------------------------------------------
-- 7. Volunteer applications + concern reports
-- ---------------------------------------------------------------------------
create or replace function public.enforce_volunteer_app_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text;
begin
  if public.user_bypasses_abuse_limits() then
    return new;
  end if;
  v_actor := case
    when new.user_id is not null then 'user:' || new.user_id::text
    when length(trim(coalesce(new.email, ''))) > 3
      then 'email:' || md5(lower(trim(new.email)))
    else 'vol:' || md5(lower(trim(coalesce(new.handle, new.discord_username, 'x'))))
  end;
  perform public.assert_action_allowed(
    'volunteer_app',
    4,
    interval '15 minutes',
    interval '30 seconds',
    v_actor
  );
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.volunteer_applications') is null then
    return;
  end if;
  drop trigger if exists trg_volunteer_app_rate on volunteer_applications;
  create trigger trg_volunteer_app_rate
    before insert on volunteer_applications
    for each row
    execute function public.enforce_volunteer_app_rate();
end $$;

create or replace function public.enforce_concern_report_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text;
begin
  v_actor := case
    when new.user_id is not null then 'user:' || new.user_id::text
    when length(trim(coalesce(new.contact, ''))) > 3
      then 'contact:' || md5(lower(trim(new.contact)))
    else 'report:' || md5(left(lower(trim(new.what_happened)), 80))
  end;
  perform public.assert_action_allowed(
    'concern_report',
    5,
    interval '15 minutes',
    interval '20 seconds',
    v_actor
  );
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.concern_reports') is null then
    return;
  end if;
  drop trigger if exists trg_concern_report_rate on concern_reports;
  create trigger trg_concern_report_rate
    before insert on concern_reports
    for each row
    execute function public.enforce_concern_report_rate();
end $$;

-- ---------------------------------------------------------------------------
-- 8. Signup burst flag (Auth still owns account rate limits)
-- ---------------------------------------------------------------------------
create or replace function public.flag_profile_signup_burst()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  select count(*)::integer into v_n
  from profiles
  where coalesce(joined_at, now()) > now() - interval '5 minutes';

  if v_n >= 25 then
    insert into public.abuse_flags (actor_key, user_id, action, reason, meta)
    values (
      'global',
      new.id,
      'signup',
      'signup_burst',
      jsonb_build_object('recent', v_n)
    );
  end if;
  return new;
exception
  when others then
    return new;
end;
$$;

do $$
begin
  if to_regclass('public.profiles') is null then
    return;
  end if;
  drop trigger if exists trg_profiles_signup_burst on profiles;
  create trigger trg_profiles_signup_burst
    after insert on profiles
    for each row
    execute function public.flag_profile_signup_burst();
end $$;

-- ---------------------------------------------------------------------------
-- 9. Founders thoughts likes (public count delay) if the table exists
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.founders_thoughts') is null then
    return;
  end if;
  alter table public.founders_thoughts
    add column if not exists likes_public integer;
  alter table public.founders_thoughts
    add column if not exists likes_public_at timestamptz;
  update public.founders_thoughts
  set
    likes_public = public.public_count_display(coalesce(likes, 0), id::text),
    likes_public_at = coalesce(likes_public_at, now())
  where likes_public is null;
end $$;

notify pgrst, 'reload schema';
