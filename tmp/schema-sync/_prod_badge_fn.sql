notify pgrst, 'reload schema';

select jsonb_build_object(
  'user_has_shipped_game', exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'user_has_shipped_game'
  ),
  'project_is_released', exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'project_is_released'
  )
) as ok;
