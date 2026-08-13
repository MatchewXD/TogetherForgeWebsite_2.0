-- Fail loudly if core tables are missing (run after supabase_schema.sql)
do $$
begin
  if to_regclass('public.ideas') is null then
    raise exception 'CORE_MISSING: public.ideas does not exist. Re-run supabase_schema.sql first (Dashboard SQL Editor is most reliable).';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'CORE_MISSING: public.profiles does not exist. Re-run supabase_schema.sql first.';
  end if;
  raise notice 'OK: public.ideas and public.profiles exist';
end $$;

select
  to_regclass('public.ideas') as ideas,
  to_regclass('public.profiles') as profiles,
  to_regclass('public.votes') as votes,
  to_regclass('public.comments') as comments,
  to_regclass('public.donations') as donations;
