-- Vote writes fail with P0001 SIGN_IN_REQUIRED even when the JWT is valid.
-- Cause: trg_ideas_submit_rules / enforce_idea_submit_rules runs BEFORE
-- UPDATE on ideas and raises if new.user_id <> auth.uid(). Vote-count
-- denormalization (refresh_idea_vote_count, leftover idea_cast_vote UPDATE)
-- writes ideas.votes as the voter, who is not the idea author.
-- Safe to re-run. Staging: npx supabase db query --linked -f supabase/sql/supabase_idea_vote_count_trigger.sql

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

  perform set_config('app.idea_vote_count_update', '1', true);

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
    perform set_config('app.idea_vote_count_update', '1', true);
    update ideas set votes = new_count where id = target_idea;
    return coalesce(new, old);
end;
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
  v_actor uuid;
  v_vote_cols text[] := array['votes', 'votes_public', 'votes_public_at', 'last_vote_time'];
begin
  if tg_op = 'UPDATE' then
    if current_setting('app.idea_vote_count_update', true) = '1'
       or (
         (to_jsonb(new) - v_vote_cols)
         is not distinct from
         (to_jsonb(old) - v_vote_cols)
       )
    then
      return new;
    end if;
  end if;

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

  begin
    v_actor := public.request_uid();
  exception
    when undefined_function then
      v_actor := auth.uid();
  end;
  if v_actor is null then
    v_actor := auth.uid();
  end if;
  if new.user_id is distinct from v_actor then
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

drop function if exists public.idea_cast_vote(bigint);

create function public.idea_cast_vote(p_idea_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_exists boolean;
  v_count integer;
  v_claims text;
begin
  v_claims := current_setting('request.jwt.claims', true);
  begin
    v_user := nullif(nullif(v_claims, '')::jsonb ->> 'sub', '')::uuid;
  exception
    when others then
      v_user := public.request_uid();
  end;
  if v_user is null then
    v_user := public.request_uid();
  end if;
  if v_user is null then
    raise exception 'VOTE_AUTH_FAILED'
      using errcode = 'P0001',
            detail = coalesce(v_claims, '');
  end if;

  if p_idea_id is null or p_idea_id <= 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from ideas where id = p_idea_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  begin
    perform public.assert_action_allowed(
      'idea_vote',
      200,
      interval '15 minutes',
      interval '200 milliseconds',
      'user:' || v_user::text
    );
  exception
    when others then
      if sqlerrm like 'RATE_LIMITED%' then
        raise;
      end if;
      null;
  end;

  select exists (
    select 1 from votes where idea_id = p_idea_id and user_id = v_user
  ) into v_exists;

  if v_exists then
    delete from votes where idea_id = p_idea_id and user_id = v_user;
  else
    insert into votes (idea_id, user_id) values (p_idea_id, v_user);
  end if;

  select coalesce(votes_public, votes, 0)
  into v_count
  from ideas
  where id = p_idea_id;

  return json_build_object(
    'voted', not v_exists,
    'votes', coalesce(v_count, 0)
  );
end;
$$;

revoke all on function public.idea_cast_vote(bigint) from public;
grant execute on function public.idea_cast_vote(bigint) to authenticated;

create or replace function public.toggle_showcase_like(p_post_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_exists boolean;
  v_public integer;
begin
  v_user := public.request_uid();
  if v_user is null then
    v_user := auth.uid();
  end if;
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

  begin
    perform public.assert_action_allowed(
      'showcase_like',
      200,
      interval '15 minutes',
      interval '200 milliseconds',
      'user:' || v_user::text
    );
  exception
    when others then
      if sqlerrm like 'RATE_LIMITED%' then
        raise;
      end if;
      null;
  end;

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

revoke all on function public.toggle_showcase_like(uuid) from public;
grant execute on function public.toggle_showcase_like(uuid) to authenticated;

drop trigger if exists trg_showcase_likes_rate on public.community_showcase_likes;

notify pgrst, 'reload schema';
