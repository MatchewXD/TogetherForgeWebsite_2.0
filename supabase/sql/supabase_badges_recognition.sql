-- =============================================================================
-- Badge families: Starter, Impact, Giving & Engagement, Collaboration
-- Run after supabase_badges.sql. Safe to re-run.
--
-- Thresholds (no hidden multipliers). Mirror src/constants/badges.js
-- BADGE_THRESHOLDS:
--   meaningful comment          ≥ 20 characters
--   Discussion Starter          10 comments from others on one idea
--   Deep Discussion             25 comments from others on one idea
--   Well Received               15 votes or 3 awards (idea); 15 likes or 3 awards (Showcase)
--   Community Favorite          8 awards on one post, or 1 Masterwork
--   Awarded Idea                1+ award on an idea
--   Recognized / Respected /
--     Distinguished             5 / 15 / 40 awards received
--   Talk of the Forge           25 comments-from-others AND 5 awards on one idea
--   Viral Idea                  100 votes on one idea (same as Hot)
--   Generous / Patron           1,000 / 5,000 Marks spent on awards
--   Commentator / Active Voice  10 / 50 meaningful comments
--   Supporter                   1 award given + 10 meaningful comments
--   Enthusiast                  5 awards given + 25 meaningful comments
--   Early Supporter             completed donation or subscription while any
--                               official project phase starts with "early"
-- Badges are permanent (insert-only). Only Active Subscriber is revoked.
-- =============================================================================

create index if not exists idx_ideas_user_id on public.ideas (user_id)
  where user_id is not null;
create index if not exists idx_comments_user_id on public.comments (user_id)
  where user_id is not null;
create index if not exists idx_comments_idea_id on public.comments (idea_id);

-- ---------------------------------------------------------------------------
-- Count helpers
-- ---------------------------------------------------------------------------
create or replace function public.badge_is_public_idea_status(p_status text)
returns boolean
language sql
immutable
as $$
  select
    p_status is null
    or lower(trim(p_status)) not in ('draft', 'archived', 'hidden', 'rejected');
$$;

create or replace function public.badge_comment_is_meaningful(p_content text)
returns boolean
language sql
immutable
as $$
  select char_length(trim(coalesce(p_content, ''))) >= 20;
$$;

create or replace function public.user_public_idea_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or to_regclass('public.ideas') is null then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.ideas i
    where i.user_id = p_user_id
      and public.badge_is_public_idea_status(i.status)
  );
end;
$$;

create or replace function public.user_showcase_submission_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null
     or to_regclass('public.community_showcase_posts') is null then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.community_showcase_posts p
    where p.creator_user_id = p_user_id
  );
end;
$$;

create or replace function public.user_meaningful_comment_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or to_regclass('public.comments') is null then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.comments c
    where c.user_id = p_user_id
      and public.badge_comment_is_meaningful(c.content)
  );
end;
$$;

create or replace function public.user_feedback_on_others_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null
     or to_regclass('public.comments') is null
     or to_regclass('public.ideas') is null then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.comments c
    join public.ideas i on i.id = c.idea_id
    where c.user_id = p_user_id
      and i.user_id is distinct from p_user_id
      and public.badge_comment_is_meaningful(c.content)
  );
end;
$$;

create or replace function public.user_task_claim_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or to_regclass('public.task_claims') is null then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.task_claims tc
    where tc.user_id = p_user_id
  );
end;
$$;

create or replace function public.user_has_early_support(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_has_support boolean := false;
  v_early boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  v_has_support := public.user_donation_total_cents(p_user_id) > 0
    or public.user_has_active_subscription(p_user_id);

  if not v_has_support
     and to_regclass('public.stripe_subscriptions') is not null then
    -- Past subscription still counts as "became a subscriber"
    execute $q$
      select exists (
        select 1 from public.stripe_subscriptions s
        where s.user_id = $1
      )
    $q$ into v_has_support using p_user_id;
  end if;

  if not v_has_support then
    return false;
  end if;

  if to_regclass('public.projects') is null then
    return false;
  end if;

  select exists (
    select 1
    from public.projects p
    where lower(trim(coalesce(p.phase, ''))) like 'early%'
  )
  into v_early;

  return coalesce(v_early, false);
end;
$$;

create or replace function public.user_awards_received_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or to_regclass('public.forge_awards') is null then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.forge_awards a
    where a.receiver_id = p_user_id
  );
end;
$$;

create or replace function public.user_awards_given_count(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or to_regclass('public.forge_awards') is null then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.forge_awards a
    where a.giver_id = p_user_id
  );
