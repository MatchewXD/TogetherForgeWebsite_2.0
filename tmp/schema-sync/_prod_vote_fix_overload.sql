drop function if exists public.idea_cast_vote(integer);

grant execute on function public.idea_cast_vote(bigint) to authenticated;

notify pgrst, 'reload schema';

-- Restore the vote this diagnostic toggle removed for idea 19.
insert into public.votes (idea_id, user_id)
values (19, '4c6a60f5-f478-4987-9ad1-10ec0d9bb621')
on conflict (idea_id, user_id) do nothing;

select jsonb_build_object(
  'overloads', (
    select jsonb_agg(pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'idea_cast_vote'
  ),
  'matchew_voted_19', exists (
    select 1 from votes
    where idea_id = 19
      and user_id = '4c6a60f5-f478-4987-9ad1-10ec0d9bb621'
  )
) as ok;
