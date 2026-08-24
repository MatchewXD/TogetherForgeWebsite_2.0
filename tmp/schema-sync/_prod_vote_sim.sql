do $$
declare
  r json;
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub":"4c6a60f5-f478-4987-9ad1-10ec0d9bb621","role":"authenticated"}',
    true
  );
  r := public.idea_cast_vote(19);
  raise notice 'result=%', r;
end $$;
