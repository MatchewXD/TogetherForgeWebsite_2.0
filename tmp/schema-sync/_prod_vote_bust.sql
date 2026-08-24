create or replace function public.idea_cast_vote(p_idea_id integer)
returns json
language sql
security definer
set search_path = public
as $$
  select public.idea_cast_vote(p_idea_id::bigint);
$$;

revoke all on function public.idea_cast_vote(integer) from public;
grant execute on function public.idea_cast_vote(integer) to authenticated;
grant execute on function public.idea_cast_vote(bigint) to authenticated;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';

select jsonb_build_object(
  'overloads', (
    select jsonb_agg(pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'idea_cast_vote'
  ),
  'auth_exec_bigint', (
    select has_function_privilege('authenticated', p.oid, 'execute')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'idea_cast_vote'
      and pg_get_function_identity_arguments(p.oid) = 'p_idea_id bigint'
  )
) as ok;
