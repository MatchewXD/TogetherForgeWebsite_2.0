-- Production test-data cleanup. Targeted deletes. Ideas rows are not deleted.
-- Test users: bot1, bot2, bot3, Testbot1, Testbot2 (no Bot4–7 on this project).
-- Keep: MatchewXD, MXDTV.

do $$
declare
  v_test uuid[] := array[
    'eaa841e9-6995-4112-81f1-363a1df1f4bd'::uuid, -- bot1
    '586f3932-27b7-4f50-92cd-8ef0c6c854d8'::uuid, -- bot2
    'f756a7ed-0074-4bcb-926d-72a716197553'::uuid, -- bot3
    'dbd153dd-3e46-4287-a86e-8f13eef4b692'::uuid, -- Testbot1
    '5188631f-c0d9-4ee8-9ce5-b8612d63ed55'::uuid  -- Testbot2
  ];
  v_tether uuid;
  n int;
begin
  select id into v_tether
  from public.projects
  where slug = 'prototype-systems' or lower(title) = 'tether'
  limit 1;

  -- Badge/Marks triggers assume functions that may not all exist on prod.
  alter table public.ideas disable trigger user;
  if to_regclass('public.votes') is not null then
    alter table public.votes disable trigger user;
  end if;
  if to_regclass('public.comments') is not null then
    alter table public.comments disable trigger user;
  end if;
  if to_regclass('public.tasks') is not null then
    alter table public.tasks disable trigger user;
  end if;
  if to_regclass('public.task_claims') is not null then
    alter table public.task_claims disable trigger user;
  end if;
  if to_regclass('public.donations') is not null then
    alter table public.donations disable trigger user;
  end if;
  if to_regclass('public.forge_mark_ledger') is not null then
    alter table public.forge_mark_ledger disable trigger user;
  end if;

  -- Ideas stay; detach test authors so auth.users can be removed.
  update public.ideas
  set user_id = null
  where user_id = any (v_test);

  -- Comments / likes / votes by test users (not idea posts)
  if to_regclass('public.comment_likes') is not null then
    delete from public.comment_likes
    where user_id = any (v_test)
       or comment_id in (select id from public.comments where user_id = any (v_test));
  end if;
  if to_regclass('public.comments') is not null then
    delete from public.comments where user_id = any (v_test);
  end if;
  if to_regclass('public.votes') is not null then
    delete from public.votes where user_id = any (v_test);
  end if;

  -- Tether board
  if v_tether is not null then
    if to_regclass('public.task_dependencies') is not null then
      delete from public.task_dependencies
      where task_id in (select id from public.tasks where project_id = v_tether)
         or blocks_on_task_id in (select id from public.tasks where project_id = v_tether);
    end if;
    if to_regclass('public.task_scope_requests') is not null then
      delete from public.task_scope_requests
      where project_id = v_tether
         or task_id in (select id from public.tasks where project_id = v_tether);
    end if;
    if to_regclass('public.claim_join_requests') is not null then
      delete from public.claim_join_requests
      where task_id in (select id from public.tasks where project_id = v_tether);
    end if;
    if to_regclass('public.task_claims') is not null then
      delete from public.task_claims
      where task_id in (select id from public.tasks where project_id = v_tether);
    end if;
    if to_regclass('public.activity_log') is not null then
      delete from public.activity_log where project_id = v_tether;
    end if;
    update public.tasks set parent_task_id = null where project_id = v_tether;
    delete from public.tasks where project_id = v_tether;
  end if;

  -- Empty named test projects (no tasks)
  delete from public.projects
  where slug in ('testprojectone', 'testprojecttwo', 'testprojectthree');

  -- Donations + public contributor credits (all current rows are test/seed)
  if to_regclass('public.forge_mark_ledger') is not null then
    delete from public.forge_mark_ledger;
  end if;
  if to_regclass('public.forge_awards') is not null then
    delete from public.forge_awards;
  end if;
  if to_regclass('public.forge_award_totals') is not null then
    delete from public.forge_award_totals;
  end if;
  if to_regclass('public.forge_mark_balances') is not null then
    delete from public.forge_mark_balances;
  end if;
  if to_regclass('public.project_contributions') is not null then
    delete from public.project_contributions;
  end if;
  if to_regclass('public.donations') is not null then
    delete from public.donations;
  end if;
  if to_regclass('public.stripe_subscriptions') is not null then
    delete from public.stripe_subscriptions;
  end if;
  if to_regclass('public.stripe_webhook_events') is not null then
    delete from public.stripe_webhook_events;
  end if;
  if to_regclass('public.ai_token_purchases') is not null then
    delete from public.ai_token_purchases where user_id = any (v_test);
  end if;
  if to_regclass('public.ai_token_ledger') is not null then
    delete from public.ai_token_ledger where user_id = any (v_test);
  end if;
  if to_regclass('public.user_badges') is not null then
    delete from public.user_badges where user_id = any (v_test);
  end if;
  if to_regclass('public.action_rate_events') is not null then
    delete from public.action_rate_events
    where actor_key in (
      select 'user:' || x::text from unnest(v_test) as x
    );
  end if;

  -- Remaining user-owned rows that would block auth.users delete
  if to_regclass('public.task_claims') is not null then
    delete from public.task_claims where user_id = any (v_test);
  end if;
  if to_regclass('public.username_history') is not null then
    delete from public.username_history where user_id = any (v_test);
  end if;
  if to_regclass('public.mfa_recovery_codes') is not null then
    delete from public.mfa_recovery_codes where user_id = any (v_test);
  end if;
  if to_regclass('public.ai_generation_log') is not null then
    delete from public.ai_generation_log where user_id = any (v_test);
  end if;

  delete from public.profiles where id = any (v_test);
  delete from auth.users where id = any (v_test);

  alter table public.ideas enable trigger user;
  if to_regclass('public.votes') is not null then
    alter table public.votes enable trigger user;
  end if;
  if to_regclass('public.comments') is not null then
    alter table public.comments enable trigger user;
  end if;
  if to_regclass('public.tasks') is not null then
    alter table public.tasks enable trigger user;
  end if;
  if to_regclass('public.task_claims') is not null then
    alter table public.task_claims enable trigger user;
  end if;
  if to_regclass('public.donations') is not null then
    alter table public.donations enable trigger user;
  end if;
  if to_regclass('public.forge_mark_ledger') is not null then
    alter table public.forge_mark_ledger enable trigger user;
  end if;
