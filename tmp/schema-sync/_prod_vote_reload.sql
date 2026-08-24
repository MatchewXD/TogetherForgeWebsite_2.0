notify pgrst, 'reload schema';

select jsonb_build_object(
  'idea_cast_vote', exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'idea_cast_vote'
  ),
  'authenticated_can_execute', (
    select has_function_privilege('authenticated', p.oid, 'execute')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'idea_cast_vote'
    limit 1
  )
) as ok;
