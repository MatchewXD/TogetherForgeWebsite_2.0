select jsonb_build_object(
  'cast_defs', (
    select jsonb_agg(pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'idea_cast_vote'
  ),
  'submit_has_vote_skip', (
    select pg_get_functiondef(p.oid) ilike '%app.idea_vote_count_update%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'enforce_idea_submit_rules'
    limit 1
  ),
  'request_uid', exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'request_uid'
  ),
  'safeupdate', exists (select 1 from pg_extension where extname = 'safeupdate'),
  'idea_19', (select jsonb_build_object('id', id, 'user_id', user_id, 'votes', votes) from ideas where id = 19),
  'idea_22', (select jsonb_build_object('id', id, 'user_id', user_id, 'votes', votes) from ideas where id = 22)
) as inspect;
