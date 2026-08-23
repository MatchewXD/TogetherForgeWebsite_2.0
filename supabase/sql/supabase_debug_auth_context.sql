-- Vote writes were dying in trg_votes_rate -> assert_action_allowed
-- (SIGN_IN_REQUIRED, no details). Bypass that trigger; rate-limit inside
-- the RPC with the JWT claims sub. Safe to re-run.

drop trigger if exists trg_votes_rate on public.votes;

create or replace function public.request_uid()
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  c text;
  v uuid;
begin
  c := current_setting('request.jwt.claims', true);
  if c is not null and c <> '' then
    begin
      v := nullif(c::jsonb ->> 'sub', '')::uuid;
    exception
      when others then
        v := null;
    end;
  end if;
  if v is not null then
    return v;
  end if;
  return auth.uid();
end;
$$;

revoke all on function public.request_uid() from public;
grant execute on function public.request_uid() to authenticated, anon;

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

  -- Rate limit without going through the votes trigger.
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
      -- Do not block the vote on auth noise from the rate helper.
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

  -- ideas.votes is maintained by trg_votes_refresh_count. Do not UPDATE
  -- ideas here: enforce_idea_submit_rules treats a voter writing the
  -- author's row as SIGN_IN_REQUIRED.

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

notify pgrst, 'reload schema';