end;
$$;

create or replace function public.user_marks_spent_on_awards(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or to_regclass('public.forge_awards') is null then
    return 0;
  end if;
  return (
    select coalesce(sum(a.marks_spent), 0)::integer
    from public.forge_awards a
    where a.giver_id = p_user_id
  );
end;
$$;

create or replace function public.user_max_idea_comments_by_others(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null
     or to_regclass('public.ideas') is null
     or to_regclass('public.comments') is null then
    return 0;
  end if;
  return coalesce((
    select max(cnt)::integer
    from (
      select count(*) as cnt
      from public.ideas i
      join public.comments c on c.idea_id = i.id
      where i.user_id = p_user_id
        and public.badge_is_public_idea_status(i.status)
        and c.user_id is distinct from p_user_id
      group by i.id
    ) x
  ), 0);
end;
$$;

create or replace function public.user_max_idea_votes(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or to_regclass('public.ideas') is null then
    return 0;
  end if;
  return coalesce((
    select max(coalesce(i.votes, 0))::integer
    from public.ideas i
    where i.user_id = p_user_id
      and public.badge_is_public_idea_status(i.status)
  ), 0);
end;
$$;

create or replace function public.user_max_awards_on_target(
  p_user_id uuid,
  p_target_type text
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null
     or to_regclass('public.forge_awards') is null then
    return 0;
  end if;
  return coalesce((
    select max(cnt)::integer
    from (
      select count(*) as cnt
      from public.forge_awards a
      where a.receiver_id = p_user_id
        and a.target_type = p_target_type
        and a.target_id is not null
      group by a.target_id
    ) x
  ), 0);
end;
$$;

create or replace function public.user_max_idea_masterworks(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or to_regclass('public.forge_awards') is null then
    return 0;
  end if;
  return coalesce((
    select max(cnt)::integer
    from (
      select count(*) as cnt
      from public.forge_awards a
      where a.receiver_id = p_user_id
        and a.target_type = 'idea'
        and lower(a.award_tier) = 'masterwork'
      group by a.target_id
    ) x
  ), 0);
end;
$$;

create or replace function public.user_max_showcase_likes(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null
     or to_regclass('public.community_showcase_posts') is null then
    return 0;
  end if;
  return coalesce((
    select max(coalesce(p.likes, 0))::integer
    from public.community_showcase_posts p
    where p.creator_user_id = p_user_id
      and p.status = 'approved'
  ), 0);
end;
$$;

create or replace function public.user_has_joined_force(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null
     or to_regclass('public.task_claims') is null
     or to_regclass('public.tasks') is null then
    return false;
  end if;

  if exists (
    select 1
    from public.task_claims mine
    join public.tasks t on t.id = mine.task_id
    where mine.user_id = p_user_id
      and t.project_id is not null
      and exists (
        select 1
        from public.task_claims other
        join public.tasks ot on ot.id = other.task_id
        where ot.project_id = t.project_id
          and other.user_id is distinct from p_user_id
      )
  ) then
    return true;
  end if;

  if to_regclass('public.project_contributions') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.task_claims mine
    join public.tasks t on t.id = mine.task_id
    join public.project_contributions pc on pc.project_id = t.project_id
    where mine.user_id = p_user_id
      and t.project_id is not null
      and pc.user_id is not null
      and pc.user_id is distinct from p_user_id
      and pc.category is distinct from 'donations'
  );
end;
$$;

create or replace function public.user_has_shared_victory(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null
     or to_regclass('public.projects') is null
     or to_regclass('public.task_claims') is null
     or to_regclass('public.tasks') is null then
    return false;
  end if;

  if exists (
    select 1
    from public.task_claims mine
    join public.tasks t on t.id = mine.task_id
    join public.projects p on p.id = t.project_id
    where mine.user_id = p_user_id
      and mine.status = 'Completed'
      and public.project_is_released(p.status, p.completed_at)
      and exists (
        select 1
        from public.task_claims other
        join public.tasks ot on ot.id = other.task_id
        where ot.project_id = p.id
          and other.user_id is distinct from p_user_id
          and other.status = 'Completed'
      )
  ) then
    return true;
  end if;

  if to_regclass('public.project_contributions') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.task_claims mine
    join public.tasks t on t.id = mine.task_id
    join public.projects p on p.id = t.project_id
    join public.project_contributions pc on pc.project_id = p.id
    where mine.user_id = p_user_id
      and mine.status = 'Completed'
      and public.project_is_released(p.status, p.completed_at)
      and pc.user_id is not null
      and pc.user_id is distinct from p_user_id
      and pc.category is distinct from 'donations'
  );
end;
$$;

-- Keys for the new families (does not include Status / Donation / Tasks).
create or replace function public.badge_recognition_keys_for_user(p_user_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_want text[] := array[]::text[];
  v_idea_comments int := 0;
  v_idea_votes int := 0;
  v_idea_awards int := 0;
  v_idea_mw int := 0;
  v_show_likes int := 0;
  v_show_awards int := 0;
  v_recv int := 0;
  v_given int := 0;
  v_marks int := 0;
  v_comments int := 0;
begin
  if p_user_id is null then
    return v_want;
  end if;

  if public.user_public_idea_count(p_user_id) >= 1 then
    v_want := array_append(v_want, 'starter_first_idea');
  end if;
  if public.user_showcase_submission_count(p_user_id) >= 1 then
    v_want := array_append(v_want, 'starter_showcase');
  end if;
  if public.user_feedback_on_others_count(p_user_id) >= 1 then
    v_want := array_append(v_want, 'starter_first_feedback');
  end if;
  if public.user_task_claim_count(p_user_id) >= 1 then
    v_want := array_append(v_want, 'starter_task_claimed');
  end if;
  if public.user_has_early_support(p_user_id) then
    v_want := array_append(v_want, 'starter_early_supporter');
  end if;

  v_idea_comments := public.user_max_idea_comments_by_others(p_user_id);
  v_idea_votes := public.user_max_idea_votes(p_user_id);
  v_idea_awards := public.user_max_awards_on_target(p_user_id, 'idea');
  v_idea_mw := public.user_max_idea_masterworks(p_user_id);
  v_show_likes := public.user_max_showcase_likes(p_user_id);
  v_show_awards := public.user_max_awards_on_target(p_user_id, 'showcase');
  v_recv := public.user_awards_received_count(p_user_id);
  v_given := public.user_awards_given_count(p_user_id);
  v_marks := public.user_marks_spent_on_awards(p_user_id);
  v_comments := public.user_meaningful_comment_count(p_user_id);

  if v_idea_comments >= 10 then
    v_want := array_append(v_want, 'impact_discussion_starter');
  end if;
  if v_idea_votes >= 15
     or v_idea_awards >= 3
     or v_show_likes >= 15
     or v_show_awards >= 3 then
    v_want := array_append(v_want, 'impact_well_received');
  end if;
  if v_idea_comments >= 25 then
    v_want := array_append(v_want, 'impact_deep_discussion');
  end if;
  if v_idea_awards >= 8
     or v_show_awards >= 8
     or v_idea_mw >= 1 then
    v_want := array_append(v_want, 'impact_community_favorite');
  end if;
  if v_idea_awards >= 1 then
    v_want := array_append(v_want, 'impact_awarded_idea');
  end if;
  if v_recv >= 5 then
    v_want := array_append(v_want, 'impact_recognized');
  end if;
  if v_recv >= 15 then
    v_want := array_append(v_want, 'impact_respected');
  end if;
  if v_recv >= 40 then
    v_want := array_append(v_want, 'impact_distinguished');
  end if;
  if v_idea_comments >= 25 and v_idea_awards >= 5 then
    v_want := array_append(v_want, 'impact_talk_of_the_forge');
  end if;
  if v_idea_votes >= 100 then
    v_want := array_append(v_want, 'impact_viral_idea');
  end if;

  if v_given >= 1 then
    v_want := array_append(v_want, 'giving_first_spark');
  end if;
  if v_marks >= 1000 then
    v_want := array_append(v_want, 'giving_generous');
  end if;
  if v_marks >= 5000 then
    v_want := array_append(v_want, 'giving_patron');
  end if;
  if v_comments >= 10 then
    v_want := array_append(v_want, 'giving_commentator');
  end if;
  if v_comments >= 50 then
    v_want := array_append(v_want, 'giving_active_voice');
  end if;
  if v_given >= 1 and v_comments >= 10 then
    v_want := array_append(v_want, 'giving_supporter');
  end if;
  if v_given >= 5 and v_comments >= 25 then
    v_want := array_append(v_want, 'giving_enthusiast');
  end if;

  if public.user_has_joined_force(p_user_id) then
    v_want := array_append(v_want, 'collab_joined_force');
  end if;
  if public.user_has_shared_victory(p_user_id) then
    v_want := array_append(v_want, 'collab_shared_victory');
  end if;

  return v_want;
end;
$$;

-- ---------------------------------------------------------------------------
-- Extend sync_user_badges (keeps Status / Donation / Tasks; adds families)
-- ---------------------------------------------------------------------------
create or replace function public.sync_user_badges(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint := 0;
  v_tasks int := 0;
  v_has_sub boolean := false;
  v_has_donor boolean := false;
  v_has_ship boolean := false;
  v_thr int;
  v_key text;
  v_want text[] := array[]::text[];
  v_extra text[] := array[]::text[];
  v_granted text[] := array[]::text[];
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;

  v_total := public.user_donation_total_cents(p_user_id);
  v_tasks := public.user_completed_task_count(p_user_id);
  v_has_sub := public.user_has_active_subscription(p_user_id);
  v_has_donor := v_total > 0;
  v_has_ship := public.user_has_shipped_game(p_user_id);

  if v_has_donor then
    v_want := array_append(v_want, 'status_donor');
  end if;

  if v_has_sub then
    v_want := array_append(v_want, 'status_active_subscriber');
  end if;

  if v_has_ship then
    v_want := array_append(v_want, 'status_game_shipper');
  end if;

  foreach v_thr in array public.badge_donation_thresholds_cents()
  loop
    if v_total >= v_thr then
      v_key := 'donation_' || (v_thr / 100)::text;
      v_want := array_append(v_want, v_key);
    end if;
  end loop;

  foreach v_thr in array public.badge_task_thresholds()
  loop
    if v_tasks >= v_thr then
      v_want := array_append(v_want, 'tasks_' || v_thr::text);
    end if;
  end loop;

  v_extra := public.badge_recognition_keys_for_user(p_user_id);
  if v_extra is not null and cardinality(v_extra) > 0 then
    v_want := v_want || v_extra;
  end if;

  if cardinality(v_want) > 0 then
    insert into public.user_badges (user_id, badge_key, source)
    select p_user_id, unnest(v_want), 'sync'
    on conflict (user_id, badge_key) do nothing;
  end if;

  if not v_has_sub then
    delete from public.user_badges
    where user_id = p_user_id
      and badge_key = 'status_active_subscriber';
  end if;

  update public.profiles p
  set pinned_badge_key = null
  where p.id = p_user_id
    and p.pinned_badge_key is not null
    and not exists (
      select 1 from public.user_badges ub
      where ub.user_id = p_user_id
        and ub.badge_key = p.pinned_badge_key
    );

  select coalesce(array_agg(ub.badge_key order by ub.badge_key), array[]::text[])
  into v_granted
  from public.user_badges ub
  where ub.user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'granted', to_jsonb(v_granted),
    'total_cents', v_total,
    'tasks_completed', v_tasks,
    'has_active_sub', v_has_sub,
    'has_donor', v_has_donor,
    'has_shipped_game', v_has_ship
  );
end;
$$;

revoke all on function public.sync_user_badges(uuid) from public;
grant execute on function public.sync_user_badges(uuid) to authenticated;
grant execute on function public.sync_user_badges(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Triggers: sync the people whose counts just changed
-- ---------------------------------------------------------------------------
create or replace function public.trg_sync_badges_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is not null then
    perform public.sync_user_badges(p_user_id);
  end if;
end;
$$;

create or replace function public.trg_sync_badges_on_idea()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.trg_sync_badges_user(NEW.user_id);
  if TG_OP = 'UPDATE' and OLD.user_id is distinct from NEW.user_id then
    perform public.trg_sync_badges_user(OLD.user_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_badges_on_idea on public.ideas;
do $$
begin
  if to_regclass('public.ideas') is not null then
    create trigger trg_sync_badges_on_idea
      after insert or update of status, user_id, votes
      on public.ideas
      for each row
      execute function public.trg_sync_badges_on_idea();
  end if;
end $$;

create or replace function public.trg_sync_badges_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  perform public.trg_sync_badges_user(NEW.user_id);
  if NEW.idea_id is not null and to_regclass('public.ideas') is not null then
    select i.user_id into v_author from public.ideas i where i.id = NEW.idea_id;
    if v_author is distinct from NEW.user_id then
      perform public.trg_sync_badges_user(v_author);
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_badges_on_comment on public.comments;
do $$
begin
  if to_regclass('public.comments') is not null then
    create trigger trg_sync_badges_on_comment
      after insert or update of content, user_id, idea_id
      on public.comments
      for each row
      execute function public.trg_sync_badges_on_comment();
  end if;
end $$;

create or replace function public.trg_sync_badges_on_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  if NEW.idea_id is not null and to_regclass('public.ideas') is not null then
    select i.user_id into v_author from public.ideas i where i.id = NEW.idea_id;
    perform public.trg_sync_badges_user(v_author);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_badges_on_vote on public.votes;
do $$
begin
  if to_regclass('public.votes') is not null then
    create trigger trg_sync_badges_on_vote
      after insert on public.votes
      for each row
      execute function public.trg_sync_badges_on_vote();
  end if;
end $$;

create or replace function public.trg_sync_badges_on_showcase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.trg_sync_badges_user(NEW.creator_user_id);
  if TG_OP = 'UPDATE'
     and OLD.creator_user_id is distinct from NEW.creator_user_id then
    perform public.trg_sync_badges_user(OLD.creator_user_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_badges_on_showcase
  on public.community_showcase_posts;
do $$
begin
  if to_regclass('public.community_showcase_posts') is not null then
    create trigger trg_sync_badges_on_showcase
      after insert or update of creator_user_id, status, likes
      on public.community_showcase_posts
      for each row
      execute function public.trg_sync_badges_on_showcase();
  end if;
end $$;

create or replace function public.trg_sync_badges_on_award()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.trg_sync_badges_user(NEW.giver_id);
  perform public.trg_sync_badges_user(NEW.receiver_id);
  return NEW;
end;
$$;

drop trigger if exists trg_sync_badges_on_award on public.forge_awards;
do $$
begin
  if to_regclass('public.forge_awards') is not null then
    create trigger trg_sync_badges_on_award
      after insert on public.forge_awards
      for each row
      execute function public.trg_sync_badges_on_award();
  end if;
end $$;

-- Claims: sync on any insert (Task Claimed), not only Completed
create or replace function public.trg_sync_badges_on_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.trg_sync_badges_user(NEW.user_id);
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    perform public.trg_sync_badges_user(NEW.user_id);
    if OLD.user_id is distinct from NEW.user_id then
      perform public.trg_sync_badges_user(OLD.user_id);
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_badges_on_claim on public.task_claims;
do $$
begin
  if to_regclass('public.task_claims') is not null then
    create trigger trg_sync_badges_on_claim
      after insert or update of status, user_id, task_id
      on public.task_claims
      for each row
      execute function public.trg_sync_badges_on_claim();
  end if;
end $$;

-- Widen backfill so existing users pick up the new families
create or replace function public.backfill_all_user_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  n int := 0;
  v_ids uuid[] := array[]::uuid[];
  v_extra uuid[];
begin
  select coalesce(array_agg(distinct d.user_id), array[]::uuid[])
  into v_ids
  from public.donations d
  where d.user_id is not null;

  if to_regclass('public.stripe_subscriptions') is not null then
    execute $q$
      select coalesce(array_agg(distinct s.user_id), array[]::uuid[])
      from public.stripe_subscriptions s
      where s.user_id is not null
    $q$ into v_extra;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.task_claims') is not null then
    execute $q$
      select coalesce(array_agg(distinct t.user_id), array[]::uuid[])
      from public.task_claims t
      where t.user_id is not null
    $q$ into v_extra;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.ideas') is not null then
    execute $q$
      select coalesce(array_agg(distinct i.user_id), array[]::uuid[])
      from public.ideas i
      where i.user_id is not null
    $q$ into v_extra;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.comments') is not null then
    execute $q$
      select coalesce(array_agg(distinct c.user_id), array[]::uuid[])
      from public.comments c
      where c.user_id is not null
    $q$ into v_extra;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.community_showcase_posts') is not null then
    execute $q$
      select coalesce(array_agg(distinct p.creator_user_id), array[]::uuid[])
      from public.community_showcase_posts p
      where p.creator_user_id is not null
    $q$ into v_extra;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.forge_awards') is not null then
    execute $q$
      select coalesce(
        array_agg(distinct u),
        array[]::uuid[]
      )
      from (
        select giver_id as u from public.forge_awards
        union
        select receiver_id from public.forge_awards
      ) x
      where u is not null
    $q$ into v_extra;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  select coalesce(array_agg(distinct u), array[]::uuid[])
  into v_ids
  from unnest(v_ids) as u
  where u is not null;

  foreach v_uid in array v_ids
  loop
    perform public.sync_user_badges(v_uid);
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'users_synced', n);
end;
$$;

grant execute on function public.backfill_all_user_badges() to service_role;

notify pgrst, 'reload schema';
