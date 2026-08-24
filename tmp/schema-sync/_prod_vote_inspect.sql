select jsonb_build_object(
  'idea_cast_vote', (
    select jsonb_agg(jsonb_build_object(
      'identity', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
      'exec_authenticated', has_function_privilege('authenticated', p.oid, 'execute'),
      'exec_anon', has_function_privilege('anon', p.oid, 'execute'),
      'exec_public', has_function_privilege('public', p.oid, 'execute')
    ))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'idea_cast_vote'
  ),
  'toggle_idea_vote', (
    select jsonb_agg(jsonb_build_object(
      'identity', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
      'exec_authenticated', has_function_privilege('authenticated', p.oid, 'execute')
    ))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'toggle_idea_vote'
  ),
  'votes_grants', (
    select jsonb_agg(jsonb_build_object('grantee', grantee, 'privilege', privilege_type))
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'votes'
      and grantee in ('anon', 'authenticated', 'public')
  ),
  'votes_exists', to_regclass('public.votes') is not null
) as inspect;
