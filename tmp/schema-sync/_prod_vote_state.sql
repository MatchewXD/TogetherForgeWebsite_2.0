select exists (
  select 1 from votes
  where idea_id = 19
    and user_id = '4c6a60f5-f478-4987-9ad1-10ec0d9bb621'
) as matchew_voted_19,
(select votes from ideas where id = 19) as idea_19_votes;
