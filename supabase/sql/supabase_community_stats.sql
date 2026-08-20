-- Public Home community stats (counts only, no PII).
-- Safe to re-run.

create or replace function get_public_community_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_members integer := 0;
  v_ideas integer := 0;
  v_supporters integer := 0;
  v_tasks integer := 0;
begin
  begin
    select count(*)::integer into v_members from public.profiles;
  exception
    when undefined_table then
      v_members := 0;
  end;

  begin
    select count(*)::integer into v_ideas
    from public.ideas
    where coalesce(status, 'Proposed') is distinct from 'Draft';
  exception
    when undefined_column then
      begin
        select count(*)::integer into v_ideas from public.ideas;
      exception
        when undefined_table then
          v_ideas := 0;
      end;
    when undefined_table then
      v_ideas := 0;
  end;

  begin
    select count(*)::integer into v_supporters
    from (
      select distinct coalesce(
        nullif(user_id::text, ''),
        nullif(trim(stripe_customer_id), ''),
        'row:' || id::text
      ) as k
      from public.donations
      where coalesce(fund_type, 'studio') in ('studio', 'runway')
        and coalesce(status, 'completed') in ('completed', 'paid', 'succeeded')
        and coalesce(amount_cents, amount * 100, 0) > 0
    ) s;
  exception
    when undefined_column then
      begin
        select count(distinct coalesce(user_id::text, 'row:' || id::text))::integer
        into v_supporters
        from public.donations
        where coalesce(status, 'completed') in ('completed', 'paid', 'succeeded');
      exception
        when others then
          v_supporters := 0;
      end;
    when undefined_table then
      v_supporters := 0;
  end;

  begin
    select count(*)::integer into v_tasks
    from public.tasks
    where status = 'Completed';
  exception
    when undefined_table then
      begin
        select count(*)::integer into v_tasks
        from public.task_claims
        where status = 'Completed';
      exception
        when others then
          v_tasks := 0;
      end;
    when others then
      begin
        select count(*)::integer into v_tasks
        from public.task_claims
        where status = 'Completed';
      exception
        when others then
          v_tasks := 0;
      end;
  end;

  return json_build_object(
    'members', coalesce(v_members, 0),
    'ideas_submitted', coalesce(v_ideas, 0),
    'supporters', coalesce(v_supporters, 0),
    'tasks_completed', coalesce(v_tasks, 0)
  );
end;
$$;

grant execute on function get_public_community_stats() to anon, authenticated;

comment on function get_public_community_stats() is
  'Home Community Pulse: members, submitted ideas, unique supporters, completed tasks.';