exception
  when others then
    alter table public.ideas enable trigger user;
    if to_regclass('public.votes') is not null then
      alter table public.votes enable trigger user;
    end if;
    if to_regclass('public.comments') is not null then
      alter table public.comments enable trigger user;
    end if;
    if to_regclass('public.tasks') is not null then
      alter table public.tasks enable trigger user;
    end if;
    if to_regclass('public.task_claims') is not null then
      alter table public.task_claims enable trigger user;
    end if;
    if to_regclass('public.donations') is not null then
      alter table public.donations enable trigger user;
    end if;
    if to_regclass('public.forge_mark_ledger') is not null then
      alter table public.forge_mark_ledger enable trigger user;
    end if;
    raise;
end $$;

select jsonb_build_object(
  'remaining_profiles', (select coalesce(jsonb_agg(username order by username), '[]'::jsonb) from public.profiles),
  'auth_user_count', (select count(*) from auth.users),
  'donation_count', (select count(*) from public.donations),
  'contribution_count', (
    select count(*) from public.project_contributions
  ),
  'tether_tasks', (
    select count(*)
    from public.tasks t
    join public.projects p on p.id = t.project_id
    where p.slug = 'prototype-systems'
  ),
  'projects', (
    select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'title', title) order by slug), '[]'::jsonb)
    from public.projects
  ),
  'idea_count', (select count(*) from public.ideas),
  'ideas_with_null_author', (select count(*) from public.ideas where user_id is null)
) as after_cleanup;
