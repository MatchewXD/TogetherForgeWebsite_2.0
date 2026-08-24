


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."idea_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'suggested'::"text" NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "suggested_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "hidden_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "idea_tags_status_check" CHECK (("status" = ANY (ARRAY['curated'::"text", 'suggested'::"text", 'approved'::"text", 'hidden'::"text"]))),
    CONSTRAINT "idea_tags_usage_count_check" CHECK (("usage_count" >= 0))
);


ALTER TABLE "public"."idea_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."idea_tags" IS 'Hybrid tag catalog for Ideas: curated, suggested, approved, hidden + usage counts.';



CREATE OR REPLACE FUNCTION "public"."admin_approve_idea_tag"("p_id" "uuid") RETURNS "public"."idea_tags"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.idea_tags;
begin
  if not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;

  update public.idea_tags
  set
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    hidden_at = null
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Tag not found';
  end if;
  return v_row;
end;
$$;


ALTER FUNCTION "public"."admin_approve_idea_tag"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_idea_tag"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.idea_tags;
  r record;
  parts text[];
  rebuilt text[];
  part text;
  pslug text;
begin
  if not public.is_idea_tag_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_row from public.idea_tags where id = p_id;
  if not found then raise exception 'Tag not found'; end if;

  -- Strip from ideas
  for r in
    select id, tags from public.ideas
    where tags is not null and length(trim(tags)) > 0
  loop
    parts := regexp_split_to_array(r.tags, '[,;#|]+');
    rebuilt := array[]::text[];
    foreach part in array parts
    loop
      pslug := public.normalize_idea_tag_slug(part);
      if pslug is null or pslug = v_row.slug then
        continue;
      end if;
      rebuilt := array_append(rebuilt, public.normalize_idea_tag_name(part));
    end loop;
    update public.ideas
    set tags = nullif(array_to_string(rebuilt, ', '), '')
    where id = r.id;
  end loop;

  delete from public.idea_tags where id = p_id;
end;
$$;


ALTER FUNCTION "public"."admin_delete_idea_tag"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_hide_idea_tag"("p_id" "uuid") RETURNS "public"."idea_tags"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.idea_tags;
begin
  if not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;

  update public.idea_tags
  set status = 'hidden', hidden_at = now()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Tag not found';
  end if;
  return v_row;
end;
$$;


ALTER FUNCTION "public"."admin_hide_idea_tag"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_merge_idea_tags"("p_source_id" "uuid", "p_target_id" "uuid") RETURNS "public"."idea_tags"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_src public.idea_tags;
  v_tgt public.idea_tags;
  r record;
  parts text[];
  rebuilt text[];
  part text;
  pslug text;
  seen text[];
begin
  if not public.is_idea_tag_admin() and not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;
  if p_source_id = p_target_id then
    raise exception 'Source and target must differ';
  end if;

  select * into v_src from public.idea_tags where id = p_source_id;
  if not found then raise exception 'Source tag not found'; end if;
  select * into v_tgt from public.idea_tags where id = p_target_id;
  if not found then raise exception 'Target tag not found'; end if;

  for r in
    select id, tags from public.ideas
    where tags is not null and length(trim(tags)) > 0
  loop
    parts := regexp_split_to_array(r.tags, '[,;#|]+');
    rebuilt := array[]::text[];
    seen := array[]::text[];
    foreach part in array parts
    loop
      pslug := public.normalize_idea_tag_slug(part);
      if pslug is null then continue; end if;
      if pslug = v_src.slug then
        pslug := v_tgt.slug;
        part := v_tgt.name;
      else
        part := public.normalize_idea_tag_name(part);
      end if;
      if pslug = any (seen) then continue; end if;
      seen := array_append(seen, pslug);
      rebuilt := array_append(rebuilt, part);
    end loop;
    update public.ideas
    set tags = array_to_string(rebuilt, ', ')
    where id = r.id;
  end loop;

  -- Prefer stronger status on target
  update public.idea_tags
  set status = case
    when v_tgt.status = 'curated' or v_src.status = 'curated' then 'curated'
    when v_tgt.status = 'approved' or v_src.status = 'approved' then 'approved'
    when v_tgt.status = 'hidden' and v_src.status = 'hidden' then 'hidden'
    else v_tgt.status
  end
  where id = p_target_id
  returning * into v_tgt;

  delete from public.idea_tags where id = p_source_id;
  perform public.recompute_idea_tag_usage();

  select * into v_tgt from public.idea_tags where id = p_target_id;
  return v_tgt;
end;
$$;


ALTER FUNCTION "public"."admin_merge_idea_tags"("p_source_id" "uuid", "p_target_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_rename_idea_tag"("p_id" "uuid", "p_new_name" "text") RETURNS "public"."idea_tags"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_old public.idea_tags;
  v_new_name text;
  v_new_slug text;
  v_row public.idea_tags;
  r record;
  parts text[];
  rebuilt text[];
  part text;
  pslug text;
begin
  if not public.is_idea_tag_admin() and not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;

  select * into v_old from public.idea_tags where id = p_id;
  if not found then
    raise exception 'Tag not found';
  end if;

  v_new_name := public.normalize_idea_tag_name(p_new_name);
  v_new_slug := public.normalize_idea_tag_slug(v_new_name);
  if v_new_slug is null then
    raise exception 'Invalid tag name';
  end if;

  if exists (
    select 1 from public.idea_tags
    where slug = v_new_slug and id <> p_id
  ) then
    raise exception 'A tag with that name already exists. Merge instead.';
  end if;

  -- Rewrite free-text tags on ideas
  for r in
    select id, tags from public.ideas
    where tags is not null and length(trim(tags)) > 0
  loop
    parts := regexp_split_to_array(r.tags, '[,;#|]+');
    rebuilt := array[]::text[];
    foreach part in array parts
    loop
      pslug := public.normalize_idea_tag_slug(part);
      if pslug is null then
        continue;
      end if;
      if pslug = v_old.slug then
        rebuilt := array_append(rebuilt, v_new_name);
      else
        rebuilt := array_append(rebuilt, public.normalize_idea_tag_name(part));
      end if;
    end loop;
    update public.ideas
    set tags = array_to_string(rebuilt, ', ')
    where id = r.id;
  end loop;

  update public.idea_tags
  set slug = v_new_slug, name = v_new_name
  where id = p_id
  returning * into v_row;

  perform public.recompute_idea_tag_usage();
  return v_row;
end;
$$;


ALTER FUNCTION "public"."admin_rename_idea_tag"("p_id" "uuid", "p_new_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_unhide_idea_tag"("p_id" "uuid") RETURNS "public"."idea_tags"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.idea_tags;
begin
  if not public.is_idea_tag_staff() then
    raise exception 'Not authorized';
  end if;

  update public.idea_tags
  set
    status = case
      when status = 'hidden' and approved_at is not null then 'approved'
      when status = 'hidden' then 'suggested'
      else status
    end,
    hidden_at = null
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Tag not found';
  end if;
  return v_row;
end;
$$;


ALTER FUNCTION "public"."admin_unhide_idea_tag"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_token_ledger_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'ai_token_ledger is append-only';
end;
$$;


ALTER FUNCTION "public"."ai_token_ledger_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_claim_restriction"("p_user_id" "uuid", "p_actor_id" "uuid", "p_reason" "text", "p_task_id" "uuid" DEFAULT NULL::"uuid", "p_claim_id" "uuid" DEFAULT NULL::"uuid", "p_increment_fake" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_fake int := 0;
  v_until timestamptz := null;
  v_permanent boolean := false;
  v_restricted boolean := false;
  v_event text := 'restrict';
begin
  insert into public.user_task_restrictions (user_id, fake_rejection_count)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select fake_rejection_count into v_fake
  from public.user_task_restrictions
  where user_id = p_user_id
  for update;

  if p_increment_fake then
    v_fake := coalesce(v_fake, 0) + 1;
  end if;

  -- Escalation: 2 → 7 days, 3 → 30 days, 4+ → permanent
  if v_fake >= 4 then
    v_permanent := true;
    v_restricted := true;
    v_until := null;
    v_event := 'auto_restrict';
  elsif v_fake >= 3 then
    v_restricted := true;
    v_until := now() + interval '30 days';
    v_event := 'auto_restrict';
  elsif v_fake >= 2 then
    v_restricted := true;
    v_until := now() + interval '7 days';
    v_event := 'auto_restrict';
  else
    -- First fake rejection: warn only (still counted)
    v_restricted := false;
    v_until := null;
    v_event := 'warn';
  end if;

  -- Staff explicit restrict (increment still applies; force at least 7-day if first)
  if not p_increment_fake then
    v_restricted := true;
    if not v_permanent and v_until is null then
      v_until := now() + interval '7 days';
    end if;
    v_event := 'restrict';
  end if;

  update public.user_task_restrictions set
    is_restricted = v_restricted or is_permanent,
    is_permanent = v_permanent or is_permanent,
    restricted_until = case
      when v_permanent or is_permanent then null
      when v_restricted then v_until
      else restricted_until
    end,
    fake_rejection_count = v_fake,
    last_reason = coalesce(p_reason, last_reason),
    updated_at = now(),
    updated_by = p_actor_id
  where user_id = p_user_id;

  insert into public.task_restriction_events (
    user_id, actor_id, event_type, reason, task_id, claim_id, metadata
  ) values (
    p_user_id,
    p_actor_id,
    case when p_increment_fake and v_fake = 1 then 'fake_reject' else v_event end,
    p_reason,
    p_task_id,
    p_claim_id,
    jsonb_build_object(
      'fake_rejection_count', v_fake,
      'is_restricted', v_restricted or v_permanent,
      'is_permanent', v_permanent,
      'restricted_until', v_until
    )
  );

  -- Also log a dedicated fake_reject event when this was a fake-work reject
  if p_increment_fake and v_fake > 1 then
    insert into public.task_restriction_events (
      user_id, actor_id, event_type, reason, task_id, claim_id, metadata
    ) values (
      p_user_id, p_actor_id, 'fake_reject', p_reason, p_task_id, p_claim_id,
      jsonb_build_object('fake_rejection_count', v_fake)
    );
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'fake_rejection_count', v_fake,
    'is_restricted', v_restricted or v_permanent,
    'is_permanent', v_permanent,
    'restricted_until', v_until
  );
end;
$$;


ALTER FUNCTION "public"."apply_claim_restriction"("p_user_id" "uuid", "p_actor_id" "uuid", "p_reason" "text", "p_task_id" "uuid", "p_claim_id" "uuid", "p_increment_fake" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_action_allowed"("p_action" "text", "p_limit" integer, "p_window" interval, "p_min_gap" interval DEFAULT NULL::interval, "p_actor_key" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor text;
  v_count integer;
  v_last timestamptz;
begin
  if public.user_bypasses_abuse_limits() then
    return;
  end if;

  v_actor := nullif(trim(coalesce(p_actor_key, '')), '');
  if v_actor is null then
    if auth.uid() is null then
      raise exception 'SIGN_IN_REQUIRED'
        using errcode = 'P0001';
    end if;
    v_actor := 'user:' || auth.uid()::text;
  end if;

  if p_min_gap is not null then
    select max(created_at) into v_last
    from public.action_rate_events
    where actor_key = v_actor
      and action = p_action;
    if v_last is not null and v_last > now() - p_min_gap then
      perform public.flag_abuse('min_gap', p_action, jsonb_build_object('gap', p_min_gap::text));
      raise exception 'RATE_LIMITED'
        using errcode = 'P0001';
    end if;
  end if;

  select count(*)::integer into v_count
  from public.action_rate_events
  where actor_key = v_actor
    and action = p_action
    and created_at > now() - p_window;

  insert into public.action_rate_events (actor_key, action, meta)
  values (
    v_actor,
    p_action,
    jsonb_build_object('window', p_window::text, 'limit', p_limit)
  );

  if coalesce(v_count, 0) >= p_limit then
    if v_count in (p_limit, p_limit + 5, p_limit + 15) then
      perform public.flag_abuse(
        'rate_window',
        p_action,
        jsonb_build_object('count', v_count + 1, 'limit', p_limit)
      );
    end if;
    raise exception 'RATE_LIMITED'
      using errcode = 'P0001';
  end if;
end;
$$;


ALTER FUNCTION "public"."assert_action_allowed"("p_action" "text", "p_limit" integer, "p_window" interval, "p_min_gap" interval, "p_actor_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_all_user_badges"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."backfill_all_user_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."badge_comment_is_meaningful"("p_content" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select char_length(trim(coalesce(p_content, ''))) >= 20;
$$;


ALTER FUNCTION "public"."badge_comment_is_meaningful"("p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."badge_donation_thresholds_cents"() RETURNS integer[]
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select array[
    1000,      -- $10
    5000,      -- $50
    10000,     -- $100
    25000,     -- $250
    50000,     -- $500
    100000,    -- $1,000
    250000,    -- $2,500
    500000,    -- $5,000
    1000000,   -- $10,000
    2500000,   -- $25,000
    5000000,   -- $50,000
    10000000   -- $100,000
  ]::int[];
$_$;


ALTER FUNCTION "public"."badge_donation_thresholds_cents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."badge_is_public_idea_status"("p_status" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select
    p_status is null
    or lower(trim(p_status)) not in ('draft', 'archived', 'hidden', 'rejected');
$$;


ALTER FUNCTION "public"."badge_is_public_idea_status"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."badge_recognition_keys_for_user"("p_user_id" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."badge_recognition_keys_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."badge_task_thresholds"() RETURNS integer[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select array[1, 5, 10, 25, 50, 75, 100, 150, 200, 250]::int[];
$$;


ALTER FUNCTION "public"."badge_task_thresholds"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_idea_tag_usage"("p_names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n text;
  v_name text;
  v_slug text;
begin
  if p_names is null then
    return;
  end if;
  foreach n in array p_names
  loop
    v_name := public.normalize_idea_tag_name(n);
    v_slug := public.normalize_idea_tag_slug(v_name);
    if v_slug is null then
      continue;
    end if;
    insert into public.idea_tags (slug, name, status, usage_count, suggested_by)
    values (v_slug, v_name, 'suggested', 1, auth.uid())
    on conflict (slug) do update
      set usage_count = public.idea_tags.usage_count + 1;
  end loop;
end;
$$;


ALTER FUNCTION "public"."bump_idea_tag_usage"("p_names" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_task_scope_request"("p_request_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_req public.task_scope_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_req
  from public.task_scope_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Scope request not found';
  end if;
  if v_req.requester_id <> v_uid and not public.is_project_staff() then
    raise exception 'Only the requester or staff can cancel this';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  update public.task_scope_requests set
    status = 'cancelled',
    resolved_at = now(),
    resolved_by = v_uid
  where id = p_request_id;

  return jsonb_build_object('ok', true, 'status', 'cancelled');
end;
$$;


ALTER FUNCTION "public"."cancel_task_scope_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."canonical_ai_token_pack_tokens"("p_pack_id" "text", "p_amount_cents" integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when lower(trim(coalesce(p_pack_id, ''))) = 'starter' then 250000
    when lower(trim(coalesce(p_pack_id, ''))) = 'builder' then 600000
    when lower(trim(coalesce(p_pack_id, ''))) = 'studio' then 1250000
    when coalesce(p_amount_cents, 0) >= 2500 then 1250000
    when coalesce(p_amount_cents, 0) >= 1200 then 600000
    when coalesce(p_amount_cents, 0) >= 500 then 250000
    else 0
  end;
$$;


ALTER FUNCTION "public"."canonical_ai_token_pack_tokens"("p_pack_id" "text", "p_amount_cents" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."canonical_ai_token_pack_tokens"("p_pack_id" "text", "p_amount_cents" integer) IS 'Published pack sizes. Never grant the legacy 250/700/1600 amounts.';



CREATE OR REPLACE FUNCTION "public"."claim_task"("p_task_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_active int := 0;
  v_completed int := 0;
  v_limit int := 2;
  v_last timestamptz;
  v_depth int := 0;
  v_child_count int := 0;
  v_bypass boolean := false;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  v_bypass := public.user_bypasses_task_limits(v_uid);

  if not public.user_meets_identity_gate(v_uid) then
    raise exception 'IDENTITY_GATE: Verify your email and link Discord or Google before claiming tasks.';
  end if;

  if public.user_is_claim_restricted(v_uid) then
    raise exception 'CLAIM_RESTRICTED: Your claim privileges are temporarily limited due to prior review issues. Contact a Project Lead via Discord to appeal.';
  end if;

  begin
    perform public.return_stale_claims(14);
  exception when others then
    null;
  end;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status = 'Completed' then
    raise exception 'Task is already completed';
  end if;

  if v_task.status = 'InReview' then
    raise exception 'Task is waiting for review and cannot be claimed';
  end if;

  begin
    v_depth := public.task_nesting_depth(p_task_id);
  exception when undefined_function then
    v_depth := case when v_task.parent_task_id is null then 0 else 1 end;
  end;

  if v_depth = 0 then
    raise exception 'Epics cannot be claimed. Claim a Medium or Small task under this epic.';
  end if;

  select count(*)::integer into v_child_count
  from tasks
  where parent_task_id = p_task_id;

  if v_child_count > 0 then
    raise exception 'This task has sub-tasks and cannot be claimed. Claim a leaf task instead.';
  end if;

  if exists (
    select 1 from task_claims
    where task_id = p_task_id and status in ('Active', 'PendingReview')
  ) then
    raise exception 'Task already has an active claim';
  end if;

  select count(*) into v_active
  from task_claims
  where user_id = v_uid and status in ('Active', 'PendingReview');

  v_completed := public.user_accepted_task_count(v_uid);
  v_limit := public.user_claim_limit(v_uid);

  if v_active >= v_limit then
    raise exception 'Claim limit reached (% / %). New accounts start with 2 slots; limits rise after accepted reviews (2+ → 3, 5+ → 5).',
      v_active, v_limit;
  end if;

  if not v_bypass then
    select max(claimed_at) into v_last
    from task_claims
    where user_id = v_uid and claimed_at is not null;

    if v_last is not null and v_last > now() - interval '30 minutes' then
      raise exception 'Please wait before claiming another task (30 minute cooldown).';
    end if;
  end if;

  insert into task_claims (
    task_id, user_id, status, progress_percent, last_activity_at, claimed_at
  )
  values (p_task_id, v_uid, 'Active', 0, now(), now())
  returning * into v_claim;

  update tasks set status = 'InProgress' where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'claimed',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'claim_id', v_claim.id,
      'accepted_count', v_completed,
      'claim_limit', v_limit,
      'rate_limit_bypass', v_bypass
    )
  );

  return jsonb_build_object(
    'claim', to_jsonb(v_claim),
    'task', to_jsonb(v_task),
    'active_claims', v_active + 1,
    'claim_limit', v_limit,
    'rate_limit_bypass', v_bypass
  );
end;
$$;


ALTER FUNCTION "public"."claim_task"("p_task_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_task"("p_task_id" "uuid") IS 'Claim Medium/Small leaf tasks only. Epics and parents with children are blocked.';



CREATE OR REPLACE FUNCTION "public"."clawback_forge_marks_for_donation"("p_donation_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  grant_row public.forge_mark_ledger;
  bal integer;
  take integer;
  ledger_id uuid;
begin
  if p_donation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_donation');
  end if;

  select * into grant_row
  from public.forge_mark_ledger
  where donation_id = p_donation_id
    and entry_type = 'donation_grant'
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'reason', 'no_grant');
  end if;

  if exists (
    select 1 from public.forge_mark_ledger
    where donation_id = p_donation_id
      and entry_type = 'refund_clawback'
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  perform public.ensure_forge_mark_balance(grant_row.user_id);
  select balance into bal
  from public.forge_mark_balances
  where user_id = grant_row.user_id
  for update;

  take := least(greatest(grant_row.marks_display, 0), greatest(bal, 0));
  if take <= 0 then
    return jsonb_build_object('ok', true, 'clawed', 0, 'reason', 'nothing_to_claw');
  end if;

  insert into public.forge_mark_ledger (
    user_id,
    entry_type,
    marks,
    marks_display,
    donation_id,
    idempotency_key,
    note
  ) values (
    grant_row.user_id,
    'refund_clawback',
    -take,
    take,
    p_donation_id,
    'donation-clawback:' || p_donation_id::text,
    'Refund / failed donation'
  )
  returning id into ledger_id;

  update public.forge_mark_balances
  set
    balance = balance - take,
    updated_at = now()
  where user_id = grant_row.user_id
    and balance >= take;

  return jsonb_build_object('ok', true, 'clawed', take, 'ledger_id', ledger_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;


ALTER FUNCTION "public"."clawback_forge_marks_for_donation"("p_donation_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_task"("p_task_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not v_is_staff then
    raise exception 'Only a Project Lead or moderator can mark a task completed. Submit your work for review instead.';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status in ('Active', 'PendingReview')
  for update;

  if found then
    update task_claims set
      status = 'Completed',
      progress_percent = 100,
      last_activity_at = now(),
      reviewed_at = coalesce(reviewed_at, now()),
      reviewed_by = coalesce(reviewed_by, v_uid)
    where id = v_claim.id
    returning * into v_claim;
  end if;

  update tasks set
    status = 'Completed',
    completed_at = now(),
    subtasks = (
      select coalesce(jsonb_agg(
        case
          when jsonb_typeof(elem) = 'object'
            then elem || jsonb_build_object('done', true)
          else elem
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(coalesce(v_task.subtasks, '[]'::jsonb)) elem
    )
  where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'completed',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object('claim_id', v_claim.id, 'staff_complete', true)
  );

  return jsonb_build_object('task', to_jsonb(v_task), 'claim', to_jsonb(v_claim));
end;
$$;


ALTER FUNCTION "public"."complete_task"("p_task_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_token_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_type" "text" NOT NULL,
    "tokens" integer NOT NULL,
    "tokens_display" integer NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "prompt_summary" "text",
    "action_key" "text",
    "pack_id" "text",
    "purchase_id" "uuid",
    "source" "text",
    "source_ref" "text",
    "provider" "text",
    "model" "text",
    "api_cost_usd_micros" bigint DEFAULT 0 NOT NULL,
    "margin_usd_micros" bigint DEFAULT 0 NOT NULL,
    "stripe_session_id" "text",
    "stripe_payment_intent" "text",
    "idempotency_key" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_token_ledger_api_cost_usd_micros_check" CHECK (("api_cost_usd_micros" >= 0)),
    CONSTRAINT "ai_token_ledger_entry_type_chk" CHECK (("entry_type" = ANY (ARRAY['purchase'::"text", 'spend'::"text", 'refund'::"text", 'award'::"text", 'adjustment'::"text"]))),
    CONSTRAINT "ai_token_ledger_status_chk" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'pending'::"text", 'refunded'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "ai_token_ledger_tokens_display_check" CHECK (("tokens_display" >= 0))
);


ALTER TABLE "public"."ai_token_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_token_ledger" IS 'Immutable AI token movements. Cost/margin columns are internal-only.';



CREATE OR REPLACE FUNCTION "public"."credit_ai_tokens"("p_user_id" "uuid", "p_tokens" integer, "p_entry_type" "text", "p_status" "text" DEFAULT 'success'::"text", "p_prompt_summary" "text" DEFAULT NULL::"text", "p_pack_id" "text" DEFAULT NULL::"text", "p_purchase_id" "uuid" DEFAULT NULL::"uuid", "p_source" "text" DEFAULT NULL::"text", "p_source_ref" "text" DEFAULT NULL::"text", "p_stripe_session_id" "text" DEFAULT NULL::"text", "p_stripe_payment_intent" "text" DEFAULT NULL::"text", "p_idempotency_key" "text" DEFAULT NULL::"text", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."ai_token_ledger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  ledger_row public.ai_token_ledger;
  existing public.ai_token_ledger;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;
  if p_tokens is null or p_tokens <= 0 then
    raise exception 'tokens must be positive';
  end if;
  if p_entry_type not in ('purchase', 'award', 'adjustment', 'refund') then
    raise exception 'invalid entry_type for credit';
  end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.ai_token_ledger
    where idempotency_key = p_idempotency_key
    limit 1;
    if found then
      return existing;
    end if;
  end if;

  perform public.ensure_ai_token_balance(p_user_id);

  insert into public.ai_token_ledger (
    user_id, entry_type, tokens, tokens_display, status, prompt_summary,
    pack_id, purchase_id, source, source_ref,
    stripe_session_id, stripe_payment_intent, idempotency_key, meta
  ) values (
    p_user_id, p_entry_type, p_tokens, p_tokens, coalesce(p_status, 'success'),
    p_prompt_summary, p_pack_id, p_purchase_id, p_source, p_source_ref,
    p_stripe_session_id, p_stripe_payment_intent, p_idempotency_key,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning * into ledger_row;

  update public.ai_token_balances
  set
    balance = balance + p_tokens,
    lifetime_purchased = lifetime_purchased
      + case when p_entry_type = 'purchase' then p_tokens else 0 end,
    lifetime_awarded = lifetime_awarded
      + case when p_entry_type = 'award' then p_tokens else 0 end,
    updated_at = now()
  where user_id = p_user_id;

  return ledger_row;
end;
$$;


ALTER FUNCTION "public"."credit_ai_tokens"("p_user_id" "uuid", "p_tokens" integer, "p_entry_type" "text", "p_status" "text", "p_prompt_summary" "text", "p_pack_id" "text", "p_purchase_id" "uuid", "p_source" "text", "p_source_ref" "text", "p_stripe_session_id" "text", "p_stripe_payment_intent" "text", "p_idempotency_key" "text", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_auth_context"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
begin
  return json_build_object(
    'uid', auth.uid(),
    'request_uid', public.request_uid(),
    'role_guc', current_setting('request.jwt.claim.role', true),
    'sub_guc', current_setting('request.jwt.claim.sub', true),
    'claims_sub', nullif(v_claims, '')::jsonb ->> 'sub',
    'has_claims', v_claims is not null and v_claims <> ''
  );
end;
$$;


ALTER FUNCTION "public"."debug_auth_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_concern_report_rate"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor text;
begin
  v_actor := case
    when new.user_id is not null then 'user:' || new.user_id::text
    when length(trim(coalesce(new.contact, ''))) > 3
      then 'contact:' || md5(lower(trim(new.contact)))
    else 'report:' || md5(left(lower(trim(new.what_happened)), 80))
  end;
  perform public.assert_action_allowed(
    'concern_report',
    5,
    interval '15 minutes',
    interval '20 seconds',
    v_actor
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_concern_report_rate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_idea_comment_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if public.user_bypasses_abuse_limits() then
    return new;
  end if;
  if new.user_id is distinct from auth.uid() then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(new.content, ''))) < 2 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  perform public.assert_action_allowed(
    'idea_comment',
    45,
    interval '15 minutes',
    interval '2 seconds'
  );

  if exists (
    select 1
    from comments c
    where c.user_id = new.user_id
      and c.idea_id = new.idea_id
      and lower(trim(c.content)) = lower(trim(new.content))
      and c.created_at > now() - interval '20 minutes'
  ) then
    perform public.flag_abuse('duplicate_comment', 'idea_comment');
    raise exception 'DUPLICATE_CONTENT' using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_idea_comment_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_idea_submit_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_title text;
  v_is_draft boolean;
  v_was_draft boolean;
  v_publishing boolean;
  v_actor uuid;
  v_vote_cols text[] := array['votes', 'votes_public', 'votes_public_at', 'last_vote_time'];
begin
  if tg_op = 'UPDATE' then
    if current_setting('app.idea_vote_count_update', true) = '1'
       or (
         (to_jsonb(new) - v_vote_cols)
         is not distinct from
         (to_jsonb(old) - v_vote_cols)
       )
    then
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.votes := 0;
    new.votes_public := 0;
    new.votes_public_at := now();
    if new.public_id is null then
      new.public_id := gen_random_uuid();
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.user_bypasses_abuse_limits() then
      new.votes := old.votes;
      new.votes_public := old.votes_public;
      new.votes_public_at := old.votes_public_at;
      new.public_id := coalesce(old.public_id, new.public_id);
    end if;
  end if;

  if public.user_bypasses_abuse_limits() then
    return new;
  end if;

  begin
    v_actor := public.request_uid();
  exception
    when undefined_function then
      v_actor := auth.uid();
  end;
  if v_actor is null then
    v_actor := auth.uid();
  end if;
  if new.user_id is distinct from v_actor then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;

  v_is_draft := coalesce(new.status, 'Proposed') = 'Draft';
  v_was_draft := tg_op = 'UPDATE' and coalesce(old.status, 'Proposed') = 'Draft';
  v_publishing :=
    (tg_op = 'INSERT' and not v_is_draft)
    or (tg_op = 'UPDATE' and v_was_draft and not v_is_draft);

  if v_is_draft and tg_op = 'INSERT' then
    perform public.assert_action_allowed(
      'idea_draft',
      30,
      interval '24 hours',
      interval '8 seconds'
    );
    return new;
  end if;

  if v_publishing then
    perform public.assert_action_allowed(
      'idea_publish',
      8,
      interval '24 hours',
      interval '90 seconds'
    );

    v_title := public.normalize_idea_title(new.title);
    if length(v_title) >= 8 then
      if exists (
        select 1
        from ideas i
        where i.user_id = new.user_id
          and i.id is distinct from new.id
          and coalesce(i.status, 'Proposed') is distinct from 'Draft'
          and public.normalize_idea_title(i.title) = v_title
          and i.created_at > now() - interval '48 hours'
      ) then
        perform public.flag_abuse('duplicate_title', 'idea_publish');
        raise exception 'DUPLICATE_CONTENT' using errcode = 'P0001';
      end if;
    end if;

    if length(trim(coalesce(new.description, new.summary, ''))) >= 80 then
      if exists (
        select 1
        from ideas i
        where i.user_id = new.user_id
          and i.id is distinct from new.id
          and coalesce(i.status, 'Proposed') is distinct from 'Draft'
          and left(lower(trim(coalesce(i.description, i.summary, ''))), 160)
            = left(lower(trim(coalesce(new.description, new.summary, ''))), 160)
          and i.created_at > now() - interval '24 hours'
      ) then
        perform public.flag_abuse('duplicate_body', 'idea_publish');
        raise exception 'DUPLICATE_CONTENT' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_idea_submit_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_idea_vote_rate"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row_user uuid := coalesce(new.user_id, old.user_id);
begin
  if v_row_user is null then
    return coalesce(new, old);
  end if;
  perform public.assert_action_allowed(
    'idea_vote',
    200,
    interval '15 minutes',
    interval '200 milliseconds',
    'user:' || v_row_user::text
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."enforce_idea_vote_rate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_showcase_like_rate"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.assert_action_allowed(
    'showcase_like',
    200,
    interval '15 minutes',
    interval '200 milliseconds'
  );
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."enforce_showcase_like_rate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_showcase_submit_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if public.user_bypasses_abuse_limits() then
      return new;
    end if;
    perform public.assert_action_allowed(
      'showcase_submit',
      8,
      interval '24 hours',
      interval '2 minutes'
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_showcase_submit_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_task_claim_rate"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.assert_action_allowed(
    'task_claim',
    12,
    interval '10 minutes',
    interval '2 seconds'
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_task_claim_rate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_task_parent"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_parent tasks%rowtype;
  v_parent_depth integer;
  v_walk uuid;
  v_guard integer := 0;
begin
  if new.parent_task_id is null then
    return new;
  end if;

  if new.parent_task_id = new.id then
    raise exception 'Task cannot be its own parent';
  end if;

  select * into v_parent from tasks where id = new.parent_task_id;
  if not found then
    raise exception 'Parent task not found';
  end if;

  if v_parent.project_id is distinct from new.project_id then
    raise exception 'Parent task must belong to the same project';
  end if;

  -- Cycle check: walk ancestors of parent; none may be new.id
  v_walk := new.parent_task_id;
  while v_walk is not null loop
    if v_walk = new.id then
      raise exception 'Task hierarchy cycle detected';
    end if;
    select parent_task_id into v_walk from tasks where id = v_walk;
    v_guard := v_guard + 1;
    if v_guard > 10 then
      raise exception 'Task hierarchy too deep or cyclic';
    end if;
  end loop;

  -- Max 3 levels: parent depth can be 0 or 1 only (child becomes 1 or 2)
  v_parent_depth := public.task_nesting_depth(new.parent_task_id);
  if v_parent_depth >= 2 then
    raise exception 'Maximum nesting is 3 levels (Epic → Medium → Small). Cannot add under a Small task.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_task_parent"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_volunteer_app_rate"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor text;
begin
  if public.user_bypasses_abuse_limits() then
    return new;
  end if;
  v_actor := case
    when new.user_id is not null then 'user:' || new.user_id::text
    when length(trim(coalesce(new.email, ''))) > 3
      then 'email:' || md5(lower(trim(new.email)))
    else 'vol:' || md5(lower(trim(coalesce(new.handle, new.discord_username, 'x'))))
  end;
  perform public.assert_action_allowed(
    'volunteer_app',
    4,
    interval '15 minutes',
    interval '30 seconds',
    v_actor
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_volunteer_app_rate"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_token_balances" (
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "lifetime_purchased" integer DEFAULT 0 NOT NULL,
    "lifetime_spent" integer DEFAULT 0 NOT NULL,
    "lifetime_awarded" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_token_balances_balance_check" CHECK (("balance" >= 0)),
    CONSTRAINT "ai_token_balances_lifetime_awarded_check" CHECK (("lifetime_awarded" >= 0)),
    CONSTRAINT "ai_token_balances_lifetime_purchased_check" CHECK (("lifetime_purchased" >= 0)),
    CONSTRAINT "ai_token_balances_lifetime_spent_check" CHECK (("lifetime_spent" >= 0))
);


ALTER TABLE "public"."ai_token_balances" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_token_balances" IS 'Per-user AI token balance. Separate from donations.';



CREATE OR REPLACE FUNCTION "public"."ensure_ai_token_balance"("p_user_id" "uuid") RETURNS "public"."ai_token_balances"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  row public.ai_token_balances;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;
  insert into public.ai_token_balances (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
  select * into row from public.ai_token_balances where user_id = p_user_id;
  return row;
end;
$$;


ALTER FUNCTION "public"."ensure_ai_token_balance"("p_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forge_mark_balances" (
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "lifetime_earned" integer DEFAULT 0 NOT NULL,
    "lifetime_spent" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forge_mark_balances_balance_check" CHECK (("balance" >= 0)),
    CONSTRAINT "forge_mark_balances_lifetime_earned_check" CHECK (("lifetime_earned" >= 0)),
    CONSTRAINT "forge_mark_balances_lifetime_spent_check" CHECK (("lifetime_spent" >= 0))
);


ALTER TABLE "public"."forge_mark_balances" OWNER TO "postgres";


COMMENT ON TABLE "public"."forge_mark_balances" IS 'Per-user Forge Marks. Earned from completed donations; spent on Community Awards. Never cash, never transferred.';



CREATE OR REPLACE FUNCTION "public"."ensure_forge_mark_balance"("p_user_id" "uuid") RETURNS "public"."forge_mark_balances"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  row public.forge_mark_balances;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;
  insert into public.forge_mark_balances (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
  select * into row from public.forge_mark_balances where user_id = p_user_id;
  return row;
end;
$$;


ALTER FUNCTION "public"."ensure_forge_mark_balance"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_idea_tag"("p_name" "text", "p_as_curated" boolean DEFAULT false) RETURNS "public"."idea_tags"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_name text;
  v_slug text;
  v_row public.idea_tags;
  v_status text;
begin
  v_name := public.normalize_idea_tag_name(p_name);
  v_slug := public.normalize_idea_tag_slug(v_name);
  if v_slug is null then
    raise exception 'Invalid tag name';
  end if;

  select * into v_row from public.idea_tags where slug = v_slug limit 1;
  if found then
    return v_row;
  end if;

  v_status := case when p_as_curated then 'curated' else 'suggested' end;

  insert into public.idea_tags (slug, name, status, suggested_by)
  values (
    v_slug,
    v_name,
    v_status,
    case when p_as_curated then null else auth.uid() end
  )
  on conflict (slug) do update
    set name = excluded.name
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."ensure_idea_tag"("p_name" "text", "p_as_curated" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_project_contribution"("p_project_id" "uuid", "p_user_id" "uuid", "p_display_name" "text", "p_category" "text", "p_subcategory" "text" DEFAULT NULL::"text", "p_role_label" "text" DEFAULT NULL::"text", "p_source_key" "text" DEFAULT NULL::"text", "p_project_title" "text" DEFAULT NULL::"text", "p_username" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
  v_title text;
  v_display text;
  v_username text;
begin
  if p_category is null
     or p_category not in ('donations', 'development', 'marketing', 'community') then
    raise exception 'Invalid contribution category';
  end if;

  -- Non-donation rows need a user
  if p_category <> 'donations' and p_user_id is null then
    raise exception 'Account required for this contribution category';
  end if;

  v_display := nullif(trim(coalesce(p_display_name, '')), '');
  v_username := nullif(trim(coalesce(p_username, '')), '');

  if v_display is null and p_user_id is not null then
    select coalesce(nullif(trim(username), ''), 'Contributor')
      into v_display
    from profiles
    where id = p_user_id;
  end if;
  v_display := coalesce(v_display, 'Contributor');

  if v_username is null and p_user_id is not null then
    select nullif(trim(username), '') into v_username
    from profiles where id = p_user_id;
  end if;

  v_title := nullif(trim(coalesce(p_project_title, '')), '');
  if v_title is null and p_project_id is not null then
    select coalesce(nullif(trim(title), ''), nullif(trim(slug), ''), 'Project')
      into v_title
    from projects
    where id = p_project_id;
  end if;

  if p_source_key is not null and trim(p_source_key) <> '' then
    select id into v_id
    from project_contributions
    where source_key = trim(p_source_key)
    limit 1;

    if v_id is not null then
      -- Refresh snapshots if empty; never drop the credit
      update project_contributions
      set
        display_name = coalesce(nullif(trim(display_name), ''), v_display),
        username_snapshot = coalesce(username_snapshot, v_username),
        project_title_snapshot = coalesce(project_title_snapshot, v_title),
        project_id = coalesce(project_id, p_project_id),
        archived_at = null,
        updated_at = now()
      where id = v_id;
      return v_id;
    end if;
  end if;

  insert into project_contributions (
    project_id,
    user_id,
    display_name,
    category,
    subcategory,
    role_label,
    source_key,
    project_title_snapshot,
    username_snapshot,
    is_anonymous,
    sort_order
  ) values (
    p_project_id,
    p_user_id,
    v_display,
    p_category,
    nullif(trim(coalesce(p_subcategory, '')), ''),
    nullif(trim(coalesce(p_role_label, '')), ''),
    nullif(trim(coalesce(p_source_key, '')), ''),
    v_title,
    v_username,
    false,
    0
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."ensure_project_contribution"("p_project_id" "uuid", "p_user_id" "uuid", "p_display_name" "text", "p_category" "text", "p_subcategory" "text", "p_role_label" "text", "p_source_key" "text", "p_project_title" "text", "p_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evidence_has_url"("p_evidence" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(p_evidence, '') ~* 'https?://[^\s<>"{}|\\^`\[\]]+';
$$;


ALTER FUNCTION "public"."evidence_has_url"("p_evidence" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evidence_note_body"("p_evidence" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  v text := trim(coalesce(p_evidence, ''));
  v_links_pos int;
  v_blocked_pos int;
begin
  -- Strip structured sections added by the client composeReviewEvidence helper
  v_links_pos := position(E'\n\nLinks:' in v);
  if v_links_pos > 0 then
    v := left(v, v_links_pos - 1);
  end if;
  v_blocked_pos := position(E'\n\nBlocked by / depends on:' in v);
  if v_blocked_pos > 0 then
    v := left(v, v_blocked_pos - 1);
  end if;
  return trim(v);
end;
$$;


ALTER FUNCTION "public"."evidence_note_body"("p_evidence" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."flag_abuse"("p_reason" "text", "p_action" "text" DEFAULT NULL::"text", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.abuse_flags (actor_key, user_id, action, reason, meta)
  values (
    case
      when auth.uid() is not null then 'user:' || auth.uid()::text
      else 'anon'
    end,
    auth.uid(),
    p_action,
    left(coalesce(p_reason, 'flag'), 240),
    coalesce(p_meta, '{}'::jsonb)
  );
exception
  when others then
    null;
end;
$$;


ALTER FUNCTION "public"."flag_abuse"("p_reason" "text", "p_action" "text", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."flag_profile_signup_burst"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_n integer;
begin
  select count(*)::integer into v_n
  from profiles
  where coalesce(joined_at, now()) > now() - interval '5 minutes';

  if v_n >= 25 then
    insert into public.abuse_flags (actor_key, user_id, action, reason, meta)
    values (
      'global',
      new.id,
      'signup',
      'signup_burst',
      jsonb_build_object('recent', v_n)
    );
  end if;
  return new;
exception
  when others then
    return new;
end;
$$;


ALTER FUNCTION "public"."flag_profile_signup_burst"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forge_mark_ledger_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'forge_mark_ledger is append-only';
end;
$$;


ALTER FUNCTION "public"."forge_mark_ledger_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forge_marks_for_amount_cents"("p_amount_cents" integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when coalesce(p_amount_cents, 0) <= 0 then 0
    when p_amount_cents >= 50000 then ((p_amount_cents::bigint * 150) / 100)::integer
    when p_amount_cents >= 25000 then ((p_amount_cents::bigint * 140) / 100)::integer
    when p_amount_cents >= 10000 then ((p_amount_cents::bigint * 130) / 100)::integer
    when p_amount_cents >= 5000 then ((p_amount_cents::bigint * 120) / 100)::integer
    when p_amount_cents >= 2500 then ((p_amount_cents::bigint * 110) / 100)::integer
    else ((p_amount_cents::bigint * 100) / 100)::integer
  end;
$$;


ALTER FUNCTION "public"."forge_marks_for_amount_cents"("p_amount_cents" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."forge_marks_for_amount_cents"("p_amount_cents" integer) IS 'Whole-gift Marks for a donation in cents. Integer division matches floor.';



CREATE OR REPLACE FUNCTION "public"."get_active_project_id_for_donations"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id
  from projects p
  where p.completed_at is null
    and (
      p.status is null
      or lower(trim(p.status)) in (
        'in development',
        'in-development',
        'development',
        'active',
        'live',
        ''
      )
    )
    and lower(coalesce(p.status, '')) not in (
      'completed', 'complete', 'shipped', 'released', 'done',
      'planning', 'planned', 'on hold', 'on-hold', 'hold',
      'queued', 'upcoming', 'concept', 'vision'
    )
  order by
    case
      when lower(coalesce(p.phase, '')) like 'early%' then 0
      when lower(coalesce(p.phase, '')) like 'mid%' then 1
      when lower(coalesce(p.phase, '')) like 'late%' then 2
      else 3
    end,
    coalesce(p.sort_order, 0) asc,
    p.created_at asc nulls last
  limit 1;
$$;


ALTER FUNCTION "public"."get_active_project_id_for_donations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_active_project_id_for_donations"() IS 'Project UUID for new studio donations (active In Development only). Null if none active.';



CREATE OR REPLACE FUNCTION "public"."get_ai_service_availability"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  cfg public.ai_platform_config;
  day_micros bigint;
  month_micros bigint;
  day_cap_micros bigint;
  month_cap_micros bigint;
  day_hit boolean := false;
  month_hit boolean := false;
  enabled boolean := true;
  reason text := null;
  message text := null;
begin
  select * into cfg from public.ai_platform_config where id = 1;
  if not found then
    cfg.services_enabled := true;
    cfg.daily_spend_cap_cents := 5000;
    cfg.monthly_spend_cap_cents := 100000;
  end if;

  day_cap_micros := greatest(coalesce(cfg.daily_spend_cap_cents, 0), 0)::bigint * 10000;
  month_cap_micros := greatest(coalesce(cfg.monthly_spend_cap_cents, 0), 0)::bigint * 10000;

  select coalesce(sum(api_cost_usd_micros), 0) into day_micros
  from public.ai_generation_log
  where created_at >= date_trunc('day', now() at time zone 'utc')
    and status = 'success';

  select coalesce(sum(api_cost_usd_micros), 0) into month_micros
  from public.ai_generation_log
  where created_at >= date_trunc('month', now() at time zone 'utc')
    and status = 'success';

  if day_cap_micros > 0 and day_micros >= day_cap_micros then
    day_hit := true;
  end if;
  if month_cap_micros > 0 and month_micros >= month_cap_micros then
    month_hit := true;
  end if;

  if not coalesce(cfg.services_enabled, true) then
    enabled := false;
    reason := 'manually_disabled';
    message := coalesce(
      nullif(trim(cfg.disabled_reason), ''),
      'AI services are temporarily unavailable. Please try again later.'
    );
  elsif day_hit or month_hit then
    enabled := false;
    reason := case when day_hit then 'daily_spend_cap' else 'monthly_spend_cap' end;
    message :=
      'AI services are temporarily unavailable due to usage limits. Please try again later.';
  else
    enabled := true;
    reason := null;
    message := null;
  end if;

  return jsonb_build_object(
    'enabled', enabled,
    'reason', reason,
    'message', message,
    'user_hourly_request_cap', coalesce(cfg.user_hourly_request_cap, 30),
    'user_daily_request_cap', coalesce(cfg.user_daily_request_cap, 100)
  );
end;
$$;


ALTER FUNCTION "public"."get_ai_service_availability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ai_studio_spend_micros"("p_period" "text" DEFAULT 'day'::"text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  total bigint;
begin
  if p_period = 'month' then
    select coalesce(sum(api_cost_usd_micros), 0) into total
    from public.ai_generation_log
    where created_at >= date_trunc('month', now() at time zone 'utc')
      and status = 'success';
  else
    select coalesce(sum(api_cost_usd_micros), 0) into total
    from public.ai_generation_log
    where created_at >= date_trunc('day', now() at time zone 'utc')
      and status = 'success';
  end if;
  return total;
end;
$$;


ALTER FUNCTION "public"."get_ai_studio_spend_micros"("p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_contributor_trust"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_completed int := 0;
  v_active int := 0;
  v_pending int := 0;
  v_joined timestamptz;
  v_restricted boolean := false;
  v_row public.user_task_restrictions%rowtype;
  v_age_days int := 0;
begin
  if p_user_id is null then
    return jsonb_build_object('found', false);
  end if;

  -- Staff or self
  if auth.uid() is distinct from p_user_id and not public.is_project_staff() then
    raise exception 'Not allowed';
  end if;

  v_completed := public.user_accepted_task_count(p_user_id);

  select count(*) into v_active
  from task_claims
  where user_id = p_user_id and status = 'Active';

  select count(*) into v_pending
  from task_claims
  where user_id = p_user_id and status = 'PendingReview';

  select p.joined_at into v_joined
  from profiles p
  where p.id = p_user_id;

  if v_joined is not null then
    v_age_days := greatest(0, floor(extract(epoch from (now() - v_joined)) / 86400.0)::int);
  end if;

  v_restricted := public.user_is_claim_restricted(p_user_id);

  select * into v_row from public.user_task_restrictions where user_id = p_user_id;

  return jsonb_build_object(
    'found', true,
    'user_id', p_user_id,
    'accepted_tasks', v_completed,
    'active_claims', v_active,
    'pending_review', v_pending,
    'board_load', v_active + v_pending,
    'claim_limit', public.user_claim_limit(p_user_id),
    'account_age_days', v_age_days,
    'joined_at', v_joined,
    'trust_tier', case
      when v_completed >= 5 then 'trusted'
      when v_completed >= 2 then 'established'
      else 'new'
    end,
    'trust_label', case
      when v_restricted then 'Restricted'
      when v_completed >= 5 then 'Trusted'
      when v_completed >= 2 then 'Established'
      else 'New'
    end,
    'is_restricted', v_restricted,
    'restriction_permanent', coalesce(v_row.is_permanent, false),
    'restricted_until', v_row.restricted_until,
    'fake_rejection_count', coalesce(v_row.fake_rejection_count, 0)
  );
end;
$$;


ALTER FUNCTION "public"."get_contributor_trust"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_contributor_trust"("p_user_id" "uuid") IS 'Staff/self: trust signal + current board load for a contributor.';



CREATE OR REPLACE FUNCTION "public"."get_my_ai_token_balance"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  row public.ai_token_balances;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  row := public.ensure_ai_token_balance(uid);
  return jsonb_build_object(
    'balance', row.balance,
    'lifetime_purchased', row.lifetime_purchased,
    'lifetime_spent', row.lifetime_spent,
    'lifetime_awarded', row.lifetime_awarded,
    'updated_at', row.updated_at
  );
end;
$$;


ALTER FUNCTION "public"."get_my_ai_token_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_ai_token_ledger"("p_limit" integer DEFAULT 50) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      id,
      entry_type,
      tokens_display as tokens,
      status,
      prompt_summary,
      action_key,
      pack_id,
      created_at
    from public.ai_token_ledger
    where user_id = uid
    order by created_at desc
    limit lim
  ) x;
  return result;
end;
$$;


ALTER FUNCTION "public"."get_my_ai_token_ledger"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_ai_token_purchases"("p_limit" integer DEFAULT 20) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      id,
      pack_id,
      tokens_granted,
      amount_cents,
      currency,
      status,
      label,
      completed_at,
      created_at
    from public.ai_token_purchases
    where user_id = uid
    order by created_at desc
    limit lim
  ) x;
  return result;
end;
$$;


ALTER FUNCTION "public"."get_my_ai_token_purchases"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_billing_history"("limit_n" integer DEFAULT 30) RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return '[]'::json;
  end if;

  return coalesce(
    (
      select json_agg(row_to_json(t))
      from (
        select
          d.id,
          d.created_at,
          coalesce(d.amount_cents, d.amount * 100, 0)::integer as amount_cents,
          coalesce(d.currency, 'usd') as currency,
          coalesce(d.payment_kind,
            case
              when coalesce(d.interval, 'once') = 'month'
                or d.stripe_subscription_id is not null
              then 'subscription_payment'
              else 'one_time'
            end
          ) as payment_kind,
          coalesce(d.interval, 'once') as interval,
          coalesce(d.status, 'completed') as status,
          d.tier_id,
          d.tier_label,
          d.fund_type,
          (d.stripe_subscription_id is not null) as is_subscription_charge
        from public.donations d
        where d.user_id = uid
          and coalesce(d.status, 'completed') in (
            'completed', 'paid', 'succeeded', 'refunded'
          )
        order by d.created_at desc nulls last
        limit least(greatest(coalesce(limit_n, 30), 1), 100)
      ) t
    ),
    '[]'::json
  );
end;
$$;


ALTER FUNCTION "public"."get_my_billing_history"("limit_n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_claim_quota"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_active int := 0;
  v_pending int := 0;
  v_completed int := 0;
  v_limit int := 2;
  v_submit_limit int := 2;
  v_submits_24h int := 0;
  v_last_claim timestamptz;
  v_last_submit timestamptz;
  v_claim_cooldown_ends timestamptz;
  v_submit_cooldown_ends timestamptz;
  v_restricted boolean := false;
  v_restriction public.user_task_restrictions%rowtype;
  v_identity jsonb;
  v_can_claim boolean := false;
  v_can_submit boolean := false;
  v_bypass boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('signed_in', false, 'can_claim_now', false, 'can_submit_now', false);
  end if;

  v_bypass := public.user_bypasses_task_limits(v_uid);

  select count(*) into v_active
  from task_claims
  where user_id = v_uid and status = 'Active';

  select count(*) into v_pending
  from task_claims
  where user_id = v_uid and status = 'PendingReview';

  v_completed := public.user_accepted_task_count(v_uid);
  v_limit := public.user_claim_limit(v_uid);
  v_submit_limit := public.user_submit_limit_24h(v_uid);
  v_restricted := public.user_is_claim_restricted(v_uid);
  v_identity := public.user_identity_gate_status(v_uid);

  select * into v_restriction
  from public.user_task_restrictions
  where user_id = v_uid;

  select count(*) into v_submits_24h
  from task_claims
  where user_id = v_uid
    and submitted_at is not null
    and submitted_at > now() - interval '24 hours';

  select max(claimed_at) into v_last_claim
  from task_claims
  where user_id = v_uid and claimed_at is not null;

  select max(submitted_at) into v_last_submit
  from task_claims
  where user_id = v_uid and submitted_at is not null;

  if not v_bypass then
    if v_last_claim is not null then
      v_claim_cooldown_ends := v_last_claim + interval '30 minutes';
    end if;
    if v_last_submit is not null then
      v_submit_cooldown_ends := v_last_submit + interval '45 minutes';
    end if;
  end if;

  if v_bypass then
    v_can_claim :=
      not v_restricted
      and coalesce((v_identity->>'meets_gate')::boolean, false)
      and (v_active + v_pending) < v_limit;
    v_can_submit :=
      not v_restricted
      and coalesce((v_identity->>'meets_gate')::boolean, false);
  else
    v_can_claim :=
      not v_restricted
      and coalesce((v_identity->>'meets_gate')::boolean, false)
      and (v_active + v_pending) < v_limit
      and (v_claim_cooldown_ends is null or v_claim_cooldown_ends <= now());
    v_can_submit :=
      not v_restricted
      and coalesce((v_identity->>'meets_gate')::boolean, false)
      and v_submits_24h < v_submit_limit
      and (v_submit_cooldown_ends is null or v_submit_cooldown_ends <= now());
  end if;

  return jsonb_build_object(
    'signed_in', true,
    'active_claims', v_active + v_pending,
    'active_working', v_active,
    'pending_review', v_pending,
    'completed_claims', v_completed,
    'claim_limit', v_limit,
    'submit_limit_24h', v_submit_limit,
    'submits_last_24h', v_submits_24h,
    'cooldown_ends_at', v_claim_cooldown_ends,
    'submit_cooldown_ends_at', v_submit_cooldown_ends,
    'can_claim_now', v_can_claim,
    'can_submit_now', v_can_submit,
    'is_restricted', v_restricted,
    'restriction_permanent', coalesce(v_restriction.is_permanent, false),
    'restricted_until', v_restriction.restricted_until,
    'restriction_reason', v_restriction.last_reason,
    'fake_rejection_count', coalesce(v_restriction.fake_rejection_count, 0),
    'identity', v_identity,
    'rate_limit_bypass', v_bypass,
    'trust_tier', case
      when v_bypass then 'staff'
      when v_completed >= 5 then 'trusted'
      when v_completed >= 2 then 'established'
      else 'new'
    end
  );
end;
$$;


ALTER FUNCTION "public"."get_my_claim_quota"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_forge_mark_ledger"("p_limit" integer DEFAULT 50) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      id,
      entry_type,
      marks_display as marks,
      marks as marks_delta,
      donation_id,
      award_id,
      note,
      created_at
    from public.forge_mark_ledger
    where user_id = uid
    order by created_at desc
    limit lim
  ) x;
  return result;
end;
$$;


ALTER FUNCTION "public"."get_my_forge_mark_ledger"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_forge_marks"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  row public.forge_mark_balances;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  row := public.ensure_forge_mark_balance(uid);
  return jsonb_build_object(
    'balance', row.balance,
    'lifetime_earned', row.lifetime_earned,
    'lifetime_spent', row.lifetime_spent,
    'updated_at', row.updated_at
  );
end;
$$;


ALTER FUNCTION "public"."get_my_forge_marks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_subscription_plan"() RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  r record;
begin
  if uid is null then
    return null;
  end if;

  select
    s.id,
    s.status,
    s.fund_type,
    s.amount_cents,
    s.currency,
    s.tier_id,
    s.tier_label,
    s.cancel_at_period_end,
    s.current_period_end,
    s.canceled_at,
    s.customer_id,
    s.updated_at,
    s.created_at
  into r
  from public.stripe_subscriptions s
  where s.user_id = uid
    and s.status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid')
  order by
    case
      when s.status in ('active', 'trialing') then 0
      when s.status = 'past_due' then 1
      else 2
    end,
    s.updated_at desc nulls last
  limit 1;

  if not found then
    return null;
  end if;

  return json_build_object(
    'id', r.id,
    'status', r.status,
    'fund_type', coalesce(r.fund_type, 'studio'),
    'amount_cents', coalesce(r.amount_cents, 0),
    'currency', coalesce(r.currency, 'usd'),
    'tier_id', r.tier_id,
    'tier_label', r.tier_label,
    'cancel_at_period_end', coalesce(r.cancel_at_period_end, false),
    'current_period_end', r.current_period_end,
    'canceled_at', r.canceled_at,
    'customer_id', r.customer_id,
    'updated_at', r.updated_at,
    'created_at', r.created_at
  );
end;
$$;


ALTER FUNCTION "public"."get_my_subscription_plan"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_subscription_plan"() IS 'Signed-in user current/most relevant subscription for Account → My Plan.';



CREATE OR REPLACE FUNCTION "public"."get_my_subscriptions"() RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return '[]'::json;
  end if;

  return coalesce(
    (
      select json_agg(row_to_json(t))
      from (
        select
          s.id,
          s.status,
          s.amount_cents,
          s.currency,
          s.tier_id,
          s.tier_label,
          s.cancel_at_period_end,
          s.current_period_end,
          s.canceled_at,
          s.updated_at,
          s.created_at
        from public.stripe_subscriptions s
        where s.user_id = uid
        order by s.updated_at desc nulls last
        limit 20
      ) t
    ),
    '[]'::json
  );
end;
$$;


ALTER FUNCTION "public"."get_my_subscriptions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_donation_credits"("p_project_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_total bigint := 0;
  v_anon bigint := 0;
  v_named json;
begin
  if p_project_id is null then
    return json_build_object(
      'project_total_cents', 0,
      'anonymous_cents', 0,
      'named_donors', '[]'::json
    );
  end if;

  select
    coalesce(sum(d.amount_cents) filter (
      where coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
        and coalesce(d.fund_type, 'studio') = 'studio'
    ), 0),
    coalesce(sum(d.amount_cents) filter (
      where coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
        and coalesce(d.fund_type, 'studio') = 'studio'
        and coalesce(d.is_anonymous, true) = true
    ), 0)
  into v_total, v_anon
  from donations d
  where d.project_id = p_project_id;

  select coalesce(json_agg(row_to_json(x) order by x.display_name), '[]'::json)
  into v_named
  from (
    select distinct on (coalesce(p.id::text, lower(trim(coalesce(d.display_name, '')))))
      p.id as user_id,
      p.username,
      p.avatar_url,
      coalesce(nullif(trim(p.username), ''), nullif(trim(d.display_name), ''), 'Supporter') as display_name
    from donations d
    left join profiles p on p.id = d.user_id
    where d.project_id = p_project_id
      and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
      and coalesce(d.fund_type, 'studio') = 'studio'
      and coalesce(d.is_anonymous, true) = false
      and (
        d.user_id is not null
        or nullif(trim(d.display_name), '') is not null
      )
    order by
      coalesce(p.id::text, lower(trim(coalesce(d.display_name, '')))),
      d.created_at asc
  ) x;

  return json_build_object(
    'project_total_cents', v_total,
    'anonymous_cents', v_anon,
    'named_donors', coalesce(v_named, '[]'::json)
  );
end;
$$;


ALTER FUNCTION "public"."get_project_donation_credits"("p_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_project_donation_credits"("p_project_id" "uuid") IS 'Public project donation total + named donors (no individual amounts). Only donations attributed via project_id while project was active.';



CREATE OR REPLACE FUNCTION "public"."get_public_community_stats"() RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_members integer := 0;
  v_ideas integer := 0;
  v_supporters integer := 0;
  v_tasks integer := 0;
begin
  begin
    select count(*)::integer into v_members from public.profiles;
  exception
    when undefined_table then
      v_members := 0;
  end;

  begin
    select count(*)::integer into v_ideas
    from public.ideas
    where coalesce(status, 'Proposed') is distinct from 'Draft';
  exception
    when undefined_column then
      begin
        select count(*)::integer into v_ideas from public.ideas;
      exception
        when undefined_table then
          v_ideas := 0;
      end;
    when undefined_table then
      v_ideas := 0;
  end;

  begin
    select count(*)::integer into v_supporters
    from (
      select distinct coalesce(
        nullif(user_id::text, ''),
        nullif(trim(stripe_customer_id), ''),
        'row:' || id::text
      ) as k
      from public.donations
      where coalesce(fund_type, 'studio') in ('studio', 'runway')
        and coalesce(status, 'completed') in ('completed', 'paid', 'succeeded')
        and coalesce(amount_cents, amount * 100, 0) > 0
    ) s;
  exception
    when undefined_column then
      begin
        select count(distinct coalesce(user_id::text, 'row:' || id::text))::integer
        into v_supporters
        from public.donations
        where coalesce(status, 'completed') in ('completed', 'paid', 'succeeded');
      exception
        when others then
          v_supporters := 0;
      end;
    when undefined_table then
      v_supporters := 0;
  end;

  begin
    select count(*)::integer into v_tasks
    from public.tasks
    where status = 'Completed';
  exception
    when undefined_table then
      begin
        select count(*)::integer into v_tasks
        from public.task_claims
        where status = 'Completed';
      exception
        when others then
          v_tasks := 0;
      end;
    when others then
      begin
        select count(*)::integer into v_tasks
        from public.task_claims
        where status = 'Completed';
      exception
        when others then
          v_tasks := 0;
      end;
  end;

  return json_build_object(
    'members', coalesce(v_members, 0),
    'ideas_submitted', coalesce(v_ideas, 0),
    'supporters', coalesce(v_supporters, 0),
    'tasks_completed', coalesce(v_tasks, 0)
  );
end;
$$;


ALTER FUNCTION "public"."get_public_community_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_community_stats"() IS 'Home Community Pulse: members, submitted ideas, unique supporters, completed tasks.';



CREATE OR REPLACE FUNCTION "public"."get_public_forge_marks_profile"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  bal public.forge_mark_balances;
  awards jsonb;
  totals jsonb;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'balance', 0,
      'lifetime_earned', 0,
      'lifetime_spent', 0,
      'awards', '[]'::jsonb,
      'totals_by_tier', '[]'::jsonb
    );
  end if;

  select * into bal from public.forge_mark_balances where user_id = p_user_id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into awards
  from (
    select
      a.id,
      a.award_tier,
      a.award_name,
      a.marks_spent,
      a.target_type,
      a.target_id,
      a.target_url,
      a.message,
      a.created_at,
      p.username as giver_username
    from public.forge_awards a
    left join public.profiles p on p.id = a.giver_id
    where a.receiver_id = p_user_id
    order by a.created_at desc
  ) x;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'award_tier', t.award_tier,
        'award_name', t.award_name,
        'award_count', t.award_count,
        'marks_received', t.marks_received
      )
      order by t.sort_order, t.award_name
    ),
    '[]'::jsonb
  )
  into totals
  from (
    select
      tot.award_tier,
      tot.award_name,
      tot.award_count,
      tot.marks_received,
      coalesce(tier.sort_order, 999) as sort_order
    from public.forge_award_totals tot
    left join public.forge_award_tiers tier on tier.id = tot.award_tier
    where tot.user_id = p_user_id
  ) t;

  return jsonb_build_object(
    'balance', coalesce(bal.balance, 0),
    'lifetime_earned', coalesce(bal.lifetime_earned, 0),
    'lifetime_spent', coalesce(bal.lifetime_spent, 0),
    'awards', awards,
    'totals_by_tier', totals
  );
end;
$$;


ALTER FUNCTION "public"."get_public_forge_marks_profile"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_fund_contributors"("p_fund_type" "text" DEFAULT 'studio'::"text") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with named as (
    select
      d.user_id,
      coalesce(
        nullif(trim(p.username), ''),
        nullif(trim(d.display_name), '')
      ) as display_name,
      nullif(trim(p.username), '') as username,
      p.avatar_url,
      p.pinned_badge_key,
      d.created_at,
      coalesce(
        case when d.user_id is not null then 'u:' || d.user_id::text end,
        'n:' || lower(trim(coalesce(
          nullif(trim(p.username), ''),
          nullif(trim(d.display_name), ''),
          ''
        )))
      ) as person_key
    from public.donations d
    left join public.profiles p on p.id = d.user_id
    where coalesce(d.fund_type, 'studio') =
      coalesce(nullif(trim(p_fund_type), ''), 'studio')
      and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
      and coalesce(d.amount_cents, d.amount * 100, 0) > 0
      and coalesce(d.is_anonymous, true) = false
  ),
  keyed as (
    select *
    from named
    where display_name is not null
      and person_key is not null
      and person_key <> 'n:'
  ),
  first_seen as (
    select distinct on (person_key)
      person_key,
      display_name,
      username,
      avatar_url,
      pinned_badge_key,
      created_at as first_at
    from keyed
    order by person_key, created_at asc nulls last
  )
  select coalesce(
    (
      select json_agg(row_to_json(t))
      from (
        select
          display_name,
          username,
          avatar_url,
          pinned_badge_key,
          first_at
        from first_seen
        order by lower(display_name)
      ) t
    ),
    '[]'::json
  );
$$;


ALTER FUNCTION "public"."get_public_fund_contributors"("p_fund_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_fund_contributors"("p_fund_type" "text") IS 'Unique opted-in supporters for studio or runway. No anonymous rows, no duplicates.';



CREATE OR REPLACE FUNCTION "public"."get_public_profile_support"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_show_total boolean := false;
  v_total bigint := 0;   -- always sum of non-anonymous donations
  v_count int := 0;      -- always count of non-anonymous donations
  v_projects jsonb := '[]'::jsonb;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'is_supporter', false,
      'show_total', false,
      'total_cents', null,
      'donation_count', 0,
      'projects', '[]'::jsonb
    );
  end if;

  select coalesce(p.show_donation_total, false)
  into v_show_total
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    return jsonb_build_object(
      'is_supporter', false,
      'show_total', false,
      'total_cents', null,
      'donation_count', 0,
      'projects', '[]'::jsonb
    );
  end if;

  -- COUNT: non-anonymous only. Opt-in flag is not used here.
  select
    coalesce(sum(coalesce(d.amount_cents, d.amount * 100, 0)), 0)::bigint,
    count(*)::int
  into v_total, v_count
  from public.donations d
  where d.user_id = p_user_id
    and coalesce(d.is_anonymous, true) = false
    and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
    and coalesce(d.amount_cents, d.amount * 100, 0) > 0;

  -- Project list: same non-anonymous filter only
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', x.label,
        'project_slug', x.project_slug
      )
      order by x.sort_key, x.label
    ),
    '[]'::jsonb
  )
  into v_projects
  from (
    select
      case
        when d.project_id is not null then coalesce(
          nullif(trim(max(pr.title)), ''),
          nullif(trim(max(pr.slug)), ''),
          'Project'
        )
        else 'Together Forge'
      end as label,
      max(pr.slug) as project_slug,
      case when d.project_id is null then 0 else 1 end as sort_key
    from public.donations d
    left join public.projects pr on pr.id = d.project_id
    where d.user_id = p_user_id
      and coalesce(d.is_anonymous, true) = false
      and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
      and coalesce(d.amount_cents, d.amount * 100, 0) > 0
    group by d.project_id
  ) x;

  return jsonb_build_object(
    'is_supporter', v_count > 0,
    'show_total', v_show_total,
    -- DISPLAY gate only: full non-anon total is always computed above as v_total
    'total_cents', case when v_show_total then v_total else null end,
    'donation_count', v_count,
    'projects', coalesce(v_projects, '[]'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."get_public_profile_support"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_profile_support"("p_user_id" "uuid") IS 'Non-anon donations always counted; show_donation_total only controls whether total_cents is returned for display.';



CREATE OR REPLACE FUNCTION "public"."get_public_recent_donations"("limit_n" integer DEFAULT 12, "p_fund_type" "text" DEFAULT 'studio'::"text") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (
      select json_agg(row_to_json(t))
      from (
        select
          coalesce(d.amount_cents, d.amount * 100, 0)::integer as amount_cents,
          d.created_at,
          (coalesce(d.interval, 'once') = 'month') as is_recurring,
          coalesce(d.is_anonymous, true) as is_anonymous,
          case
            when coalesce(d.is_anonymous, true) = false then p.username
            else null
          end as username,
          case
            when coalesce(d.is_anonymous, true) = false then p.avatar_url
            else null
          end as avatar_url,
          case
            when coalesce(d.is_anonymous, true) = false then
              coalesce(
                nullif(trim(p.username), ''),
                nullif(trim(d.display_name), ''),
                null
              )
            else null
          end as display_name,
          case
            when coalesce(d.is_anonymous, true) = false then p.pinned_badge_key
            else null
          end as pinned_badge_key
        from donations d
        left join profiles p on p.id = d.user_id
        where coalesce(d.fund_type, 'studio') = coalesce(nullif(trim(p_fund_type), ''), 'studio')
          and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
          and coalesce(d.amount_cents, d.amount * 100, 0) > 0
        order by d.created_at desc nulls last
        limit least(greatest(coalesce(limit_n, 12), 1), 20)
      ) t
    ),
    '[]'::json
  );
$$;


ALTER FUNCTION "public"."get_public_recent_donations"("limit_n" integer, "p_fund_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_recent_donations"("limit_n" integer, "p_fund_type" "text") IS 'Last N completed payments for studio or runway. Username/avatar only when not anonymous.';



CREATE OR REPLACE FUNCTION "public"."get_public_support_summary"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with completed as (
    select *
    from donations
    where coalesce(status, 'completed') in ('completed', 'paid', 'succeeded')
  ),
  studio as (
    select *
    from completed
    where coalesce(fund_type, 'studio') = 'studio'
  ),
  -- Latest payment amount per subscription id (proxy for active MRR)
  latest_sub as (
    select distinct on (stripe_subscription_id)
      stripe_subscription_id,
      amount_cents
    from studio
    where interval = 'month'
      and stripe_subscription_id is not null
      and coalesce(amount_cents, 0) > 0
    order by stripe_subscription_id, created_at desc
  )
  select json_build_object(
    'studio_total_cents', coalesce((select sum(amount_cents) from studio), 0),
    'studio_payment_count', coalesce((select count(*) from studio), 0),
    'studio_mrr_cents', coalesce((select sum(amount_cents) from latest_sub), 0),
    'studio_subscriber_count', coalesce((select count(*) from latest_sub), 0),
    'runway_total_cents', coalesce((
      select sum(amount_cents) from completed where fund_type = 'runway'
    ), 0),
    'runway_payment_count', coalesce((
      select count(*) from completed where fund_type = 'runway'
    ), 0),
    'last_payment_at', (select max(created_at) from studio),
    'currency', 'usd'
  );
$$;


ALTER FUNCTION "public"."get_public_support_summary"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_support_summary"() IS 'Anonymized studio totals + MRR for Support and Transparency pages.';



CREATE OR REPLACE FUNCTION "public"."get_public_user_badges"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_pinned text;
  v_badges jsonb;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'badges', '[]'::jsonb,
      'pinned_badge_key', null
    );
  end if;

  select p.pinned_badge_key into v_pinned
  from public.profiles p
  where p.id = p_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', ub.badge_key,
        'granted_at', ub.granted_at
      )
      order by ub.granted_at asc
    ),
    '[]'::jsonb
  )
  into v_badges
  from public.user_badges ub
  where ub.user_id = p_user_id;

  return jsonb_build_object(
    'badges', v_badges,
    'pinned_badge_key', v_pinned
  );
end;
$$;


ALTER FUNCTION "public"."get_public_user_badges"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_ai_token_pack_purchase"("p_user_id" "uuid", "p_pack_id" "text", "p_amount_cents" integer DEFAULT NULL::integer, "p_stripe_session_id" "text" DEFAULT NULL::"text", "p_stripe_payment_intent" "text" DEFAULT NULL::"text", "p_stripe_customer_id" "text" DEFAULT NULL::"text", "p_purchase_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tokens integer;
  v_pack text := lower(trim(coalesce(p_pack_id, '')));
  v_already integer := 0;
  v_delta integer;
  v_key text;
  v_ledger public.ai_token_ledger;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'user required');
  end if;

  v_tokens := public.canonical_ai_token_pack_tokens(v_pack, p_amount_cents);
  if v_tokens <= 0 then
    return jsonb_build_object('ok', false, 'error', 'unknown pack');
  end if;

  if p_stripe_session_id is not null and trim(p_stripe_session_id) <> '' then
    select coalesce(sum(tokens_display), 0) into v_already
    from public.ai_token_ledger
    where user_id = p_user_id
      and stripe_session_id = trim(p_stripe_session_id)
      and entry_type in ('purchase', 'adjustment')
      and status = 'success';
    v_key := 'purchase:session:' || trim(p_stripe_session_id);
  elsif p_stripe_payment_intent is not null
        and trim(p_stripe_payment_intent) <> '' then
    select coalesce(sum(tokens_display), 0) into v_already
    from public.ai_token_ledger
    where user_id = p_user_id
      and stripe_payment_intent = trim(p_stripe_payment_intent)
      and entry_type in ('purchase', 'adjustment')
      and status = 'success';
    v_key := 'purchase:pi:' || trim(p_stripe_payment_intent);
  else
    v_key := null;
  end if;

  v_delta := v_tokens - coalesce(v_already, 0);
  if v_delta <= 0 then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'tokens', v_tokens,
      'already', v_already
    );
  end if;

  v_ledger := public.credit_ai_tokens(
    p_user_id,
    v_delta,
    case when v_already > 0 then 'adjustment' else 'purchase' end,
    'success',
    case
      when v_already > 0 then
        'Token pack scale correction (+'
        || v_delta::text
        || ' tokens)'
      else
        initcap(v_pack) || ' pack purchase'
    end,
    v_pack,
    p_purchase_id,
    case when v_already > 0 then 'scale_migration' else 'stripe' end,
    coalesce(p_stripe_session_id, p_stripe_payment_intent),
    p_stripe_session_id,
    p_stripe_payment_intent,
    case
      when v_already > 0 and v_key is not null then v_key || ':topup:' || v_tokens::text
      else v_key
    end,
    jsonb_build_object(
      'pack_id', v_pack,
      'amount_cents', p_amount_cents,
      'tokens', v_tokens,
      'delta', v_delta,
      'already', v_already
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'tokens', v_tokens,
    'credited', v_delta,
    'ledger_id', v_ledger.id
  );
end;
$$;


ALTER FUNCTION "public"."grant_ai_token_pack_purchase"("p_user_id" "uuid", "p_pack_id" "text", "p_amount_cents" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent" "text", "p_stripe_customer_id" "text", "p_purchase_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_forge_marks_from_donation"("p_donation_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  d record;
  cents integer;
  marks integer;
  existing uuid;
  ledger_id uuid;
begin
  if p_donation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_donation');
  end if;

  select
    id,
    user_id,
    coalesce(amount_cents, case when amount is not null then amount * 100 end, 0) as cents,
    coalesce(status, 'completed') as status
  into d
  from public.donations
  where id = p_donation_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'donation_not_found');
  end if;

  if d.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  if lower(trim(d.status)) not in ('completed', 'paid', 'succeeded') then
    return jsonb_build_object('ok', false, 'reason', 'not_completed', 'status', d.status);
  end if;

  cents := greatest(coalesce(d.cents, 0), 0);
  marks := public.forge_marks_for_amount_cents(cents);
  if marks <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'zero_marks', 'cents', cents);
  end if;

  select id into existing
  from public.forge_mark_ledger
  where donation_id = p_donation_id
    and entry_type = 'donation_grant'
  limit 1;
  if existing is not null then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'ledger_id', existing,
      'marks', marks
    );
  end if;

  perform public.ensure_forge_mark_balance(d.user_id);

  insert into public.forge_mark_ledger (
    user_id,
    entry_type,
    marks,
    marks_display,
    donation_id,
    idempotency_key,
    note,
    meta
  ) values (
    d.user_id,
    'donation_grant',
    marks,
    marks,
    p_donation_id,
    'donation-grant:' || p_donation_id::text,
    'Completed donation',
    jsonb_build_object(
      'amount_cents', cents,
      'marks_per_dollar', case
        when cents >= 50000 then 150
        when cents >= 25000 then 140
        when cents >= 10000 then 130
        when cents >= 5000 then 120
        when cents >= 2500 then 110
        else 100
      end
    )
  )
  returning id into ledger_id;

  update public.forge_mark_balances
  set
    balance = balance + marks,
    lifetime_earned = lifetime_earned + marks,
    updated_at = now()
  where user_id = d.user_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'ledger_id', ledger_id,
    'marks', marks,
    'user_id', d.user_id
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true, 'marks', marks);
end;
$$;


ALTER FUNCTION "public"."grant_forge_marks_from_donation"("p_donation_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_game_shipper_for_project"("p_project_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_uid uuid;
  n int := 0;
  v_released boolean := false;
  v_ids uuid[] := array[]::uuid[];
  v_extra uuid[];
  v_slug text;
begin
  if p_project_id is null or to_regclass('public.projects') is null then
    return jsonb_build_object('ok', false, 'error', 'missing_project');
  end if;

  select
    public.project_is_released(p.status, p.completed_at),
    p.slug
  into v_released, v_slug
  from public.projects p
  where p.id = p_project_id;

  if not coalesce(v_released, false) then
    return jsonb_build_object('ok', true, 'skipped', 'not_released', 'users', 0);
  end if;

  if to_regclass('public.project_contributions') is not null then
    execute $q$
      select coalesce(array_agg(distinct pc.user_id), array[]::uuid[])
      from public.project_contributions pc
      where pc.project_id = $1 and pc.user_id is not null
    $q$ into v_extra using p_project_id;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.task_claims') is not null
     and to_regclass('public.tasks') is not null then
    execute $q$
      select coalesce(array_agg(distinct tc.user_id), array[]::uuid[])
      from public.task_claims tc
      join public.tasks t on t.id = tc.task_id
      where t.project_id = $1
        and tc.user_id is not null
        and tc.status = 'Completed'
    $q$ into v_extra using p_project_id;
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  if to_regclass('public.ideas') is not null then
    execute $q$
      select coalesce(array_agg(distinct i.user_id), array[]::uuid[])
      from public.ideas i
      where i.user_id is not null
        and (
          i.project_id::text = $1::text
          or lower(nullif(trim(i.project_id::text), '')) = lower(nullif(trim($2), ''))
        )
        and (
          i.status is null
          or lower(coalesce(i.status, '')) not in ('draft', 'archived', 'hidden', 'rejected')
        )
    $q$ into v_extra using p_project_id, coalesce(v_slug, '');
    v_ids := v_ids || coalesce(v_extra, array[]::uuid[]);
  end if;

  select coalesce(array_agg(distinct u), array[]::uuid[])
  into v_ids
  from unnest(v_ids) as u
  where u is not null;

  foreach v_uid in array v_ids
  loop
    insert into public.user_badges (user_id, badge_key, source)
    values (v_uid, 'status_game_shipper', 'project_release')
    on conflict (user_id, badge_key) do nothing;
    perform public.sync_user_badges(v_uid);
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'project_id', p_project_id, 'users', n);
end;
$_$;


ALTER FUNCTION "public"."grant_game_shipper_for_project"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."idea_cast_vote"("p_idea_id" bigint) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid;
  v_exists boolean;
  v_count integer;
  v_claims text;
begin
  v_claims := current_setting('request.jwt.claims', true);
  begin
    v_user := nullif(nullif(v_claims, '')::jsonb ->> 'sub', '')::uuid;
  exception
    when others then
      v_user := public.request_uid();
  end;
  if v_user is null then
    v_user := public.request_uid();
  end if;
  if v_user is null then
    raise exception 'VOTE_AUTH_FAILED'
      using errcode = 'P0001',
            detail = coalesce(v_claims, '');
  end if;

  if p_idea_id is null or p_idea_id <= 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from ideas where id = p_idea_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  begin
    perform public.assert_action_allowed(
      'idea_vote',
      200,
      interval '15 minutes',
      interval '200 milliseconds',
      'user:' || v_user::text
    );
  exception
    when others then
      if sqlerrm like 'RATE_LIMITED%' then
        raise;
      end if;
      null;
  end;

  select exists (
    select 1 from votes where idea_id = p_idea_id and user_id = v_user
  ) into v_exists;

  if v_exists then
    delete from votes where idea_id = p_idea_id and user_id = v_user;
  else
    insert into votes (idea_id, user_id) values (p_idea_id, v_user);
  end if;

  select coalesce(votes_public, votes, 0)
  into v_count
  from ideas
  where id = p_idea_id;

  return json_build_object(
    'voted', not v_exists,
    'votes', coalesce(v_count, 0)
  );
end;
$$;


ALTER FUNCTION "public"."idea_cast_vote"("p_idea_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."idea_tag_is_publicly_selectable"("p_status" "text", "p_usage" integer) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select
    p_status is distinct from 'hidden'
    and (
      p_status in ('curated', 'approved')
      or (p_status = 'suggested' and coalesce(p_usage, 0) >= 9)
    );
$$;


ALTER FUNCTION "public"."idea_tag_is_publicly_selectable"("p_status" "text", "p_usage" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ideas_enforce_parent_one_level"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  parent_parent bigint;
  child_count integer;
begin
  if new.parent_idea_id is null then
    return new;
  end if;

  -- No self-link
  if new.id is not null and new.parent_idea_id = new.id then
    raise exception 'IDEA_PARENT_SELF: An idea cannot be related to itself.';
  end if;

  -- Parent must exist and be a root (no parent of its own)
  select p.parent_idea_id
    into parent_parent
  from public.ideas p
  where p.id = new.parent_idea_id;

  if not found then
    raise exception 'IDEA_PARENT_MISSING: Parent idea does not exist.';
  end if;

  if parent_parent is not null then
    raise exception 'IDEA_PARENT_NOT_ROOT: Parent idea already builds on another idea. Only one level of related ideas is allowed for now.';
  end if;

  -- If this row already has children, it cannot become a child
  if new.id is not null then
    select count(*)::integer into child_count
    from public.ideas c
    where c.parent_idea_id = new.id;

    if coalesce(child_count, 0) > 0 then
      raise exception 'IDEA_PARENT_HAS_CHILDREN: This idea already has related ideas building on it, so it cannot link to a parent (one level only).';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ideas_enforce_parent_one_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_founder"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') = 'founder'
  );
$$;


ALTER FUNCTION "public"."is_founder"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_founder"() IS 'True when the signed-in profile.role is founder.';



CREATE OR REPLACE FUNCTION "public"."is_idea_tag_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, 'user')) = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_idea_tag_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_idea_tag_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, 'user')) in ('admin', 'moderator', 'project_lead')
  );
$$;


ALTER FUNCTION "public"."is_idea_tag_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_project_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and coalesce(role, 'user') in (
        'admin', 'moderator', 'project_lead', 'founder'
      )
  );
$$;


ALTER FUNCTION "public"."is_project_staff"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_project_staff"() IS 'True for admin, moderator, project_lead, or founder.';



CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') in (
        'moderator', 'admin', 'project_lead', 'founder'
      )
  );
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_staff"() IS 'True for moderator, admin, project_lead, or founder.';



CREATE OR REPLACE FUNCTION "public"."list_forge_awards_for_targets"("p_target_type" "text", "p_target_ids" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  ttype text := lower(trim(coalesce(p_target_type, '')));
  result jsonb;
begin
  if ttype not in ('showcase', 'idea') then
    return '[]'::jsonb;
  end if;
  if p_target_ids is null or cardinality(p_target_ids) = 0 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc), '[]'::jsonb)
  into result
  from (
    select
      a.id,
      a.giver_id,
      a.receiver_id,
      a.award_tier,
      a.award_name,
      a.marks_spent,
      a.target_type,
      a.target_id,
      a.target_url,
      a.message,
      a.created_at,
      p.username as giver_username,
      p.avatar_url as giver_avatar_url,
      p.pinned_badge_key as giver_pinned_badge_key
    from public.forge_awards a
    left join public.profiles p on p.id = a.giver_id
    where a.target_type = ttype
      and a.target_id = any (p_target_ids)
    order by a.created_at asc
    limit 500
  ) x;

  return result;
end;
$$;


ALTER FUNCTION "public"."list_forge_awards_for_targets"("p_target_type" "text", "p_target_ids" "text"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ideas" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "description" "text",
    "category" "text",
    "votes" integer DEFAULT 0,
    "last_vote_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "problem_statement" "text",
    "tags" "text",
    "twitch_integration" "text",
    "inspiration" "text",
    "multiplayer_type" "text",
    "visual_style" "text",
    "game_setting" "text",
    "environmental_storytelling" "text",
    "ai_enemies" boolean DEFAULT false,
    "adaptive_ai" boolean DEFAULT false,
    "progression_system" "text",
    "economy_description" "text",
    "story_overview" "text",
    "endgame_potential" "text",
    "additional_notes" "text",
    "project_id" "text",
    "status" "text" DEFAULT 'Proposed'::"text",
    "guided_data" "jsonb" DEFAULT '{}'::"jsonb",
    "features" "jsonb",
    "parent_idea_id" bigint,
    "image_url" "text",
    "votes_public" integer,
    "votes_public_at" timestamp with time zone,
    "public_id" "uuid" DEFAULT "gen_random_uuid"()
);


ALTER TABLE "public"."ideas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ideas"."status" IS 'Workflow: Draft | Proposed | UnderReview | Adopted | Archived';



COMMENT ON COLUMN "public"."ideas"."guided_data" IS 'JSON from Guided Idea Creation / wizard (optional structured fields incl. art_style, platforms, scope, etc.)';



COMMENT ON COLUMN "public"."ideas"."parent_idea_id" IS 'Optional parent idea (related / builds-on). Adjacency list; v1 enforces one level deep.';



COMMENT ON COLUMN "public"."ideas"."image_url" IS 'Optional public URL for one supporting image (concept art, mockup, mood reference).';



CREATE OR REPLACE FUNCTION "public"."list_idea_children"("p_parent_id" bigint) RETURNS SETOF "public"."ideas"
    LANGUAGE "sql" STABLE
    AS $$
  select *
  from public.ideas
  where parent_idea_id = p_parent_id
  order by created_at desc;
$$;


ALTER FUNCTION "public"."list_idea_children"("p_parent_id" bigint) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_restriction_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "event_type" "text" NOT NULL,
    "reason" "text",
    "task_id" "uuid",
    "claim_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_restriction_events_type_check" CHECK (("event_type" = ANY (ARRAY['fake_reject'::"text", 'restrict'::"text", 'auto_restrict'::"text", 'lift'::"text", 'warn'::"text"])))
);


ALTER TABLE "public"."task_restriction_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_restriction_events" IS 'Audit trail for claim restriction / fake-work events.';



CREATE OR REPLACE FUNCTION "public"."list_recent_restriction_events"("p_limit" integer DEFAULT 50) RETURNS SETOF "public"."task_restriction_events"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_project_staff() then
    raise exception 'Only staff can list restriction events';
  end if;
  return query
  select *
  from public.task_restriction_events
  order by created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;


ALTER FUNCTION "public"."list_recent_restriction_events"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_idea_tag_name"("raw" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  s text;
begin
  s := trim(both from coalesce(raw, ''));
  s := regexp_replace(s, '^#+', '');
  s := regexp_replace(s, '\s+', ' ', 'g');
  if length(s) < 1 then
    return null;
  end if;
  if length(s) > 40 then
    s := left(s, 40);
  end if;
  return s;
end;
$$;


ALTER FUNCTION "public"."normalize_idea_tag_name"("raw" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_idea_tag_slug"("raw" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  s text;
begin
  s := lower(trim(coalesce(raw, '')));
  s := regexp_replace(s, '^#+', '');
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := trim(both '-' from s);
  if length(s) < 1 then
    return null;
  end if;
  if length(s) > 48 then
    s := left(s, 48);
    s := trim(both '-' from s);
  end if;
  return s;
end;
$$;


ALTER FUNCTION "public"."normalize_idea_tag_slug"("raw" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_idea_title"("p_title" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select lower(regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g'));
$$;


ALTER FUNCTION "public"."normalize_idea_title"("p_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."place_forge_award"("p_tier_id" "text", "p_target_type" "text", "p_target_id" "text", "p_message" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  giver uuid := auth.uid();
  tier public.forge_award_tiers;
  receiver uuid;
  target_url text;
  msg text;
  ttype text;
  tid text;
  idea_status text;
  award_row public.forge_awards;
  bal integer;
begin
  if giver is null then
    raise exception 'Sign in to place a Community Award';
  end if;

  ttype := lower(trim(coalesce(p_target_type, '')));
  tid := nullif(trim(coalesce(p_target_id, '')), '');
  if ttype not in ('showcase', 'idea') then
    raise exception 'Awards can only be placed on Showcase posts or ideas';
  end if;
  if tid is null then
    raise exception 'Post is required';
  end if;

  select * into tier
  from public.forge_award_tiers
  where id = lower(trim(coalesce(p_tier_id, '')));
  if not found then
    raise exception 'Unknown award';
  end if;

  msg := nullif(trim(coalesce(p_message, '')), '');
  if msg is not null and not coalesce(tier.allows_message, false) then
    raise exception 'This award does not include a message';
  end if;
  if msg is not null and char_length(msg) > 140 then
    raise exception 'Message must be 140 characters or fewer';
  end if;

  if ttype = 'showcase' then
    if to_regclass('public.community_showcase_posts') is null then
      raise exception 'Showcase is not available';
    end if;
    select creator_user_id
      into receiver
    from public.community_showcase_posts
    where id::text = tid
      and status = 'approved'
    limit 1;
    if receiver is null then
      raise exception 'This Showcase post cannot receive awards';
    end if;
    target_url := '/showcase#showcase-' || tid;
  else
    if to_regclass('public.ideas') is null then
      raise exception 'Ideas are not available';
    end if;
    select user_id, status
      into receiver, idea_status
    from public.ideas
    where id::text = tid
    limit 1;
    if receiver is null then
      raise exception 'This idea cannot receive awards';
    end if;
    if lower(trim(coalesce(idea_status, ''))) = 'draft' then
      raise exception 'Draft ideas cannot receive awards';
    end if;
    target_url := '/ideas/' || tid;
  end if;

  if giver = receiver then
    raise exception 'You cannot award your own post';
  end if;

  if not exists (select 1 from public.profiles p where p.id = giver) then
    raise exception 'Set a username on your profile before placing awards';
  end if;
  if not exists (select 1 from public.profiles p where p.id = receiver) then
    raise exception 'This post has no public profile to credit';
  end if;

  if exists (
    select 1
    from public.forge_awards
    where giver_id = giver
      and award_tier = tier.id
      and target_type = ttype
      and target_id = tid
  ) then
    raise exception 'You already placed a % on this post', tier.name;
  end if;

  perform public.ensure_forge_mark_balance(giver);

  select balance into bal
  from public.forge_mark_balances
  where user_id = giver
  for update;

  if coalesce(bal, 0) < tier.marks_cost then
    raise exception 'Not enough Forge Marks';
  end if;

  insert into public.forge_awards (
    giver_id,
    receiver_id,
    award_tier,
    award_name,
    marks_spent,
    target_type,
    target_id,
    target_url,
    message
  ) values (
    giver,
    receiver,
    tier.id,
    tier.name,
    tier.marks_cost,
    ttype,
    tid,
    target_url,
    msg
  )
  returning * into award_row;

  insert into public.forge_mark_ledger (
    user_id,
    entry_type,
    marks,
    marks_display,
    award_id,
    idempotency_key,
    note
  ) values (
    giver,
    'award_spend',
    -tier.marks_cost,
    tier.marks_cost,
    award_row.id,
    'award-spend:' || award_row.id::text,
    'Community Award: ' || tier.name
  );

  update public.forge_mark_balances
  set
    balance = balance - tier.marks_cost,
    lifetime_spent = lifetime_spent + tier.marks_cost,
    updated_at = now()
  where user_id = giver
    and balance >= tier.marks_cost;

  if not found then
    raise exception 'Not enough Forge Marks';
  end if;

  insert into public.forge_award_totals (
    user_id, award_tier, award_name, award_count, marks_received, updated_at
  ) values (
    receiver, tier.id, tier.name, 1, tier.marks_cost, now()
  )
  on conflict (user_id, award_tier) do update
  set
    award_name = excluded.award_name,
    award_count = public.forge_award_totals.award_count + 1,
    marks_received = public.forge_award_totals.marks_received
      + excluded.marks_received,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'award_id', award_row.id,
    'marks_spent', tier.marks_cost,
    'tier', tier.id,
    'tier_name', tier.name,
    'receiver_id', receiver,
    'target_type', ttype,
    'target_id', tid,
    'target_url', target_url,
    'message', msg,
    'created_at', award_row.created_at
  );
end;
$$;


ALTER FUNCTION "public"."place_forge_award"("p_tier_id" "text", "p_target_type" "text", "p_target_id" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_direct_role_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if auth.uid() is not null
       and current_setting('app.allow_role_change', true) is distinct from 'on'
    then
      raise exception 'Role can only be changed by a Founder via Role Management'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_direct_role_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."project_is_released"("p_status" "text", "p_completed_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select
    p_completed_at is not null
    or lower(trim(coalesce(p_status, ''))) in (
      'completed',
      'released',
      'shipped',
      'live',
      'done',
      'launched'
    );
$$;


ALTER FUNCTION "public"."project_is_released"("p_status" "text", "p_completed_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_count_display"("p_true" integer, "p_salt" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when coalesce(p_true, 0) < 10 then greatest(0, coalesce(p_true, 0))
    else greatest(
      0,
      (round(coalesce(p_true, 0) / 5.0) * 5)::integer
        + (('x' || substr(md5(coalesce(p_salt, 'x')), 1, 4))::bit(16)::int % 5)
        - 2
    )
  end;
$$;


ALTER FUNCTION "public"."public_count_display"("p_true" integer, "p_salt" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_idea_tag_usage"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  parts text[];
  part text;
  v_slug text;
  v_name text;
  touched integer := 0;
begin
  -- Zero all first
  update public.idea_tags set usage_count = 0;

  for r in
    select tags from public.ideas
    where tags is not null and length(trim(tags)) > 0
  loop
    parts := regexp_split_to_array(r.tags, '[,;#|]+');
    foreach part in array parts
    loop
      v_name := public.normalize_idea_tag_name(part);
      v_slug := public.normalize_idea_tag_slug(v_name);
      if v_slug is null then
        continue;
      end if;

      update public.idea_tags t
      set usage_count = t.usage_count + 1
      where t.slug = v_slug;

      if not found then
        -- Create catalog row for existing free-text tags (suggested)
        insert into public.idea_tags (slug, name, status, usage_count)
        values (v_slug, v_name, 'suggested', 1)
        on conflict (slug) do update
          set usage_count = public.idea_tags.usage_count + 1;
      end if;

      touched := touched + 1;
    end loop;
  end loop;

  -- Auto-promote suggested tags that crossed the threshold (optional; selectable
  -- already works via usage_count >= 9 without changing status)
  return touched;
end;
$$;


ALTER FUNCTION "public"."recompute_idea_tag_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_community_showcase_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_post uuid;
  new_count integer;
  due boolean;
begin
  target_post := coalesce(new.post_id, old.post_id);
  if target_post is null then
    return null;
  end if;

  select count(*)::integer into new_count
  from community_showcase_likes
  where post_id = target_post;

  select
    new_count < 10
    or likes_public_at is null
    or now() - likes_public_at > interval '12 minutes'
    or coalesce(likes_public, 0) < 10
  into due
  from community_showcase_posts
  where id = target_post;

  update community_showcase_posts
  set
    likes = coalesce(new_count, 0),
    likes_public = case
      when new_count < 10 then new_count
      when due then public.public_count_display(new_count, id::text)
      else coalesce(likes_public, public.public_count_display(new_count, id::text))
    end,
    likes_public_at = case
      when new_count < 10 or due then now()
      else coalesce(likes_public_at, now())
    end
  where id = target_post;

  return null;
exception
  when undefined_column then
    update community_showcase_posts
    set likes = coalesce(new_count, 0)
    where id = target_post;
    return null;
end;
$$;


ALTER FUNCTION "public"."refresh_community_showcase_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_founders_thought_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_id bigint;
  new_count integer;
begin
  target_id := coalesce(new.thought_id, old.thought_id);
  select count(*)::integer into new_count
  from founders_thought_likes
  where thought_id = target_id;

  update founders_thoughts
  set likes = new_count,
      updated_at = now()
  where id = target_id;

  return null;
end;
$$;


ALTER FUNCTION "public"."refresh_founders_thought_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_idea_vote_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_idea bigint;
  new_count integer;
  due boolean;
begin
  target_idea := coalesce(new.idea_id, old.idea_id);
  select count(*)::integer into new_count from votes where idea_id = target_idea;
  select
    new_count < 10
    or votes_public_at is null
    or now() - votes_public_at > interval '12 minutes'
    or coalesce(votes_public, 0) < 10
  into due
  from ideas
  where id = target_idea;

  perform set_config('app.idea_vote_count_update', '1', true);

  update ideas
  set
    votes = new_count,
    last_vote_time = case
      when new_count > 0 then now()
      else last_vote_time
    end,
    votes_public = case
      when new_count < 10 then new_count
      when due then public.public_count_display(new_count, id::text)
      else coalesce(votes_public, public.public_count_display(new_count, id::text))
    end,
    votes_public_at = case
      when new_count < 10 or due then now()
      else coalesce(votes_public_at, now())
    end
  where id = target_idea;
  return coalesce(new, old);
exception
  when undefined_column then
    perform set_config('app.idea_vote_count_update', '1', true);
    update ideas set votes = new_count where id = target_idea;
    return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."refresh_idea_vote_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_task_as_fake_work"("p_task_id" "uuid", "p_feedback" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_feedback text := nullif(trim(coalesce(p_feedback, '')), '');
  v_restrict jsonb;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_project_staff() then
    raise exception 'Only a Project Lead or moderator can reject fake work';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'PendingReview'
  for update;

  if not found then
    raise exception 'No submission waiting for review on this task';
  end if;

  v_feedback := coalesce(
    v_feedback,
    'This submission was flagged as fake / no real work. Your claim was released and claim privileges may be restricted.'
  );

  -- Free the board: return claim fully so others can take the task
  update task_claims set
    status = 'Returned',
    review_feedback = v_feedback,
    reviewed_at = now(),
    reviewed_by = v_uid,
    submitted_at = null,
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  update tasks set
    status = 'ToDo',
    completed_at = null
  where id = p_task_id
  returning * into v_task;

  v_restrict := public.apply_claim_restriction(
    v_claim.user_id,
    v_uid,
    v_feedback,
    p_task_id,
    v_claim.id,
    true
  );

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'rejected fake work on',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'claim_id', v_claim.id,
      'claimant_id', v_claim.user_id,
      'feedback', v_feedback,
      'restriction', v_restrict
    )
  );

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'claim', to_jsonb(v_claim),
    'restriction', v_restrict,
    'accepted', false,
    'fake_work', true
  );
end;
$$;


ALTER FUNCTION "public"."reject_task_as_fake_work"("p_task_id" "uuid", "p_feedback" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reject_task_as_fake_work"("p_task_id" "uuid", "p_feedback" "text") IS 'Staff: reject pending submission as fake work, release claim, escalate restrictions.';



CREATE OR REPLACE FUNCTION "public"."request_join_claim"("p_task_id" "uuid", "p_message" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_claim task_claims%rowtype;
  v_req claim_join_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in to request joining a claim';
  end if;

  select * into v_claim
  from task_claims
  where task_id = p_task_id and status = 'Active'
  limit 1;

  if not found then
    raise exception 'No active claim on this task';
  end if;

  if v_claim.user_id = v_uid then
    raise exception 'You already own this claim';
  end if;

  -- One pending request per claim
  select * into v_req
  from claim_join_requests
  where claim_id = v_claim.id and requester_id = v_uid and status = 'pending'
  limit 1;

  if found then
    raise exception 'You already have a pending join request on this task';
  end if;

  -- Already approved helper
  if exists (
    select 1 from claim_join_requests
    where claim_id = v_claim.id
      and requester_id = v_uid
      and status = 'approved'
  ) then
    raise exception 'You are already helping on this task';
  end if;

  if exists (
    select 1 from profiles p
    where p.id = v_uid
      and p.username is not null
      and v_claim.helpers is not null
      and (
        v_claim.helpers @> to_jsonb(p.username)
        or v_claim.helpers @> jsonb_build_array(jsonb_build_object('username', p.username))
      )
  ) then
    raise exception 'You are already helping on this task';
  end if;

  insert into claim_join_requests (claim_id, task_id, requester_id, message, status)
  values (v_claim.id, p_task_id, v_uid, nullif(trim(coalesce(p_message, '')), ''), 'pending')
  returning * into v_req;

  return jsonb_build_object('request', to_jsonb(v_req), 'already_pending', false);
end;
$$;


ALTER FUNCTION "public"."request_join_claim"("p_task_id" "uuid", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_task_scope_help"("p_task_id" "uuid", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_claim public.task_claims%rowtype;
  v_task public.tasks%rowtype;
  v_note text := trim(coalesce(p_note, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to request scope help';
  end if;
  if char_length(v_note) < 10 then
    raise exception 'Add a short note (at least 10 characters) about what is larger than expected';
  end if;
  if char_length(v_note) > 2000 then
    raise exception 'Note is too long (max 2000 characters)';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim
  from public.task_claims
  where task_id = p_task_id
    and user_id = v_uid
    and status = 'Active'
  order by claimed_at desc
  limit 1
  for update;

  if not found then
    raise exception 'You need an active claim on this task to request a breakdown';
  end if;

  if exists (
    select 1 from public.task_scope_requests
    where claim_id = v_claim.id and status = 'pending'
  ) then
    raise exception 'You already have an open scope request on this claim';
  end if;

  insert into public.task_scope_requests (
    project_id, task_id, claim_id, requester_id, note, status
  ) values (
    v_task.project_id, p_task_id, v_claim.id, v_uid, v_note, 'pending'
  )
  returning id into v_id;

  -- Touch claim activity so anti-hoarding does not treat as idle
  update public.task_claims
  set last_activity_at = now()
  where id = v_claim.id;

  insert into public.activity_log (
    project_id, user_id, action, target_type, target_id, target_title, metadata
  ) values (
    v_task.project_id,
    v_uid,
    'scope_help',
    'task',
    p_task_id,
    v_task.title,
    jsonb_build_object(
      'request_id', v_id,
      'note', left(v_note, 280),
      'message', 'Flagged work as larger than expected (scope help)'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', v_id,
    'status', 'pending'
  );
end;
$$;


ALTER FUNCTION "public"."request_task_scope_help"("p_task_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_uid"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  c text;
  v uuid;
begin
  c := current_setting('request.jwt.claims', true);
  if c is not null and c <> '' then
    begin
      v := nullif(c::jsonb ->> 'sub', '')::uuid;
    exception
      when others then
        v := null;
    end;
  end if;
  if v is not null then
    return v;
  end if;
  return auth.uid();
end;
$$;


ALTER FUNCTION "public"."request_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_join_request"("p_request_id" "uuid", "p_approve" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_req claim_join_requests%rowtype;
  v_claim task_claims%rowtype;
  v_helpers jsonb;
  v_profile profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_req from claim_join_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Request is already %', v_req.status;
  end if;

  select * into v_claim from task_claims where id = v_req.claim_id for update;
  if not found or v_claim.status <> 'Active' then
    raise exception 'Claim is no longer active';
  end if;

  -- Strict owner check (IS DISTINCT FROM avoids NULL bypass)
  if v_claim.user_id is distinct from v_uid
     and not coalesce(public.is_project_staff(), false) then
    raise exception 'Only the claim owner or staff can resolve this request';
  end if;

  update claim_join_requests set
    status = case when p_approve then 'approved' else 'rejected' end,
    resolved_at = now(),
    resolved_by = v_uid
  where id = p_request_id
  returning * into v_req;

  if p_approve then
    select * into v_profile from profiles where id = v_req.requester_id;
    v_helpers := case
      when v_claim.helpers is null then '[]'::jsonb
      when jsonb_typeof(v_claim.helpers) = 'array' then v_claim.helpers
      else '[]'::jsonb
    end;

    if v_profile.username is not null
       and not exists (
         select 1
         from jsonb_array_elements(v_helpers) elem
         where elem #>> '{}' = v_profile.username
            or elem->>'username' = v_profile.username
       )
    then
      v_helpers := v_helpers || jsonb_build_array(
        jsonb_build_object(
          'username', v_profile.username,
          'user_id', v_req.requester_id
        )
      );
    end if;

    update task_claims
    set helpers = v_helpers,
        last_activity_at = now()
    where id = v_claim.id
    returning * into v_claim;
  end if;

  return jsonb_build_object('request', to_jsonb(v_req), 'claim', to_jsonb(v_claim));
end;
$$;


ALTER FUNCTION "public"."resolve_join_request"("p_request_id" "uuid", "p_approve" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_task_scope_request"("p_request_id" "uuid", "p_resolution" "text", "p_staff_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_req public.task_scope_requests%rowtype;
  v_task public.tasks%rowtype;
  v_resolution text := lower(trim(coalesce(p_resolution, '')));
  v_staff_note text := nullif(trim(coalesce(p_staff_note, '')), '');
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  if not public.is_project_staff() then
    raise exception 'Only Project Leads and moderators can resolve scope requests';
  end if;
  if v_resolution not in ('breakdown', 'promoted', 'adjusted', 'kept', 'other') then
    raise exception 'Pick a resolution: breakdown, promoted, adjusted, kept, or other';
  end if;

  select * into v_req
  from public.task_scope_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Scope request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This scope request is already closed';
  end if;

  select * into v_task from public.tasks where id = v_req.task_id;

  update public.task_scope_requests set
    status = 'resolved',
    resolution = v_resolution,
    staff_note = v_staff_note,
    resolved_at = now(),
    resolved_by = v_uid
  where id = p_request_id;

  insert into public.activity_log (
    project_id, user_id, action, target_type, target_id, target_title, metadata
  ) values (
    v_req.project_id,
    v_uid,
    'scope_help_resolved',
    'task',
    v_req.task_id,
    coalesce(v_task.title, 'a task'),
    jsonb_build_object(
      'request_id', p_request_id,
      'resolution', v_resolution,
      'staff_note', left(coalesce(v_staff_note, ''), 280),
      'requester_id', v_req.requester_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'resolution', v_resolution
  );
end;
$$;


ALTER FUNCTION "public"."resolve_task_scope_request"("p_request_id" "uuid", "p_resolution" "text", "p_staff_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."return_stale_claims"("p_days" integer DEFAULT 14) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_result jsonb;
begin
  v_result := public.run_claim_auto_release(
    greatest(coalesce(p_days, 14), 1),
    30
  );
  return coalesce((v_result ->> 'released_count')::integer, 0);
end;
$$;


ALTER FUNCTION "public"."return_stale_claims"("p_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."return_stale_claims"("p_days" integer) IS 'Back-compat wrapper: idle days param + 30-day hard max. Prefer run_claim_auto_release.';



CREATE OR REPLACE FUNCTION "public"."return_task_claim"("p_task_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status in ('Active', 'PendingReview')
  for update;

  if not found then
    raise exception 'No open claim to return';
  end if;

  if v_claim.user_id <> v_uid and not v_is_staff then
    raise exception 'Only the claimant or project staff can return this claim';
  end if;

  update task_claims set
    status = 'Returned',
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  update tasks set
    status = 'ToDo',
    completed_at = null
  where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'returned',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object('claim_id', v_claim.id)
  );

  return jsonb_build_object('task', to_jsonb(v_task), 'claim', to_jsonb(v_claim));
end;
$$;


ALTER FUNCTION "public"."return_task_claim"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_task_submission"("p_task_id" "uuid", "p_accept" boolean, "p_feedback" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
  v_feedback text := nullif(trim(coalesce(p_feedback, '')), '');
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not v_is_staff then
    raise exception 'Only a Project Lead or moderator can review submissions';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'PendingReview'
  for update;

  if not found then
    raise exception 'No submission waiting for review on this task';
  end if;

  if p_accept then
    update task_claims set
      status = 'Completed',
      progress_percent = 100,
      reviewed_at = now(),
      reviewed_by = v_uid,
      review_feedback = v_feedback,
      last_activity_at = now()
    where id = v_claim.id
    returning * into v_claim;

    update tasks set
      status = 'Completed',
      completed_at = now(),
      subtasks = (
        select coalesce(jsonb_agg(
          case
            when jsonb_typeof(elem) = 'object'
              then elem || jsonb_build_object('done', true)
            else elem
          end
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(v_task.subtasks, '[]'::jsonb)) elem
      )
    where id = p_task_id
    returning * into v_task;

    insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
    values (
      v_task.project_id,
      v_uid,
      'accepted',
      'task',
      v_task.id,
      v_task.title,
      jsonb_build_object(
        'claim_id', v_claim.id,
        'claimant_id', v_claim.user_id,
        'feedback', v_feedback
      )
    );

    -- Credit shoutout path uses "completed" activity for the claimant
    insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
    values (
      v_task.project_id,
      v_claim.user_id,
      'completed',
      'task',
      v_task.id,
      v_task.title,
      jsonb_build_object(
        'claim_id', v_claim.id,
        'accepted_by', v_uid,
        'review_accepted', true
      )
    );
  else
    -- Reject: return to Active for the same claimant so they can revise
    update task_claims set
      status = 'Active',
      review_feedback = coalesce(v_feedback, 'Please revise and resubmit with clearer evidence.'),
      reviewed_at = now(),
      reviewed_by = v_uid,
      submitted_at = null,
      last_activity_at = now()
    where id = v_claim.id
    returning * into v_claim;

    update tasks set
      status = 'InProgress',
      completed_at = null
    where id = p_task_id
    returning * into v_task;

    insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
    values (
      v_task.project_id,
      v_uid,
      'rejected submission on',
      'task',
      v_task.id,
      v_task.title,
      jsonb_build_object(
        'claim_id', v_claim.id,
        'claimant_id', v_claim.user_id,
        'feedback', v_claim.review_feedback
      )
    );
  end if;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'claim', to_jsonb(v_claim),
    'accepted', p_accept
  );
end;
$$;


ALTER FUNCTION "public"."review_task_submission"("p_task_id" "uuid", "p_accept" boolean, "p_feedback" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."review_task_submission"("p_task_id" "uuid", "p_accept" boolean, "p_feedback" "text") IS 'Staff accept (Completed + credit) or reject (back to Active with feedback).';



CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_claim_auto_release"("p_idle_days" integer DEFAULT 14, "p_max_claim_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_task tasks%rowtype;
  -- 0 = treat every Active claim as idle-overdue (staff test helper)
  v_idle int := greatest(coalesce(p_idle_days, 14), 0);
  v_max int := greatest(coalesce(p_max_claim_days, 30), 1);
  v_reason text;
  v_released jsonb := '[]'::jsonb;
  v_count int := 0;
  -- idle 0 → cutoff = now() so any real last_activity in the past counts as idle
  v_idle_cutoff timestamptz := case
    when v_idle = 0 then now()
    else now() - make_interval(days => v_idle)
  end;
  v_max_cutoff timestamptz := now() - make_interval(days => v_max);
  v_idle_label int := case when v_idle = 0 then 14 else v_idle end;
begin
  for r in
    select c.*
    from task_claims c
    where c.status = 'Active'
      and (
        -- Hard maximum claim duration (from claimed_at)
        coalesce(c.claimed_at, c.last_activity_at, now()) < v_max_cutoff
        -- Idle: no meaningful progress for idle window
        or coalesce(c.last_activity_at, c.claimed_at, now()) < v_idle_cutoff
      )
    order by c.claimed_at asc nulls first
  loop
    -- Prefer hard-max reason when both apply (skip max when idle is force-test 0
    -- unless the claim truly exceeded max days)
    if coalesce(r.claimed_at, r.last_activity_at, now()) < v_max_cutoff then
      v_reason := 'max_duration';
    else
      v_reason := 'idle';
    end if;

    update task_claims
    set
      status = 'Returned',
      notes = trim(both from coalesce(notes, '') || E'\n' || case
        when v_reason = 'max_duration' then
          '[auto-released: hard maximum of ' || v_max || ' days reached]'
        else
          '[auto-released: no meaningful progress for ' || v_idle_label || ' days]'
      end)
    where id = r.id
      and status = 'Active';

    if not found then
      continue;
    end if;

    select * into v_task from tasks where id = r.task_id;

    if found and v_task.status in ('InProgress', 'ToDo') then
      if not exists (
        select 1
        from task_claims
        where task_id = r.task_id
          and status in ('Active', 'PendingReview')
          and id <> r.id
      ) then
        update tasks
        set status = 'ToDo'
        where id = r.task_id
          and status is distinct from 'Completed'
          and status is distinct from 'InReview';
      end if;
    end if;

    if found then
      insert into activity_log (
        project_id, user_id, action, target_type, target_id, target_title, metadata
      )
      values (
        v_task.project_id,
        r.user_id,
        'auto_released',
        'task',
        r.task_id,
        v_task.title,
        jsonb_build_object(
          'claim_id', r.id,
          'reason', v_reason,
          'idle_days', v_idle_label,
          'max_claim_days', v_max,
          'claimed_at', r.claimed_at,
          'last_activity_at', r.last_activity_at,
          'test_force_idle', (v_idle = 0)
        )
      );
    end if;

    v_released := v_released || jsonb_build_array(
      jsonb_build_object(
        'claim_id', r.id,
        'task_id', r.task_id,
        'user_id', r.user_id,
        'task_title', coalesce(v_task.title, 'Task'),
        'project_id', v_task.project_id,
        'reason', v_reason,
        'idle_days', v_idle_label,
        'max_claim_days', v_max,
        'test_force_idle', (v_idle = 0)
      )
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'released_count', v_count,
    'idle_days', v_idle_label,
    'max_claim_days', v_max,
    'test_force_idle', (v_idle = 0),
    'released', v_released
  );
end;
$$;


ALTER FUNCTION "public"."run_claim_auto_release"("p_idle_days" integer, "p_max_claim_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."run_claim_auto_release"("p_idle_days" integer, "p_max_claim_days" integer) IS 'Auto-release Active claims: idle (no last_activity_at progress) or hard max from claimed_at.';



CREATE OR REPLACE FUNCTION "public"."run_claim_auto_release_test"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_project_staff() then
    raise exception 'Only project leads and admins can run the auto-release test';
  end if;

  -- idle_days = 0 → simulate “14 days idle” for every Active claim
  v_result := public.run_claim_auto_release(0, 30);

  return v_result || jsonb_build_object(
    'mode', 'test_idle_14d',
    'message', 'Test run: Active claims were evaluated as if idle for 14 days.'
  );
end;
$$;


ALTER FUNCTION "public"."run_claim_auto_release_test"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_idea_tags_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_idea_tags_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_my_pinned_badge"("p_badge_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_key text := nullif(trim(p_badge_key), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if v_key is null then
    update public.profiles
    set pinned_badge_key = null
    where id = v_uid;
    return jsonb_build_object('ok', true, 'pinned_badge_key', null);
  end if;

  if not exists (
    select 1 from public.user_badges ub
    where ub.user_id = v_uid and ub.badge_key = v_key
  ) then
    return jsonb_build_object('ok', false, 'error', 'badge_not_owned');
  end if;

  update public.profiles
  set pinned_badge_key = v_key
  where id = v_uid;

  return jsonb_build_object('ok', true, 'pinned_badge_key', v_key);
end;
$$;


ALTER FUNCTION "public"."set_my_pinned_badge"("p_badge_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_dependencies"("p_task_id" "uuid", "p_blocker_ids" "uuid"[] DEFAULT '{}'::"uuid"[], "p_override" boolean DEFAULT NULL::boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_ids uuid[] := coalesce(p_blocker_ids, '{}');
  v_id uuid;
  v_inserted int := 0;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  if not public.is_project_staff() then
    raise exception 'Only project leads and admins can set task dependencies';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if p_override is not null then
    update tasks
    set dependency_override = p_override
    where id = p_task_id;
  end if;

  delete from task_dependencies where task_id = p_task_id;

  foreach v_id in array v_ids
  loop
    if v_id is null or v_id = p_task_id then
      continue;
    end if;
    if not exists (
      select 1 from tasks
      where id = v_id and project_id = v_task.project_id
    ) then
      raise exception 'Blocking task % is not in this project', v_id;
    end if;
    insert into task_dependencies (task_id, blocks_on_task_id, created_by)
    values (p_task_id, v_id, v_uid)
    on conflict do nothing;
    v_inserted := v_inserted + 1;
  end loop;

  insert into activity_log (
    project_id, user_id, action, target_type, target_id, target_title, metadata
  )
  values (
    v_task.project_id,
    v_uid,
    'dependencies_updated',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'blocker_ids', to_jsonb(v_ids),
      'override', coalesce(p_override, v_task.dependency_override)
    )
  );

  return jsonb_build_object(
    'task_id', p_task_id,
    'blocker_count', v_inserted,
    'dependency_override', (
      select dependency_override from tasks where id = p_task_id
    ),
    'is_locked', public.task_is_dependency_locked(p_task_id)
  );
end;
$$;


ALTER FUNCTION "public"."set_task_dependencies"("p_task_id" "uuid", "p_blocker_ids" "uuid"[], "p_override" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_role"("p_user_id" "uuid", "p_new_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_old_role text;
  v_new_role text := lower(trim(coalesce(p_new_role, '')));
  v_username text;
begin
  if v_actor is null then
    raise exception 'Sign in required';
  end if;

  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  if v_new_role not in ('user', 'moderator', 'founder') then
    raise exception 'Role must be user, moderator, or founder';
  end if;

  select coalesce(role, 'user') into v_actor_role
  from public.profiles
  where id = v_actor;

  if v_actor_role is distinct from 'founder' then
    raise exception 'Only a Founder can change roles';
  end if;

  if p_user_id = v_actor then
    raise exception 'You cannot change your own role';
  end if;

  select coalesce(role, 'user'), username
    into v_old_role, v_username
  from public.profiles
  where id = p_user_id;

  if v_old_role is null then
    raise exception 'User not found';
  end if;

  if v_old_role = v_new_role then
    return jsonb_build_object(
      'id', p_user_id,
      'username', v_username,
      'role', v_old_role
    );
  end if;

  if v_old_role = 'founder' then
    raise exception 'The Founder role cannot be changed here';
  end if;

  if v_new_role = 'founder'
     and exists (
       select 1 from public.profiles
       where role = 'founder'
         and id is distinct from p_user_id
     )
  then
    raise exception 'There can only be one Founder';
  end if;

  perform set_config('app.allow_role_change', 'on', true);

  update public.profiles
  set role = v_new_role
  where id = p_user_id;

  insert into public.role_change_log (user_id, changed_by, old_role, new_role)
  values (p_user_id, v_actor, v_old_role, v_new_role);

  return jsonb_build_object(
    'id', p_user_id,
    'username', v_username,
    'role', v_new_role,
    'old_role', v_old_role
  );
end;
$$;


ALTER FUNCTION "public"."set_user_role"("p_user_id" "uuid", "p_new_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_user_role"("p_user_id" "uuid", "p_new_role" "text") IS 'Founder-only. Sets a profile role to user, moderator, or founder and writes role_change_log.';



CREATE OR REPLACE FUNCTION "public"."submit_task_for_review"("p_task_id" "uuid", "p_evidence" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_evidence text := trim(coalesce(p_evidence, ''));
  v_note text;
  v_min_hold interval := interval '2 minutes';
  v_submit_limit int;
  v_submits_24h int;
  v_last_submit timestamptz;
  v_bypass boolean := false;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  v_bypass := public.user_bypasses_task_limits(v_uid);

  if not public.user_meets_identity_gate(v_uid) then
    raise exception 'IDENTITY_GATE: Verify your email and link Discord or Google before submitting for review.';
  end if;

  if public.user_is_claim_restricted(v_uid) then
    raise exception 'CLAIM_RESTRICTED: Your claim privileges are limited, so you cannot submit new work for review right now. Contact a Project Lead via Discord to appeal.';
  end if;

  v_note := public.evidence_note_body(v_evidence);
  if length(v_note) < 15 then
    raise exception 'EVIDENCE_REQUIRED: Add a short evidence note (at least 15 characters) describing what you delivered.';
  end if;

  if not public.evidence_has_url(v_evidence) then
    raise exception 'EVIDENCE_LINK_REQUIRED: Include at least one evidence link (URL) so reviewers can verify your work.';
  end if;

  if not v_bypass then
    v_submit_limit := public.user_submit_limit_24h(v_uid);

    select count(*) into v_submits_24h
    from task_claims
    where user_id = v_uid
      and submitted_at is not null
      and submitted_at > now() - interval '24 hours';

    if v_submits_24h >= v_submit_limit then
      raise exception 'SUBMIT_LIMIT: Review submission limit reached (% / % in 24 hours). Limits rise after accepted reviews.',
        v_submits_24h, v_submit_limit;
    end if;

    select max(submitted_at) into v_last_submit
    from task_claims
    where user_id = v_uid and submitted_at is not null;

    if v_last_submit is not null and v_last_submit > now() - interval '45 minutes' then
      raise exception 'SUBMIT_COOLDOWN: Wait about % more minutes before submitting another task for review.',
        ceil(extract(epoch from (v_last_submit + interval '45 minutes' - now())) / 60.0);
    end if;
  else
    v_submit_limit := public.user_submit_limit_24h(v_uid);
    v_submits_24h := 0;
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status = 'Completed' then
    raise exception 'Task is already completed';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'Active' and user_id = v_uid
  for update;

  if not found then
    raise exception 'Only the active claimant can submit this task for review';
  end if;

  if not v_bypass
     and v_claim.claimed_at is not null
     and v_claim.claimed_at > now() - v_min_hold then
    raise exception 'Please work on the task a bit longer before submitting for review (minimum 2 minutes after claim).';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_task.subtasks, '[]'::jsonb)) elem
    where jsonb_typeof(elem) = 'object'
      and coalesce(
        (elem->>'done')::boolean,
        (elem->>'completed')::boolean,
        false
      ) is not true
  ) then
    raise exception 'Complete every checklist item before submitting for review.';
  end if;

  update task_claims set
    status = 'PendingReview',
    progress_percent = greatest(coalesce(progress_percent, 0), 90),
    submission_evidence = v_evidence,
    submitted_at = now(),
    review_feedback = null,
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  update tasks set status = 'InReview' where id = p_task_id
  returning * into v_task;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'submitted for review',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'claim_id', v_claim.id,
      'evidence_preview', left(v_evidence, 120),
      'submits_24h', v_submits_24h + 1,
      'submit_limit', v_submit_limit,
      'rate_limit_bypass', v_bypass
    )
  );

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'claim', to_jsonb(v_claim),
    'rate_limit_bypass', v_bypass
  );
end;
$$;


ALTER FUNCTION "public"."submit_task_for_review"("p_task_id" "uuid", "p_evidence" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."submit_task_for_review"("p_task_id" "uuid", "p_evidence" "text") IS 'Claimant submits evidence for lead/moderator review (cannot self-complete).';



CREATE OR REPLACE FUNCTION "public"."sync_idea_tags_after_save"("p_tag_names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n text;
begin
  if p_tag_names is not null then
    foreach n in array p_tag_names
    loop
      begin
        perform public.ensure_idea_tag(n, false);
      exception when others then
        null;
      end;
    end loop;
  end if;
  perform public.recompute_idea_tag_usage();
end;
$$;


ALTER FUNCTION "public"."sync_idea_tags_after_save"("p_tag_names" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_my_badges"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  return public.sync_user_badges(auth.uid());
end;
$$;


ALTER FUNCTION "public"."sync_my_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_parent_claim_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_parent_id uuid;
  v_pct integer;
begin
  v_parent_id := coalesce(new.parent_task_id, old.parent_task_id);
  if v_parent_id is null then
    return coalesce(new, old);
  end if;

  v_pct := public.task_child_progress_percent(v_parent_id);
  if v_pct is null then
    return coalesce(new, old);
  end if;

  update task_claims
  set
    progress_percent = v_pct,
    last_activity_at = now()
  where task_id = v_parent_id
    and status = 'Active';

  -- Bubble one level (epic progress from medium tasks)
  update task_claims tc
  set
    progress_percent = public.task_child_progress_percent(t.parent_task_id),
    last_activity_at = now()
  from tasks t
  where t.id = v_parent_id
    and t.parent_task_id is not null
    and tc.task_id = t.parent_task_id
    and tc.status = 'Active'
    and public.task_child_progress_percent(t.parent_task_id) is not null;

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_parent_claim_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_parent_ready_for_review"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_parent_id uuid;
  v_grandparent_id uuid;
  v_total integer;
  v_done integer;
begin
  v_parent_id := coalesce(new.parent_task_id, old.parent_task_id);
  if v_parent_id is null then
    return coalesce(new, old);
  end if;

  select
    count(*)::integer,
    count(*) filter (where status = 'Completed')::integer
  into v_total, v_done
  from tasks
  where parent_task_id = v_parent_id;

  if v_total is null or v_total = 0 then
    return coalesce(new, old);
  end if;

  if v_done = v_total then
    -- All direct children Completed → parent Ready for Review (not Completed)
    update tasks
    set status = 'InReview'
    where id = v_parent_id
      and status is distinct from 'Completed'
      and status is distinct from 'InReview';
  else
    -- A child left Completed → parent should not stay in review unless staff
    -- is reviewing a claim on the parent itself.
    update tasks t
    set status = case
      when exists (
        select 1 from task_claims tc
        where tc.task_id = t.id and tc.status = 'Active'
      ) then 'InProgress'
      else 'ToDo'
    end
    where t.id = v_parent_id
      and t.status = 'InReview'
      and not exists (
        select 1 from task_claims tc
        where tc.task_id = t.id and tc.status = 'PendingReview'
      );
  end if;

  -- Bubble: if parent was just staff-Completed, re-evaluate grandparent
  select parent_task_id into v_grandparent_id
  from tasks where id = v_parent_id;

  if v_grandparent_id is not null then
    select
      count(*)::integer,
      count(*) filter (where status = 'Completed')::integer
    into v_total, v_done
    from tasks
    where parent_task_id = v_grandparent_id;

    if v_total > 0 and v_done = v_total then
      update tasks
      set status = 'InReview'
      where id = v_grandparent_id
        and status is distinct from 'Completed'
        and status is distinct from 'InReview';
    elsif v_total > 0 and v_done < v_total then
      update tasks t
      set status = case
        when exists (
          select 1 from task_claims tc
          where tc.task_id = t.id and tc.status = 'Active'
        ) then 'InProgress'
        else 'ToDo'
      end
      where t.id = v_grandparent_id
        and t.status = 'InReview'
        and not exists (
          select 1 from task_claims tc
          where tc.task_id = t.id and tc.status = 'PendingReview'
        );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."sync_parent_ready_for_review"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_parent_ready_for_review"() IS 'When all direct children are Completed, set parent to InReview. Staff complete_task still required for parent Completed.';



CREATE OR REPLACE FUNCTION "public"."sync_user_badges"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."sync_user_badges"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_child_progress_percent"("p_task_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (
      select case
        when count(*) = 0 then null
        else round(
          100.0 * count(*) filter (where status = 'Completed') / count(*)
        )::integer
      end
      from tasks
      where parent_task_id = p_task_id
    ),
    null
  );
$$;


ALTER FUNCTION "public"."task_child_progress_percent"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_dependencies_validate"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_task_project uuid;
  v_blocker_project uuid;
begin
  if new.task_id = new.blocks_on_task_id then
    raise exception 'A task cannot block itself';
  end if;

  select project_id into v_task_project from tasks where id = new.task_id;
  if not found then
    raise exception 'Dependent task not found';
  end if;

  select project_id into v_blocker_project from tasks where id = new.blocks_on_task_id;
  if not found then
    raise exception 'Blocking task not found';
  end if;

  if v_task_project is distinct from v_blocker_project then
    raise exception 'Dependencies must be within the same project';
  end if;

  -- Direct reverse edge = immediate cycle
  if exists (
    select 1 from task_dependencies
    where task_id = new.blocks_on_task_id
      and blocks_on_task_id = new.task_id
  ) then
    raise exception 'Circular dependency: these tasks already block each other';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."task_dependencies_validate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_incomplete_blockers"("p_task_id" "uuid") RETURNS TABLE("id" "uuid", "title" "text", "status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select b.id, b.title, b.status
  from task_dependencies d
  join tasks b on b.id = d.blocks_on_task_id
  join tasks t on t.id = d.task_id
  where d.task_id = p_task_id
    and coalesce(t.dependency_override, false) = false
    and b.status is distinct from 'Completed';
$$;


ALTER FUNCTION "public"."task_incomplete_blockers"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_is_dependency_locked"("p_task_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.task_incomplete_blockers(p_task_id)
  );
$$;


ALTER FUNCTION "public"."task_is_dependency_locked"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_nesting_depth"("p_task_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid := p_task_id;
  v_parent uuid;
  v_depth integer := 0;
begin
  if p_task_id is null then
    return 0;
  end if;

  loop
    select parent_task_id into v_parent from tasks where id = v_id;
    if not found then
      return v_depth;
    end if;
    if v_parent is null then
      return v_depth;
    end if;
    v_depth := v_depth + 1;
    if v_depth > 10 then
      return v_depth;
    end if;
    v_id := v_parent;
  end loop;
end;
$$;


ALTER FUNCTION "public"."task_nesting_depth"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_idea_vote"("p_idea_id" bigint) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_user uuid;
  v_exists boolean;
  v_public integer;
  v_claims text;
begin
  v_claims := current_setting('request.jwt.claims', true);
  begin
    v_user := nullif(nullif(v_claims, '')::jsonb ->> 'sub', '')::uuid;
  exception
    when others then
      v_user := public.request_uid();
  end;
  if v_user is null then
    v_user := public.request_uid();
  end if;
  if v_user is null then
    raise exception 'VOTE_AUTH_FAILED'
      using errcode = 'P0001',
            detail = coalesce(v_claims, '');
  end if;

  if p_idea_id is null or p_idea_id <= 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (select 1 from ideas where id = p_idea_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from votes where idea_id = p_idea_id and user_id = v_user
  ) into v_exists;

  if v_exists then
    delete from votes where idea_id = p_idea_id and user_id = v_user;
  else
    insert into votes (idea_id, user_id) values (p_idea_id, v_user);
  end if;

  select coalesce(votes_public, votes, 0)
  into v_public
  from ideas
  where id = p_idea_id;

  return json_build_object(
    'voted', not v_exists,
    'votes', coalesce(v_public, 0)
  );
end;
$$;


ALTER FUNCTION "public"."toggle_idea_vote"("p_idea_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_showcase_like"("p_post_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid;
  v_exists boolean;
  v_public integer;
begin
  v_user := public.request_uid();
  if v_user is null then
    v_user := auth.uid();
  end if;
  if v_user is null then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;
  if p_post_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from community_showcase_posts
    where id = p_post_id and status = 'approved'
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  begin
    perform public.assert_action_allowed(
      'showcase_like',
      200,
      interval '15 minutes',
      interval '200 milliseconds',
      'user:' || v_user::text
    );
  exception
    when others then
      if sqlerrm like 'RATE_LIMITED%' then
        raise;
      end if;
      null;
  end;

  select exists (
    select 1
    from community_showcase_likes
    where post_id = p_post_id and user_id = v_user
  ) into v_exists;

  if v_exists then
    delete from community_showcase_likes
    where post_id = p_post_id and user_id = v_user;
  else
    insert into community_showcase_likes (post_id, user_id)
    values (p_post_id, v_user);
  end if;

  select coalesce(likes_public, likes, 0)
  into v_public
  from community_showcase_posts
  where id = p_post_id;

  return json_build_object(
    'liked', not v_exists,
    'likes', coalesce(v_public, 0)
  );
end;
$$;


ALTER FUNCTION "public"."toggle_showcase_like"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_bug_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  if new.status in ('Fixed', 'Closed') and old.status is distinct from new.status then
    new.resolved_at := coalesce(new.resolved_at, now());
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_bug_reports_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_community_showcase_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_community_showcase_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_official_videos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_official_videos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_platform_suggestions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_platform_suggestions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_donation_forge_marks"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  st text;
begin
  st := lower(trim(coalesce(new.status, 'completed')));
  if new.user_id is not null
     and st in ('completed', 'paid', 'succeeded') then
    perform public.grant_forge_marks_from_donation(new.id);
  elsif st in ('refunded', 'failed', 'canceled', 'cancelled') then
    perform public.clawback_forge_marks_for_donation(new.id);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_donation_forge_marks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_grant_game_shipper_on_project"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_now_released boolean;
  v_was_released boolean;
begin
  v_now_released := public.project_is_released(NEW.status, NEW.completed_at);
  if TG_OP = 'INSERT' then
    if v_now_released then
      perform public.grant_game_shipper_for_project(NEW.id);
    end if;
    return NEW;
  end if;

  v_was_released := public.project_is_released(OLD.status, OLD.completed_at);
  -- Newly released (or re-completed after edit)
  if v_now_released and (
    not v_was_released
    or NEW.status is distinct from OLD.status
    or NEW.completed_at is distinct from OLD.completed_at
  ) then
    perform public.grant_game_shipper_for_project(NEW.id);
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."trg_grant_game_shipper_on_project"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_badges_on_award"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.trg_sync_badges_user(NEW.giver_id);
  perform public.trg_sync_badges_user(NEW.receiver_id);
  return NEW;
end;
$$;


ALTER FUNCTION "public"."trg_sync_badges_on_award"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_badges_on_claim"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."trg_sync_badges_on_claim"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_badges_on_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."trg_sync_badges_on_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_badges_on_donation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if NEW.user_id is not null then
    perform public.sync_user_badges(NEW.user_id);
  end if;
  if TG_OP = 'UPDATE' and OLD.user_id is not null and OLD.user_id is distinct from NEW.user_id then
    perform public.sync_user_badges(OLD.user_id);
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."trg_sync_badges_on_donation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_badges_on_idea"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.trg_sync_badges_user(NEW.user_id);
  if TG_OP = 'UPDATE' and OLD.user_id is distinct from NEW.user_id then
    perform public.trg_sync_badges_user(OLD.user_id);
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."trg_sync_badges_on_idea"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_badges_on_showcase"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.trg_sync_badges_user(NEW.creator_user_id);
  if TG_OP = 'UPDATE'
     and OLD.creator_user_id is distinct from NEW.creator_user_id then
    perform public.trg_sync_badges_user(OLD.creator_user_id);
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."trg_sync_badges_on_showcase"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_badges_on_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if NEW.user_id is not null then
    perform public.sync_user_badges(NEW.user_id);
  end if;
  if TG_OP = 'UPDATE' and OLD.user_id is not null and OLD.user_id is distinct from NEW.user_id then
    perform public.sync_user_badges(OLD.user_id);
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."trg_sync_badges_on_subscription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_badges_on_vote"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."trg_sync_badges_on_vote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_badges_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_user_id is not null then
    perform public.sync_user_badges(p_user_id);
  end if;
end;
$$;


ALTER FUNCTION "public"."trg_sync_badges_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_task_claim_memorial_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_project_id uuid;
  v_category text;
  v_sub text;
  v_title text;
  v_username text;
begin
  if upper(trim(coalesce(new.status, ''))) <> 'COMPLETED' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and upper(trim(coalesce(old.status, ''))) = 'COMPLETED' then
    return new;
  end if;
  if new.user_id is null then
    return new;
  end if;

  select t.project_id, t.category
    into v_project_id, v_category
  from tasks t
  where t.id = new.task_id;

  if v_project_id is null then
    return new;
  end if;

  -- Map common task categories to development subcategories
  v_sub := case lower(trim(coalesce(v_category, '')))
    when 'code' then 'Coding'
    when 'coding' then 'Coding'
    when 'art' then 'Art'
    when 'art / visual design' then 'Art'
    when 'design' then 'Design'
    when 'models' then 'Models'
    when 'model' then 'Models'
    when 'audio' then 'Audio'
    when 'sound' then 'Audio'
    when 'writing' then 'Writing'
    when 'qa' then 'QA / Testing'
    when 'testing' then 'QA / Testing'
    when 'qa / testing' then 'QA / Testing'
    when 'server' then 'Server Design'
    when 'server design' then 'Server Design'
    else 'Other'
  end;

  select coalesce(nullif(trim(title), ''), nullif(trim(slug), ''), 'Project')
    into v_title
  from projects
  where id = v_project_id;

  select nullif(trim(username), '') into v_username
  from profiles where id = new.user_id;

  perform public.ensure_project_contribution(
    v_project_id,
    new.user_id,
    coalesce(v_username, 'Contributor'),
    'development',
    v_sub,
    null,
    'task-claim:' || new.id::text,
    v_title,
    v_username
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_task_claim_memorial_credit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_debit_ai_tokens"("p_user_id" "uuid", "p_tokens" integer, "p_action_key" "text", "p_prompt_summary" "text" DEFAULT NULL::"text", "p_provider" "text" DEFAULT NULL::"text", "p_model" "text" DEFAULT NULL::"text", "p_api_cost_usd_micros" bigint DEFAULT 0, "p_margin_usd_micros" bigint DEFAULT 0, "p_idempotency_key" "text" DEFAULT NULL::"text", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  bal integer;
  ledger_row public.ai_token_ledger;
  existing public.ai_token_ledger;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED');
  end if;
  if p_tokens is null or p_tokens <= 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_TOKENS');
  end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.ai_token_ledger
    where idempotency_key = p_idempotency_key
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'ledger_id', existing.id,
        'tokens', existing.tokens_display,
        'balance_after', (
          select balance from public.ai_token_balances where user_id = p_user_id
        )
      );
    end if;
  end if;

  perform public.ensure_ai_token_balance(p_user_id);

  select balance into bal
  from public.ai_token_balances
  where user_id = p_user_id
  for update;

  if bal is null or bal < p_tokens then
    return jsonb_build_object(
      'ok', false,
      'code', 'INSUFFICIENT_TOKENS',
      'balance', coalesce(bal, 0),
      'required', p_tokens
    );
  end if;

  insert into public.ai_token_ledger (
    user_id, entry_type, tokens, tokens_display, status, prompt_summary,
    action_key, provider, model, api_cost_usd_micros, margin_usd_micros,
    idempotency_key, meta
  ) values (
    p_user_id, 'spend', -p_tokens, p_tokens, 'success', p_prompt_summary,
    p_action_key, p_provider, p_model,
    coalesce(p_api_cost_usd_micros, 0),
    coalesce(p_margin_usd_micros, 0),
    p_idempotency_key,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning * into ledger_row;

  update public.ai_token_balances
  set
    balance = balance - p_tokens,
    lifetime_spent = lifetime_spent + p_tokens,
    updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'ledger_id', ledger_row.id,
    'tokens', p_tokens,
    'balance_after', bal - p_tokens
  );
end;
$$;


ALTER FUNCTION "public"."try_debit_ai_tokens"("p_user_id" "uuid", "p_tokens" integer, "p_action_key" "text", "p_prompt_summary" "text", "p_provider" "text", "p_model" "text", "p_api_cost_usd_micros" bigint, "p_margin_usd_micros" bigint, "p_idempotency_key" "text", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_debit_ai_tokens_up_to"("p_user_id" "uuid", "p_tokens" integer, "p_action_key" "text", "p_prompt_summary" "text" DEFAULT NULL::"text", "p_provider" "text" DEFAULT NULL::"text", "p_model" "text" DEFAULT NULL::"text", "p_api_cost_usd_micros" bigint DEFAULT 0, "p_margin_usd_micros" bigint DEFAULT 0, "p_idempotency_key" "text" DEFAULT NULL::"text", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  bal integer;
  debit integer;
  ledger_row public.ai_token_ledger;
  existing public.ai_token_ledger;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED');
  end if;
  if p_tokens is null or p_tokens < 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_TOKENS');
  end if;

  if p_idempotency_key is not null then
    select * into existing
    from public.ai_token_ledger
    where idempotency_key = p_idempotency_key
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'ledger_id', existing.id,
        'tokens', existing.tokens_display,
        'balance_after', (
          select balance from public.ai_token_balances where user_id = p_user_id
        )
      );
    end if;
  end if;

  perform public.ensure_ai_token_balance(p_user_id);

  select balance into bal
  from public.ai_token_balances
  where user_id = p_user_id
  for update;

  bal := coalesce(bal, 0);
  debit := least(p_tokens, bal);

  if debit <= 0 then
    return jsonb_build_object(
      'ok', true,
      'tokens', 0,
      'balance_after', bal,
      'partial', true,
      'skipped', true
    );
  end if;

  insert into public.ai_token_ledger (
    user_id, entry_type, tokens, tokens_display, status, prompt_summary,
    action_key, provider, model, api_cost_usd_micros, margin_usd_micros,
    idempotency_key, meta
  ) values (
    p_user_id, 'spend', -debit, debit, 'success', p_prompt_summary,
    p_action_key, p_provider, p_model,
    coalesce(p_api_cost_usd_micros, 0),
    coalesce(p_margin_usd_micros, 0),
    p_idempotency_key,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning * into ledger_row;

  update public.ai_token_balances
  set
    balance = balance - debit,
    lifetime_spent = lifetime_spent + debit,
    updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'ledger_id', ledger_row.id,
    'tokens', debit,
    'balance_after', bal - debit,
    'partial', debit < p_tokens,
    'requested', p_tokens
  );
end;
$$;


ALTER FUNCTION "public"."try_debit_ai_tokens_up_to"("p_user_id" "uuid", "p_tokens" integer, "p_action_key" "text", "p_prompt_summary" "text", "p_provider" "text", "p_model" "text", "p_api_cost_usd_micros" bigint, "p_margin_usd_micros" bigint, "p_idempotency_key" "text", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_progress"("p_task_id" "uuid", "p_progress_percent" integer DEFAULT NULL::integer, "p_subtasks" "jsonb" DEFAULT NULL::"jsonb", "p_notes" "text" DEFAULT NULL::"text", "p_helpers" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_task tasks%rowtype;
  v_claim task_claims%rowtype;
  v_is_staff boolean := public.is_project_staff();
  v_progress integer;
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status = 'InReview' and not v_is_staff then
    raise exception 'This task is waiting for review. A Project Lead will accept or reject it soon.';
  end if;

  select * into v_claim from task_claims
  where task_id = p_task_id and status = 'Active'
  for update;

  if not found then
    raise exception 'No active claim on this task';
  end if;

  if v_claim.user_id <> v_uid and not v_is_staff then
    raise exception 'Only the claimant or project staff can update progress';
  end if;

  if p_progress_percent is not null then
    if p_progress_percent < 0 or p_progress_percent > 100 then
      raise exception 'Progress must be between 0 and 100';
    end if;
    -- Claimants: cap at 99 so 100% only happens via accepted review
    if not v_is_staff and p_progress_percent >= 100 then
      v_progress := 99;
    else
      v_progress := p_progress_percent;
    end if;
  else
    v_progress := null;
  end if;

  update task_claims set
    progress_percent = coalesce(v_progress, progress_percent),
    notes = coalesce(p_notes, notes),
    helpers = coalesce(p_helpers, helpers),
    last_activity_at = now()
  where id = v_claim.id
  returning * into v_claim;

  if p_subtasks is not null then
    update tasks set subtasks = p_subtasks where id = p_task_id
    returning * into v_task;
  end if;

  if v_task.status = 'ToDo' then
    update tasks set status = 'InProgress' where id = p_task_id
    returning * into v_task;
  end if;

  insert into activity_log (project_id, user_id, action, target_type, target_id, target_title, metadata)
  values (
    v_task.project_id,
    v_uid,
    'updated progress on',
    'task',
    v_task.id,
    v_task.title,
    jsonb_build_object(
      'progress_percent', v_claim.progress_percent,
      'claim_id', v_claim.id
    )
  );

  return jsonb_build_object('claim', to_jsonb(v_claim), 'task', to_jsonb(v_task));
end;
$$;


ALTER FUNCTION "public"."update_task_progress"("p_task_id" "uuid", "p_progress_percent" integer, "p_subtasks" "jsonb", "p_notes" "text", "p_helpers" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_accepted_task_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(*)::integer
  from task_claims
  where user_id = p_user_id and status = 'Completed';
$$;


ALTER FUNCTION "public"."user_accepted_task_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_awards_given_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_awards_given_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_awards_received_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_awards_received_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_bypasses_abuse_limits"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    return false;
  end if;
  begin
    if public.is_staff() then
      return true;
    end if;
  exception
    when undefined_function then
      null;
  end;
  begin
    if public.is_project_staff() then
      return true;
    end if;
  exception
    when undefined_function then
      null;
  end;
  begin
    if public.user_bypasses_task_limits(auth.uid()) then
      return true;
    end if;
  exception
    when undefined_function then
      null;
  end;
  return false;
end;
$$;


ALTER FUNCTION "public"."user_bypasses_abuse_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_bypasses_task_limits"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
        select coalesce((
          select
            coalesce(p.task_limit_bypass, false)
            or coalesce(p.role, 'user') in (
              'admin', 'moderator', 'project_lead', 'founder'
            )
          from public.profiles p
          where p.id = p_user_id
        ), false);
      $$;


ALTER FUNCTION "public"."user_bypasses_task_limits"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_bypasses_task_limits"("p_user_id" "uuid") IS 'True for staff (admin/moderator/project_lead) or profiles.task_limit_bypass — skips Task Board velocity limits.';



CREATE OR REPLACE FUNCTION "public"."user_claim_limit"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when public.user_bypasses_task_limits(p_user_id) then 50
    when public.user_accepted_task_count(p_user_id) >= 5 then 5
    when public.user_accepted_task_count(p_user_id) >= 2 then 3
    else 2
  end;
$$;


ALTER FUNCTION "public"."user_claim_limit"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_completed_claim_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(*)::integer
  from task_claims
  where user_id = p_user_id and status = 'Completed';
$$;


ALTER FUNCTION "public"."user_completed_claim_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_completed_task_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_user_id is null then
    return 0;
  end if;
  -- Prefer existing anti-abuse helper when present
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'user_accepted_task_count'
  ) then
    return public.user_accepted_task_count(p_user_id);
  end if;
  if to_regclass('public.task_claims') is null then
    return 0;
  end if;
  return (
    select count(*)::integer
    from public.task_claims tc
    where tc.user_id = p_user_id
      and tc.status = 'Completed'
  );
end;
$$;


ALTER FUNCTION "public"."user_completed_task_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_donation_total_cents"("p_user_id" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(sum(coalesce(d.amount_cents, d.amount * 100, 0)), 0)::bigint
  from public.donations d
  where d.user_id = p_user_id
    and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
    and coalesce(d.amount_cents, d.amount * 100, 0) > 0;
$$;


ALTER FUNCTION "public"."user_donation_total_cents"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_feedback_on_others_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_feedback_on_others_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_active_subscription"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_user_id is null then
    return false;
  end if;
  if to_regclass('public.stripe_subscriptions') is null then
    return false;
  end if;
  return exists (
    select 1
    from public.stripe_subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active', 'trialing')
  );
end;
$$;


ALTER FUNCTION "public"."user_has_active_subscription"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_early_support"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."user_has_early_support"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_joined_force"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_has_joined_force"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_shared_victory"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_has_shared_victory"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_shipped_game"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_user_id is null then
    return false;
  end if;
  if to_regclass('public.projects') is null then
    return false;
  end if;

  -- Memorial / staff contributions
  if to_regclass('public.project_contributions') is not null then
    if exists (
      select 1
      from public.project_contributions pc
      join public.projects p on p.id = pc.project_id
      where pc.user_id = p_user_id
        and public.project_is_released(p.status, p.completed_at)
    ) then
      return true;
    end if;
  end if;

  -- Accepted task work on a released project
  if to_regclass('public.task_claims') is not null
     and to_regclass('public.tasks') is not null then
    if exists (
      select 1
      from public.task_claims tc
      join public.tasks t on t.id = tc.task_id
      join public.projects p on p.id = t.project_id
      where tc.user_id = p_user_id
        and tc.status = 'Completed'
        and public.project_is_released(p.status, p.completed_at)
    ) then
      return true;
    end if;
  end if;

  -- Ideas linked to a released project (by uuid or slug in ideas.project_id)
  if to_regclass('public.ideas') is not null then
    if exists (
      select 1
      from public.ideas i
      join public.projects p
        on p.id::text = nullif(trim(i.project_id::text), '')
        or lower(p.slug) = lower(nullif(trim(i.project_id::text), ''))
      where i.user_id = p_user_id
        and public.project_is_released(p.status, p.completed_at)
        and (
          i.status is null
          or lower(coalesce(i.status, '')) not in ('draft', 'archived', 'hidden', 'rejected')
        )
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;


ALTER FUNCTION "public"."user_has_shipped_game"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_identity_gate_status"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_email_ok boolean := false;
  v_sso_ok boolean := false;
  v_providers text[] := array[]::text[];
begin
  if p_user_id is null then
    return jsonb_build_object(
      'signed_in', false,
      'email_verified', false,
      'has_sso', false,
      'meets_gate', false,
      'providers', '[]'::jsonb
    );
  end if;

  select (u.email_confirmed_at is not null)
  into v_email_ok
  from auth.users u
  where u.id = p_user_id;

  select coalesce(array_agg(lower(i.provider) order by i.provider), array[]::text[])
  into v_providers
  from auth.identities i
  where i.user_id = p_user_id;

  v_sso_ok := exists (
    select 1 from unnest(v_providers) p
    where p in ('discord', 'google', 'github')
  );

  return jsonb_build_object(
    'signed_in', true,
    'email_verified', coalesce(v_email_ok, false),
    'has_sso', v_sso_ok,
    'meets_gate', coalesce(v_email_ok, false) and v_sso_ok,
    'providers', to_jsonb(v_providers)
  );
end;
$$;


ALTER FUNCTION "public"."user_identity_gate_status"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_claim_restricted"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.user_task_restrictions%rowtype;
begin
  select * into v_row
  from public.user_task_restrictions
  where user_id = p_user_id;

  if not found then
    return false;
  end if;

  if not v_row.is_restricted then
    return false;
  end if;

  if v_row.is_permanent then
    return true;
  end if;

  if v_row.restricted_until is not null and v_row.restricted_until > now() then
    return true;
  end if;

  -- Expired temporary restriction — treat as not restricted (lazy clear)
  return false;
end;
$$;


ALTER FUNCTION "public"."user_is_claim_restricted"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_marks_spent_on_awards"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_marks_spent_on_awards"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_max_awards_on_target"("p_user_id" "uuid", "p_target_type" "text") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_max_awards_on_target"("p_user_id" "uuid", "p_target_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_max_idea_comments_by_others"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_max_idea_comments_by_others"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_max_idea_masterworks"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_max_idea_masterworks"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_max_idea_votes"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_max_idea_votes"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_max_showcase_likes"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_max_showcase_likes"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_meaningful_comment_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_meaningful_comment_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_meets_identity_gate"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_email_ok boolean := false;
  v_sso_ok boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  select (u.email_confirmed_at is not null)
  into v_email_ok
  from auth.users u
  where u.id = p_user_id;

  if not coalesce(v_email_ok, false) then
    return false;
  end if;

  select exists (
    select 1
    from auth.identities i
    where i.user_id = p_user_id
      and lower(i.provider) in ('discord', 'google', 'github')
  ) into v_sso_ok;

  return coalesce(v_sso_ok, false);
end;
$$;


ALTER FUNCTION "public"."user_meets_identity_gate"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_public_idea_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_public_idea_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_showcase_submission_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_showcase_submission_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_submit_limit_24h"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when public.user_bypasses_task_limits(p_user_id) then 500
    when public.user_accepted_task_count(p_user_id) >= 5 then 12
    when public.user_accepted_task_count(p_user_id) >= 2 then 4
    else 2
  end;
$$;


ALTER FUNCTION "public"."user_submit_limit_24h"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_task_claim_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_task_claim_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."abuse_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_key" "text",
    "user_id" "uuid",
    "action" "text",
    "reason" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."abuse_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."action_rate_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_key" "text" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."action_rate_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" DEFAULT 'task'::"text",
    "target_id" "uuid",
    "target_title" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_generation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action_key" "text" NOT NULL,
    "status" "text" NOT NULL,
    "prompt_summary" "text",
    "tokens_charged" integer DEFAULT 0 NOT NULL,
    "provider" "text",
    "model" "text",
    "api_cost_usd_micros" bigint DEFAULT 0 NOT NULL,
    "latency_ms" integer,
    "error_code" "text",
    "error_message" "text",
    "request_id" "text",
    "ledger_id" "uuid",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_generation_log_api_cost_usd_micros_check" CHECK (("api_cost_usd_micros" >= 0)),
    CONSTRAINT "ai_generation_log_status_chk" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'rate_limited'::"text", 'spend_capped'::"text", 'insufficient_tokens'::"text", 'disabled'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "ai_generation_log_tokens_charged_check" CHECK (("tokens_charged" >= 0))
);


ALTER TABLE "public"."ai_generation_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_generation_log" IS 'Internal AI generation attempts for debugging and studio spend caps.';



CREATE TABLE IF NOT EXISTS "public"."ai_platform_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "services_enabled" boolean DEFAULT true NOT NULL,
    "disabled_reason" "text",
    "daily_spend_cap_cents" integer DEFAULT 5000 NOT NULL,
    "monthly_spend_cap_cents" integer DEFAULT 100000 NOT NULL,
    "user_hourly_request_cap" integer DEFAULT 30 NOT NULL,
    "user_daily_request_cap" integer DEFAULT 100 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "ai_platform_config_daily_spend_cap_cents_check" CHECK (("daily_spend_cap_cents" >= 0)),
    CONSTRAINT "ai_platform_config_id_check" CHECK (("id" = 1)),
    CONSTRAINT "ai_platform_config_monthly_spend_cap_cents_check" CHECK (("monthly_spend_cap_cents" >= 0))
);


ALTER TABLE "public"."ai_platform_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_platform_config" IS 'AI platform kill-switch and studio spend caps (ops).';



CREATE OR REPLACE VIEW "public"."ai_token_ledger_user" AS
 SELECT "id",
    "user_id",
    "entry_type",
    "tokens_display" AS "tokens",
    "status",
    "prompt_summary",
    "action_key",
    "pack_id",
    "created_at"
   FROM "public"."ai_token_ledger"
  WHERE ("user_id" = "auth"."uid"());


ALTER VIEW "public"."ai_token_ledger_user" OWNER TO "postgres";


COMMENT ON VIEW "public"."ai_token_ledger_user" IS 'User-visible AI token history. Never exposes API cost or margins.';



CREATE TABLE IF NOT EXISTS "public"."ai_token_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pack_id" "text" NOT NULL,
    "tokens_granted" integer NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "stripe_session_id" "text",
    "stripe_payment_intent" "text",
    "stripe_customer_id" "text",
    "label" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_token_purchases_amount_cents_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "ai_token_purchases_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "ai_token_purchases_tokens_granted_check" CHECK (("tokens_granted" > 0))
);


ALTER TABLE "public"."ai_token_purchases" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_token_purchases" IS 'AI token pack purchases via Stripe. Separate from public.donations.';



CREATE TABLE IF NOT EXISTS "public"."bug_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "steps_to_reproduce" "text",
    "severity" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'Reported'::"text" NOT NULL,
    "screenshot_url" "text",
    "browser_info" "text",
    "device_info" "text",
    "reporter_id" "uuid",
    "reporter_email" "text",
    "reporter_name" "text",
    "staff_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "bug_reports_severity_check" CHECK (("severity" = ANY (ARRAY['Low'::"text", 'Medium'::"text", 'High'::"text", 'Critical'::"text"]))),
    CONSTRAINT "bug_reports_status_check" CHECK (("status" = ANY (ARRAY['Reported'::"text", 'Confirmed'::"text", 'In Progress'::"text", 'Fixed'::"text", 'Closed'::"text"])))
);


ALTER TABLE "public"."bug_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."bug_reports" IS 'Public bug tracker. Anyone may submit; staff triages status.';



CREATE TABLE IF NOT EXISTS "public"."claim_join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "claim_join_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."claim_join_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."claim_join_requests" IS 'Users request to join an active claim; owner or staff approve → added as helper.';



CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "id" bigint NOT NULL,
    "comment_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


ALTER TABLE "public"."comment_likes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."comment_likes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" bigint NOT NULL,
    "idea_id" bigint,
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" bigint
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


ALTER TABLE "public"."comments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."comments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."community_showcase_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_showcase_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_showcase_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "creator_display_name" "text" NOT NULL,
    "creator_user_id" "uuid",
    "submitter_email" "text",
    "url" "text",
    "youtube_id" "text",
    "image_url" "text",
    "thumbnail_url" "text",
    "project_tag" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "moderator_note" "text",
    "moderated_by" "uuid",
    "moderated_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "likes" integer DEFAULT 0 NOT NULL,
    "likes_public" integer,
    "likes_public_at" timestamp with time zone,
    CONSTRAINT "community_showcase_creator_len" CHECK (("char_length"(TRIM(BOTH FROM "creator_display_name")) >= 1)),
    CONSTRAINT "community_showcase_posts_content_type_check" CHECK (("content_type" = ANY (ARRAY['video'::"text", 'stream'::"text", 'art'::"text", 'article'::"text"]))),
    CONSTRAINT "community_showcase_posts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "community_showcase_title_len" CHECK (("char_length"(TRIM(BOTH FROM "title")) >= 2))
);


ALTER TABLE "public"."community_showcase_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."community_showcase_posts" IS 'Community Showcase submissions. Public only when status=approved. Official Media is separate.';



COMMENT ON COLUMN "public"."community_showcase_posts"."likes" IS 'Denormalized like count; kept in sync with community_showcase_likes.';



CREATE TABLE IF NOT EXISTS "public"."concern_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "what_happened" "text" NOT NULL,
    "where_happened" "text" NOT NULL,
    "reference" "text",
    "contact" "text",
    "user_id" "uuid",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "concern_reports_status_chk" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'closed'::"text"]))),
    CONSTRAINT "concern_reports_what_len" CHECK ((("char_length"(TRIM(BOTH FROM "what_happened")) >= 10) AND ("char_length"("what_happened") <= 4000))),
    CONSTRAINT "concern_reports_where_chk" CHECK (("where_happened" = ANY (ARRAY['discord'::"text", 'website'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."concern_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."concern_reports" IS 'Private Report a concern submissions. Not public. Staff / service_role only.';



CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" bigint NOT NULL,
    "reporter_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "reason" "text",
    "details" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid"
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_reports" IS 'User or staff reports of ideas/users/comments. Moderators resolve from dashboard.';



CREATE SEQUENCE IF NOT EXISTS "public"."content_reports_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."content_reports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."content_reports_id_seq" OWNED BY "public"."content_reports"."id";



CREATE TABLE IF NOT EXISTS "public"."decision_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" DEFAULT 'Governance'::"text" NOT NULL,
    "logged_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "body" "text" NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "decision_logs_body_len" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 10) AND ("char_length"(TRIM(BOTH FROM "body")) <= 1200))),
    CONSTRAINT "decision_logs_category_chk" CHECK (("category" = ANY (ARRAY['Governance'::"text", 'Process'::"text", 'Legal'::"text", 'Community'::"text"]))),
    CONSTRAINT "decision_logs_title_len" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 3) AND ("char_length"(TRIM(BOTH FROM "title")) <= 160)))
);


ALTER TABLE "public"."decision_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."donations" (
    "id" bigint NOT NULL,
    "amount" integer,
    "tier_label" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "project_id" "uuid",
    "amount_cents" integer,
    "currency" "text" DEFAULT 'usd'::"text",
    "interval" "text" DEFAULT 'once'::"text",
    "fund_type" "text" DEFAULT 'studio'::"text",
    "tier_id" "text",
    "status" "text" DEFAULT 'completed'::"text",
    "is_anonymous" boolean DEFAULT true,
    "stripe_session_id" "text",
    "stripe_payment_intent" "text",
    "stripe_subscription_id" "text",
    "stripe_customer_id" "text",
    "raw_event_id" "text",
    "display_name" "text",
    "payment_kind" "text" DEFAULT 'one_time'::"text",
    CONSTRAINT "donations_payment_kind_check" CHECK (("payment_kind" = ANY (ARRAY['one_time'::"text", 'subscription_payment'::"text"])))
);


ALTER TABLE "public"."donations" OWNER TO "postgres";


COMMENT ON TABLE "public"."donations" IS 'Stripe-backed support records. Written by webhook (service role). Public totals via get_public_support_summary().';



COMMENT ON COLUMN "public"."donations"."payment_kind" IS 'one_time = pure donation; subscription_payment = monthly sub charge (including renewals).';



ALTER TABLE "public"."donations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."donations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."forge_award_tiers" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "marks_cost" integer NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "allows_message" boolean DEFAULT false NOT NULL,
    CONSTRAINT "forge_award_tiers_marks_cost_check" CHECK (("marks_cost" > 0))
);


ALTER TABLE "public"."forge_award_tiers" OWNER TO "postgres";


COMMENT ON TABLE "public"."forge_award_tiers" IS 'Published Community Award types and Mark costs. Snapshot onto forge_awards at grant time.';



CREATE TABLE IF NOT EXISTS "public"."forge_award_totals" (
    "user_id" "uuid" NOT NULL,
    "award_tier" "text" NOT NULL,
    "award_name" "text" NOT NULL,
    "award_count" integer DEFAULT 0 NOT NULL,
    "marks_received" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forge_award_totals_award_count_check" CHECK (("award_count" >= 0)),
    CONSTRAINT "forge_award_totals_marks_received_check" CHECK (("marks_received" >= 0))
);


ALTER TABLE "public"."forge_award_totals" OWNER TO "postgres";


COMMENT ON TABLE "public"."forge_award_totals" IS 'Denormalized running totals of awards a user has received, by tier.';



CREATE TABLE IF NOT EXISTS "public"."forge_awards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "giver_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "award_tier" "text" NOT NULL,
    "award_name" "text" NOT NULL,
    "marks_spent" integer NOT NULL,
    "target_type" "text" DEFAULT 'other'::"text" NOT NULL,
    "target_id" "text",
    "target_url" "text",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forge_awards_marks_spent_check" CHECK (("marks_spent" > 0)),
    CONSTRAINT "forge_awards_message_len" CHECK ((("message" IS NULL) OR ("char_length"("message") <= 140))),
    CONSTRAINT "forge_awards_not_self" CHECK (("giver_id" <> "receiver_id")),
    CONSTRAINT "forge_awards_target_type_chk" CHECK (("target_type" = ANY (ARRAY['showcase'::"text", 'idea'::"text", 'official_media'::"text", 'comment'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."forge_awards" OWNER TO "postgres";


COMMENT ON TABLE "public"."forge_awards" IS 'Community Awards given with Forge Marks. Receiver gets a public achievement, not Marks.';



CREATE TABLE IF NOT EXISTS "public"."forge_mark_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_type" "text" NOT NULL,
    "marks" integer NOT NULL,
    "marks_display" integer NOT NULL,
    "donation_id" bigint,
    "award_id" "uuid",
    "idempotency_key" "text",
    "note" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forge_mark_ledger_marks_display_check" CHECK (("marks_display" >= 0)),
    CONSTRAINT "forge_mark_ledger_type_chk" CHECK (("entry_type" = ANY (ARRAY['donation_grant'::"text", 'award_spend'::"text", 'refund_clawback'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."forge_mark_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."forge_mark_ledger" IS 'Immutable Forge Marks movements. Donation grants are idempotent per donation_id.';



CREATE TABLE IF NOT EXISTS "public"."founders_thought_likes" (
    "id" bigint NOT NULL,
    "thought_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."founders_thought_likes" OWNER TO "postgres";


COMMENT ON TABLE "public"."founders_thought_likes" IS 'Per-user likes on founders_thoughts. Unique (thought_id, user_id).';



CREATE SEQUENCE IF NOT EXISTS "public"."founders_thought_likes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."founders_thought_likes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."founders_thought_likes_id_seq" OWNED BY "public"."founders_thought_likes"."id";



CREATE TABLE IF NOT EXISTS "public"."founders_thoughts" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "lead" "text",
    "theme" "text",
    "published_at" "date",
    "likes" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "likes_public" integer,
    "likes_public_at" timestamp with time zone
);


ALTER TABLE "public"."founders_thoughts" OWNER TO "postgres";


COMMENT ON TABLE "public"."founders_thoughts" IS 'Public founder notes. likes is denormalized count of founders_thought_likes rows.';



CREATE SEQUENCE IF NOT EXISTS "public"."founders_thoughts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."founders_thoughts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."founders_thoughts_id_seq" OWNED BY "public"."founders_thoughts"."id";



CREATE OR REPLACE VIEW "public"."idea_tags_public" WITH ("security_invoker"='true') AS
 SELECT "id",
    "slug",
    "name",
    "status",
    "usage_count",
    "created_at",
    "updated_at"
   FROM "public"."idea_tags"
  WHERE "public"."idea_tag_is_publicly_selectable"("status", "usage_count")
  ORDER BY "usage_count" DESC, ("lower"("name"));


ALTER VIEW "public"."idea_tags_public" OWNER TO "postgres";


ALTER TABLE "public"."ideas" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ideas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."mfa_recovery_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone
);


ALTER TABLE "public"."mfa_recovery_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."mfa_recovery_codes" IS 'One-time MFA recovery codes; code_hash only. Managed via mfa-recovery edge function.';



CREATE TABLE IF NOT EXISTS "public"."official_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "youtube_id" "text" NOT NULL,
    "thumbnail_url" "text",
    "category" "text",
    "published_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "official_videos_youtube_id_len" CHECK (("char_length"(TRIM(BOTH FROM "youtube_id")) >= 6))
);


ALTER TABLE "public"."official_videos" OWNER TO "postgres";


COMMENT ON TABLE "public"."official_videos" IS 'Official Together Forge videos for /media. Not community Showcase content.';



CREATE TABLE IF NOT EXISTS "public"."page_content" (
    "page_key" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."page_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."page_content" IS 'JSON content for phase hubs and other CMS-like pages (early_game, mid_game, late_game, …)';



CREATE TABLE IF NOT EXISTS "public"."platform_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" DEFAULT 'Other'::"text" NOT NULL,
    "status" "text" DEFAULT 'Open'::"text" NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_suggestions_category_check" CHECK (("category" = ANY (ARRAY['Payments'::"text", 'Task Board'::"text", 'Ideas'::"text", 'Auth'::"text", 'Mobile'::"text", 'Other'::"text"]))),
    CONSTRAINT "platform_suggestions_status_check" CHECK (("status" = ANY (ARRAY['Open'::"text", 'Under consideration'::"text", 'Done'::"text", 'Closed'::"text"])))
);


ALTER TABLE "public"."platform_suggestions" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_suggestions" IS 'Minimal platform / site suggestions. Signed-in submit; staff triage status or hide.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "email" "text",
    "avatar_url" "text",
    "bio" "text",
    "interests" "text",
    "favorite_games" "text",
    "favorite_game_types" "text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "banner_url" "text",
    "banner_position" "text" DEFAULT '50% 50%'::"text",
    "discord" "text",
    "youtube" "text",
    "twitch" "text",
    "x_handle" "text",
    "signature" "text",
    "role" "text" DEFAULT 'user'::"text",
    "moderation_status" "text" DEFAULT 'active'::"text",
    "moderation_note" "text",
    "github" "text",
    "show_donation_total" boolean DEFAULT false NOT NULL,
    "pinned_badge_key" "text",
    "task_limit_bypass" boolean DEFAULT false NOT NULL,
    "terms_version" "text",
    "terms_accepted_at" timestamp with time zone,
    "guidelines_version" "text",
    "guidelines_accepted_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."banner_url" IS 'Optional public URL for profile banner (wide landscape image).';



COMMENT ON COLUMN "public"."profiles"."banner_position" IS 'CSS object-position for banner framing, e.g. "50% 20%" (x y).';



COMMENT ON COLUMN "public"."profiles"."moderation_status" IS 'active | suspended | banned. Client and RLS should treat non-active carefully.';



COMMENT ON COLUMN "public"."profiles"."github" IS 'Public GitHub username or profile URL (display / link on public profile).';



COMMENT ON COLUMN "public"."profiles"."show_donation_total" IS 'DISPLAY only: when true, public profile shows the non-anonymous donation total. Does not affect whether donations are counted.';



COMMENT ON COLUMN "public"."profiles"."pinned_badge_key" IS 'Optional badge_key from user_badges shown next to the username site-wide.';



COMMENT ON COLUMN "public"."profiles"."task_limit_bypass" IS 'When true, user skips Task Board claim/submit velocity limits (test accounts). Staff roles always bypass regardless.';



COMMENT ON COLUMN "public"."profiles"."terms_version" IS 'Accepted Terms of Service version key (e.g. 2026-08-12).';



COMMENT ON COLUMN "public"."profiles"."terms_accepted_at" IS 'When the current terms_version was accepted.';



COMMENT ON COLUMN "public"."profiles"."guidelines_version" IS 'Accepted Community Guidelines version key.';



COMMENT ON COLUMN "public"."profiles"."guidelines_accepted_at" IS 'When the current guidelines_version was accepted.';



CREATE TABLE IF NOT EXISTS "public"."project_contributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "user_id" "uuid",
    "display_name" "text",
    "category" "text" NOT NULL,
    "subcategory" "text",
    "is_anonymous" boolean DEFAULT false NOT NULL,
    "amount_cents" integer,
    "role_label" "text",
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_key" "text",
    "project_title_snapshot" "text",
    "username_snapshot" "text",
    "archived_at" timestamp with time zone,
    CONSTRAINT "project_contributions_account_rule" CHECK ((("category" = 'donations'::"text") OR ("user_id" IS NOT NULL))),
    CONSTRAINT "project_contributions_amount_cents_check" CHECK ((("amount_cents" IS NULL) OR ("amount_cents" >= 0))),
    CONSTRAINT "project_contributions_category_check" CHECK (("category" = ANY (ARRAY['donations'::"text", 'development'::"text", 'marketing'::"text", 'community'::"text"])))
);


ALTER TABLE "public"."project_contributions" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_contributions" IS 'Permanent public credits. Memorial ledger for Contributors pages.';



COMMENT ON COLUMN "public"."project_contributions"."source_key" IS 'Stable idempotency key, e.g. task-claim:{id}, showcase:{id}, manual:{id}';



COMMENT ON COLUMN "public"."project_contributions"."project_title_snapshot" IS 'Project title at credit time — survives project rename/delete';



COMMENT ON COLUMN "public"."project_contributions"."username_snapshot" IS 'Username / display name at credit time';



COMMENT ON COLUMN "public"."project_contributions"."archived_at" IS 'When set, credit is hidden from public memorial (staff only). Prefer never archive.';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "phase" "text" DEFAULT 'Early'::"text",
    "status" "text" DEFAULT 'In Development'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "summary" "text",
    "completed_at" timestamp with time zone,
    "completion_links" "jsonb" DEFAULT '[]'::"jsonb",
    "completion_notes" "text",
    "sort_order" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "release_meta" "jsonb" DEFAULT '{}'::"jsonb",
    "github_url" "text",
    "contribution_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."summary" IS 'Short card blurb for phase hubs';



COMMENT ON COLUMN "public"."projects"."completed_at" IS 'When project was marked complete / released';



COMMENT ON COLUMN "public"."projects"."completion_links" IS 'JSON array of {label, url, kind?} release links';



COMMENT ON COLUMN "public"."projects"."completion_notes" IS 'Optional completion notes for public listing';



COMMENT ON COLUMN "public"."projects"."sort_order" IS 'Lower sorts first within a phase';



COMMENT ON COLUMN "public"."projects"."release_meta" IS 'Optional Released Games detail: tagline, platforms, genre, media[], steam_reviews {recent, overall, url}, development_story, cover_image, origin_idea_ids';



COMMENT ON COLUMN "public"."projects"."github_url" IS 'Optional GitHub repository or Project board URL shown on the Task Board.';



COMMENT ON COLUMN "public"."projects"."contribution_meta" IS 'Future contribution workflow settings (Discord notify channels, PR defaults).';



CREATE TABLE IF NOT EXISTS "public"."role_change_log" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "changed_by" "uuid",
    "old_role" "text",
    "new_role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_change_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."role_change_log" IS 'Who changed a profile role, from which role, to which role, and when. Written only by set_user_role().';



CREATE SEQUENCE IF NOT EXISTS "public"."role_change_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."role_change_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."role_change_log_id_seq" OWNED BY "public"."role_change_log"."id";



CREATE TABLE IF NOT EXISTS "public"."stripe_subscriptions" (
    "id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "fund_type" "text" DEFAULT 'studio'::"text",
    "amount_cents" integer,
    "currency" "text" DEFAULT 'usd'::"text",
    "customer_id" "text",
    "tier_id" "text",
    "cancel_at_period_end" boolean DEFAULT false,
    "current_period_end" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "is_anonymous" boolean DEFAULT true,
    "display_name" "text",
    "tier_label" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."stripe_subscriptions" IS 'Subscription lifecycle from customer.subscription.* webhooks.';



COMMENT ON COLUMN "public"."stripe_subscriptions"."user_id" IS 'Optional TF user credited on each renewal recognition card.';



COMMENT ON COLUMN "public"."stripe_subscriptions"."is_anonymous" IS 'Public credit choice from checkout (false = show username in recent support).';



CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "id" "text" NOT NULL,
    "type" "text",
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."stripe_webhook_events" IS 'Processed Stripe event ids for idempotency.';



CREATE TABLE IF NOT EXISTS "public"."task_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"(),
    "progress_percent" integer DEFAULT 0 NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'Active'::"text" NOT NULL,
    "helpers" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "last_claim_at" timestamp with time zone,
    "submission_evidence" "text",
    "submitted_at" timestamp with time zone,
    "review_feedback" "text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "task_claims_progress_percent_check" CHECK ((("progress_percent" >= 0) AND ("progress_percent" <= 100))),
    CONSTRAINT "task_claims_status_check" CHECK (("status" = ANY (ARRAY['Active'::"text", 'PendingReview'::"text", 'Completed'::"text", 'Returned'::"text"])))
);


ALTER TABLE "public"."task_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_dependencies" (
    "task_id" "uuid" NOT NULL,
    "blocks_on_task_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "task_dependencies_no_self" CHECK (("task_id" <> "blocks_on_task_id"))
);


ALTER TABLE "public"."task_dependencies" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_dependencies" IS 'task_id cannot be claimed until every blocks_on_task_id is Completed (or override).';



CREATE TABLE IF NOT EXISTS "public"."task_scope_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "resolution" "text",
    "staff_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "task_scope_requests_resolution_check" CHECK ((("resolution" IS NULL) OR ("resolution" = ANY (ARRAY['breakdown'::"text", 'promoted'::"text", 'adjusted'::"text", 'kept'::"text", 'other'::"text"])))),
    CONSTRAINT "task_scope_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'resolved'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."task_scope_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_scope_requests" IS 'Claimant-reported scope discovery: task larger than expected. Staff break down / re-scope.';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "difficulty" "text",
    "status" "text" DEFAULT 'ToDo'::"text" NOT NULL,
    "estimated_effort" "text",
    "subtasks" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_task_id" "uuid",
    "dependency_override" boolean DEFAULT false NOT NULL,
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['ToDo'::"text", 'InProgress'::"text", 'InReview'::"text", 'Completed'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tasks"."parent_task_id" IS 'Optional parent task. Null = top-level (kanban root). Max depth 0..2 (3 levels).';



COMMENT ON COLUMN "public"."tasks"."dependency_override" IS 'When true, ignore incomplete blockers so the task can be claimed (staff override).';



CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "user_id" "uuid" NOT NULL,
    "badge_key" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'sync'::"text"
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_task_restrictions" (
    "user_id" "uuid" NOT NULL,
    "is_restricted" boolean DEFAULT false NOT NULL,
    "is_permanent" boolean DEFAULT false NOT NULL,
    "restricted_until" timestamp with time zone,
    "fake_rejection_count" integer DEFAULT 0 NOT NULL,
    "last_reason" "text",
    "appeal_note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."user_task_restrictions" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_task_restrictions" IS 'Per-user claim restriction state (fake-work escalation + manual).';



CREATE TABLE IF NOT EXISTS "public"."username_history" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "old_username" "text" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."username_history" OWNER TO "postgres";


ALTER TABLE "public"."username_history" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."username_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."volunteer_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_type" "text" DEFAULT 'skill_offer'::"text" NOT NULL,
    "handle" "text" NOT NULL,
    "email" "text",
    "discord_username" "text",
    "skill_areas" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "skill_other" "text",
    "role_id" "text",
    "open_need_id" "text",
    "description" "text" NOT NULL,
    "time_commitment" "text",
    "portfolio_url" "text",
    "user_id" "uuid",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "staff_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "volunteer_applications_contact_chk" CHECK (((("email" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "email")) > 0)) OR (("discord_username" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "discord_username")) > 0)))),
    CONSTRAINT "volunteer_applications_status_chk" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'contacted'::"text", 'accepted'::"text", 'declined'::"text", 'archived'::"text"]))),
    CONSTRAINT "volunteer_applications_type_chk" CHECK (("application_type" = ANY (ARRAY['skill_offer'::"text", 'moderation_role'::"text", 'open_need'::"text"])))
);


ALTER TABLE "public"."volunteer_applications" OWNER TO "postgres";


COMMENT ON TABLE "public"."volunteer_applications" IS 'Private volunteer skill offers and mod self-nominations from Get Involved. Not public.';



CREATE TABLE IF NOT EXISTS "public"."votes" (
    "id" bigint NOT NULL,
    "idea_id" bigint,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."votes" OWNER TO "postgres";


COMMENT ON TABLE "public"."votes" IS 'Per-user idea votes. UI reads rows for liked state; count(*) and ideas.votes for totals.';



ALTER TABLE "public"."votes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."votes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."content_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."content_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."founders_thought_likes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."founders_thought_likes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."founders_thoughts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."founders_thoughts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."role_change_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."role_change_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."abuse_flags"
    ADD CONSTRAINT "abuse_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."action_rate_events"
    ADD CONSTRAINT "action_rate_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_generation_log"
    ADD CONSTRAINT "ai_generation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_platform_config"
    ADD CONSTRAINT "ai_platform_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_token_balances"
    ADD CONSTRAINT "ai_token_balances_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."ai_token_ledger"
    ADD CONSTRAINT "ai_token_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_token_purchases"
    ADD CONSTRAINT "ai_token_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bug_reports"
    ADD CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claim_join_requests"
    ADD CONSTRAINT "claim_join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_showcase_likes"
    ADD CONSTRAINT "community_showcase_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_showcase_likes"
    ADD CONSTRAINT "community_showcase_likes_unique" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."community_showcase_posts"
    ADD CONSTRAINT "community_showcase_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."concern_reports"
    ADD CONSTRAINT "concern_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decision_logs"
    ADD CONSTRAINT "decision_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forge_award_tiers"
    ADD CONSTRAINT "forge_award_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forge_award_totals"
    ADD CONSTRAINT "forge_award_totals_pkey" PRIMARY KEY ("user_id", "award_tier");



ALTER TABLE ONLY "public"."forge_awards"
    ADD CONSTRAINT "forge_awards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forge_mark_balances"
    ADD CONSTRAINT "forge_mark_balances_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."forge_mark_ledger"
    ADD CONSTRAINT "forge_mark_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."founders_thought_likes"
    ADD CONSTRAINT "founders_thought_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."founders_thought_likes"
    ADD CONSTRAINT "founders_thought_likes_unique" UNIQUE ("thought_id", "user_id");



ALTER TABLE ONLY "public"."founders_thoughts"
    ADD CONSTRAINT "founders_thoughts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."founders_thoughts"
    ADD CONSTRAINT "founders_thoughts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."idea_tags"
    ADD CONSTRAINT "idea_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."idea_tags"
    ADD CONSTRAINT "idea_tags_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ideas"
    ADD CONSTRAINT "ideas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mfa_recovery_codes"
    ADD CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."official_videos"
    ADD CONSTRAINT "official_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_content"
    ADD CONSTRAINT "page_content_pkey" PRIMARY KEY ("page_key");



ALTER TABLE ONLY "public"."platform_suggestions"
    ADD CONSTRAINT "platform_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."project_contributions"
    ADD CONSTRAINT "project_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."role_change_log"
    ADD CONSTRAINT "role_change_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_claims"
    ADD CONSTRAINT "task_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("task_id", "blocks_on_task_id");



ALTER TABLE ONLY "public"."task_restriction_events"
    ADD CONSTRAINT "task_restriction_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_scope_requests"
    ADD CONSTRAINT "task_scope_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id", "badge_key");



ALTER TABLE ONLY "public"."user_task_restrictions"
    ADD CONSTRAINT "user_task_restrictions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."username_history"
    ADD CONSTRAINT "username_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."volunteer_applications"
    ADD CONSTRAINT "volunteer_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idea_tags_name_lower_idx" ON "public"."idea_tags" USING "btree" ("lower"("name"));



CREATE INDEX "idea_tags_status_idx" ON "public"."idea_tags" USING "btree" ("status");



CREATE INDEX "idea_tags_usage_idx" ON "public"."idea_tags" USING "btree" ("usage_count" DESC);



CREATE INDEX "idx_abuse_flags_created" ON "public"."abuse_flags" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_abuse_flags_user" ON "public"."abuse_flags" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_action_rate_actor_action_created" ON "public"."action_rate_events" USING "btree" ("actor_key", "action", "created_at" DESC);



CREATE INDEX "idx_activity_created" ON "public"."activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_project" ON "public"."activity_log" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "idx_ai_generation_log_created" ON "public"."ai_generation_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_generation_log_status_created" ON "public"."ai_generation_log" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_ai_generation_log_user_created" ON "public"."ai_generation_log" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_ai_token_ledger_idempotency" ON "public"."ai_token_ledger" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_ai_token_ledger_session" ON "public"."ai_token_ledger" USING "btree" ("stripe_session_id") WHERE ("stripe_session_id" IS NOT NULL);



CREATE INDEX "idx_ai_token_ledger_type_created" ON "public"."ai_token_ledger" USING "btree" ("entry_type", "created_at" DESC);



CREATE INDEX "idx_ai_token_ledger_user_created" ON "public"."ai_token_ledger" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_ai_token_purchases_pi" ON "public"."ai_token_purchases" USING "btree" ("stripe_payment_intent") WHERE ("stripe_payment_intent" IS NOT NULL);



CREATE UNIQUE INDEX "idx_ai_token_purchases_session" ON "public"."ai_token_purchases" USING "btree" ("stripe_session_id") WHERE ("stripe_session_id" IS NOT NULL);



CREATE INDEX "idx_ai_token_purchases_user_created" ON "public"."ai_token_purchases" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_bug_reports_reporter" ON "public"."bug_reports" USING "btree" ("reporter_id");



CREATE INDEX "idx_bug_reports_severity" ON "public"."bug_reports" USING "btree" ("severity", "created_at" DESC);



CREATE INDEX "idx_bug_reports_status" ON "public"."bug_reports" USING "btree" ("status", "created_at" DESC);



CREATE UNIQUE INDEX "idx_claim_join_one_pending" ON "public"."claim_join_requests" USING "btree" ("claim_id", "requester_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_claim_join_requester" ON "public"."claim_join_requests" USING "btree" ("requester_id");



CREATE INDEX "idx_claim_join_task" ON "public"."claim_join_requests" USING "btree" ("task_id");



CREATE INDEX "idx_comments_idea_id" ON "public"."comments" USING "btree" ("idea_id");



CREATE INDEX "idx_comments_parent_id" ON "public"."comments" USING "btree" ("parent_id");



CREATE INDEX "idx_comments_user_id" ON "public"."comments" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_concern_reports_created" ON "public"."concern_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_content_reports_status" ON "public"."content_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_content_reports_target" ON "public"."content_reports" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_decision_logs_public" ON "public"."decision_logs" USING "btree" ("logged_on" DESC, "created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "idx_decision_logs_staff" ON "public"."decision_logs" USING "btree" ("archived_at" NULLS FIRST, "logged_on" DESC);



CREATE INDEX "idx_donations_fund_created" ON "public"."donations" USING "btree" ("fund_type", "created_at" DESC);



CREATE INDEX "idx_donations_payment_kind" ON "public"."donations" USING "btree" ("payment_kind", "created_at" DESC);



CREATE INDEX "idx_donations_project" ON "public"."donations" USING "btree" ("project_id") WHERE ("project_id" IS NOT NULL);



CREATE INDEX "idx_donations_project_created" ON "public"."donations" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "idx_donations_status" ON "public"."donations" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_donations_stripe_payment_intent" ON "public"."donations" USING "btree" ("stripe_payment_intent") WHERE ("stripe_payment_intent" IS NOT NULL);



CREATE UNIQUE INDEX "idx_donations_stripe_session" ON "public"."donations" USING "btree" ("stripe_session_id") WHERE ("stripe_session_id" IS NOT NULL);



CREATE INDEX "idx_donations_user_created" ON "public"."donations" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_forge_awards_giver_created" ON "public"."forge_awards" USING "btree" ("giver_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_forge_awards_giver_tier_target" ON "public"."forge_awards" USING "btree" ("giver_id", "award_tier", "target_type", "target_id") WHERE ("target_id" IS NOT NULL);



CREATE INDEX "idx_forge_awards_receiver_created" ON "public"."forge_awards" USING "btree" ("receiver_id", "created_at" DESC);



CREATE INDEX "idx_forge_awards_target" ON "public"."forge_awards" USING "btree" ("target_type", "target_id") WHERE ("target_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_forge_mark_ledger_donation_clawback" ON "public"."forge_mark_ledger" USING "btree" ("donation_id") WHERE (("entry_type" = 'refund_clawback'::"text") AND ("donation_id" IS NOT NULL));



CREATE UNIQUE INDEX "idx_forge_mark_ledger_donation_grant" ON "public"."forge_mark_ledger" USING "btree" ("donation_id") WHERE (("entry_type" = 'donation_grant'::"text") AND ("donation_id" IS NOT NULL));



CREATE UNIQUE INDEX "idx_forge_mark_ledger_idempotency" ON "public"."forge_mark_ledger" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_forge_mark_ledger_user_created" ON "public"."forge_mark_ledger" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_founders_thought_likes_thought" ON "public"."founders_thought_likes" USING "btree" ("thought_id");



CREATE INDEX "idx_founders_thought_likes_user" ON "public"."founders_thought_likes" USING "btree" ("user_id");



CREATE INDEX "idx_founders_thoughts_published" ON "public"."founders_thoughts" USING "btree" ("published_at" DESC NULLS LAST);



CREATE INDEX "idx_ideas_guided_data" ON "public"."ideas" USING "gin" ("guided_data");



CREATE INDEX "idx_ideas_parent_idea_id" ON "public"."ideas" USING "btree" ("parent_idea_id") WHERE ("parent_idea_id" IS NOT NULL);



CREATE INDEX "idx_ideas_project_id" ON "public"."ideas" USING "btree" ("project_id");



CREATE UNIQUE INDEX "idx_ideas_public_id" ON "public"."ideas" USING "btree" ("public_id");



CREATE INDEX "idx_ideas_status" ON "public"."ideas" USING "btree" ("status");



CREATE INDEX "idx_ideas_user_id" ON "public"."ideas" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_mfa_recovery_codes_user" ON "public"."mfa_recovery_codes" USING "btree" ("user_id") WHERE ("used_at" IS NULL);



CREATE INDEX "idx_official_videos_public_list" ON "public"."official_videos" USING "btree" ("published_at" DESC, "sort_order") WHERE (("is_published" = true) AND ("archived_at" IS NULL));



CREATE INDEX "idx_official_videos_staff_list" ON "public"."official_videos" USING "btree" ("archived_at" NULLS FIRST, "published_at" DESC);



CREATE UNIQUE INDEX "idx_one_open_claim_per_task" ON "public"."task_claims" USING "btree" ("task_id") WHERE ("status" = ANY (ARRAY['Active'::"text", 'PendingReview'::"text"]));



CREATE INDEX "idx_platform_suggestions_public" ON "public"."platform_suggestions" USING "btree" ("is_hidden", "status", "created_at" DESC);



CREATE INDEX "idx_platform_suggestions_user" ON "public"."platform_suggestions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_profiles_one_founder" ON "public"."profiles" USING "btree" ("role") WHERE ("role" = 'founder'::"text");



CREATE INDEX "idx_profiles_pinned_badge" ON "public"."profiles" USING "btree" ("pinned_badge_key") WHERE ("pinned_badge_key" IS NOT NULL);



CREATE UNIQUE INDEX "idx_profiles_username_lower" ON "public"."profiles" USING "btree" ("lower"("username"));



CREATE INDEX "idx_project_contributions_project" ON "public"."project_contributions" USING "btree" ("project_id", "category", "sort_order");



CREATE UNIQUE INDEX "idx_project_contributions_source_key" ON "public"."project_contributions" USING "btree" ("source_key") WHERE ("source_key" IS NOT NULL);



CREATE INDEX "idx_project_contributions_user" ON "public"."project_contributions" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_projects_completed_at" ON "public"."projects" USING "btree" ("completed_at" DESC NULLS LAST);



CREATE INDEX "idx_projects_phase_status" ON "public"."projects" USING "btree" ("phase", "status");



CREATE INDEX "idx_projects_slug" ON "public"."projects" USING "btree" ("slug");



CREATE INDEX "idx_role_change_log_created" ON "public"."role_change_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_role_change_log_user" ON "public"."role_change_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_showcase_content_type" ON "public"."community_showcase_posts" USING "btree" ("content_type") WHERE ("status" = 'approved'::"text");



CREATE INDEX "idx_showcase_likes_post" ON "public"."community_showcase_likes" USING "btree" ("post_id");



CREATE INDEX "idx_showcase_likes_user" ON "public"."community_showcase_likes" USING "btree" ("user_id");



CREATE INDEX "idx_showcase_moderation_queue" ON "public"."community_showcase_posts" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_showcase_project_tag" ON "public"."community_showcase_posts" USING "btree" ("project_tag") WHERE (("status" = 'approved'::"text") AND ("project_tag" IS NOT NULL));



CREATE INDEX "idx_showcase_public_feed" ON "public"."community_showcase_posts" USING "btree" ("is_featured" DESC, "published_at" DESC NULLS LAST, "created_at" DESC) WHERE ("status" = 'approved'::"text");



CREATE INDEX "idx_stripe_subscriptions_customer" ON "public"."stripe_subscriptions" USING "btree" ("customer_id");



CREATE INDEX "idx_stripe_subscriptions_status" ON "public"."stripe_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_stripe_subscriptions_user" ON "public"."stripe_subscriptions" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_task_claims_status" ON "public"."task_claims" USING "btree" ("status");



CREATE INDEX "idx_task_claims_task" ON "public"."task_claims" USING "btree" ("task_id");



CREATE INDEX "idx_task_claims_user" ON "public"."task_claims" USING "btree" ("user_id");



CREATE INDEX "idx_task_dependencies_blocker" ON "public"."task_dependencies" USING "btree" ("blocks_on_task_id");



CREATE INDEX "idx_task_dependencies_task" ON "public"."task_dependencies" USING "btree" ("task_id");



CREATE INDEX "idx_task_restriction_events_created" ON "public"."task_restriction_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_task_restriction_events_user" ON "public"."task_restriction_events" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_task_scope_one_pending_claim" ON "public"."task_scope_requests" USING "btree" ("claim_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_task_scope_project_pending" ON "public"."task_scope_requests" USING "btree" ("project_id", "status", "created_at" DESC);



CREATE INDEX "idx_task_scope_task" ON "public"."task_scope_requests" USING "btree" ("task_id");



CREATE INDEX "idx_tasks_parent" ON "public"."tasks" USING "btree" ("parent_task_id");



CREATE INDEX "idx_tasks_project" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "idx_tasks_project_parent" ON "public"."tasks" USING "btree" ("project_id", "parent_task_id");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_user_badges_user" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "idx_volunteer_applications_created" ON "public"."volunteer_applications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_volunteer_applications_status" ON "public"."volunteer_applications" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_votes_idea_id" ON "public"."votes" USING "btree" ("idea_id");



CREATE UNIQUE INDEX "idx_votes_idea_user" ON "public"."votes" USING "btree" ("idea_id", "user_id");



CREATE INDEX "idx_votes_user_id" ON "public"."votes" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "idea_tags_set_updated_at" BEFORE UPDATE ON "public"."idea_tags" FOR EACH ROW EXECUTE FUNCTION "public"."set_idea_tags_updated_at"();



CREATE OR REPLACE TRIGGER "ideas_parent_one_level" BEFORE INSERT OR UPDATE OF "parent_idea_id" ON "public"."ideas" FOR EACH ROW EXECUTE FUNCTION "public"."ideas_enforce_parent_one_level"();



CREATE OR REPLACE TRIGGER "trg_ai_token_ledger_no_update" BEFORE DELETE OR UPDATE ON "public"."ai_token_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."ai_token_ledger_immutable"();



CREATE OR REPLACE TRIGGER "trg_bug_reports_updated_at" BEFORE UPDATE ON "public"."bug_reports" FOR EACH ROW EXECUTE FUNCTION "public"."touch_bug_reports_updated_at"();



CREATE OR REPLACE TRIGGER "trg_comments_abuse" BEFORE INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_idea_comment_rules"();



CREATE OR REPLACE TRIGGER "trg_community_showcase_updated_at" BEFORE UPDATE ON "public"."community_showcase_posts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_community_showcase_updated_at"();



CREATE OR REPLACE TRIGGER "trg_concern_report_rate" BEFORE INSERT ON "public"."concern_reports" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_concern_report_rate"();



CREATE OR REPLACE TRIGGER "trg_donation_forge_marks" AFTER INSERT OR UPDATE OF "status", "user_id", "amount_cents", "amount" ON "public"."donations" FOR EACH ROW EXECUTE FUNCTION "public"."trg_donation_forge_marks"();



CREATE OR REPLACE TRIGGER "trg_enforce_task_parent" BEFORE INSERT OR UPDATE OF "parent_task_id", "project_id" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_task_parent"();



CREATE OR REPLACE TRIGGER "trg_forge_mark_ledger_no_update" BEFORE DELETE OR UPDATE ON "public"."forge_mark_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."forge_mark_ledger_immutable"();



CREATE OR REPLACE TRIGGER "trg_founders_thought_likes_refresh" AFTER INSERT OR DELETE ON "public"."founders_thought_likes" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_founders_thought_likes_count"();



CREATE OR REPLACE TRIGGER "trg_grant_game_shipper_on_project" AFTER INSERT OR UPDATE OF "status", "completed_at" ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."trg_grant_game_shipper_on_project"();



CREATE OR REPLACE TRIGGER "trg_ideas_submit_rules" BEFORE INSERT OR UPDATE ON "public"."ideas" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_idea_submit_rules"();



CREATE OR REPLACE TRIGGER "trg_official_videos_updated_at" BEFORE UPDATE ON "public"."official_videos" FOR EACH ROW EXECUTE FUNCTION "public"."touch_official_videos_updated_at"();



CREATE OR REPLACE TRIGGER "trg_platform_suggestions_updated_at" BEFORE UPDATE ON "public"."platform_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_platform_suggestions_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_direct_role_change" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_direct_role_change"();



CREATE OR REPLACE TRIGGER "trg_profiles_signup_burst" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."flag_profile_signup_burst"();



CREATE OR REPLACE TRIGGER "trg_showcase_likes_refresh" AFTER INSERT OR DELETE ON "public"."community_showcase_likes" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_community_showcase_likes_count"();



CREATE OR REPLACE TRIGGER "trg_showcase_submit_rules" BEFORE INSERT ON "public"."community_showcase_posts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_showcase_submit_rules"();



CREATE OR REPLACE TRIGGER "trg_sync_badges_on_award" AFTER INSERT ON "public"."forge_awards" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_badges_on_award"();



CREATE OR REPLACE TRIGGER "trg_sync_badges_on_claim" AFTER INSERT OR UPDATE OF "status", "user_id", "task_id" ON "public"."task_claims" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_badges_on_claim"();



CREATE OR REPLACE TRIGGER "trg_sync_badges_on_comment" AFTER INSERT OR UPDATE OF "content", "user_id", "idea_id" ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_badges_on_comment"();



CREATE OR REPLACE TRIGGER "trg_sync_badges_on_donation" AFTER INSERT OR UPDATE OF "status", "amount_cents", "amount", "user_id" ON "public"."donations" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_badges_on_donation"();



CREATE OR REPLACE TRIGGER "trg_sync_badges_on_idea" AFTER INSERT OR UPDATE OF "status", "user_id", "votes" ON "public"."ideas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_badges_on_idea"();



CREATE OR REPLACE TRIGGER "trg_sync_badges_on_showcase" AFTER INSERT OR UPDATE OF "creator_user_id", "status", "likes" ON "public"."community_showcase_posts" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_badges_on_showcase"();



CREATE OR REPLACE TRIGGER "trg_sync_badges_on_subscription" AFTER INSERT OR UPDATE OF "status", "user_id" ON "public"."stripe_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_badges_on_subscription"();



CREATE OR REPLACE TRIGGER "trg_sync_badges_on_vote" AFTER INSERT ON "public"."votes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_badges_on_vote"();



CREATE OR REPLACE TRIGGER "trg_sync_parent_claim_progress" AFTER INSERT OR DELETE OR UPDATE OF "status", "parent_task_id" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."sync_parent_claim_progress"();



CREATE OR REPLACE TRIGGER "trg_sync_parent_ready_for_review" AFTER INSERT OR DELETE OR UPDATE OF "status", "parent_task_id" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."sync_parent_ready_for_review"();



CREATE OR REPLACE TRIGGER "trg_task_claim_memorial_credit" AFTER INSERT OR UPDATE OF "status" ON "public"."task_claims" FOR EACH ROW EXECUTE FUNCTION "public"."trg_task_claim_memorial_credit"();



CREATE OR REPLACE TRIGGER "trg_task_claims_rate" BEFORE INSERT ON "public"."task_claims" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_task_claim_rate"();



CREATE OR REPLACE TRIGGER "trg_task_dependencies_validate" BEFORE INSERT OR UPDATE ON "public"."task_dependencies" FOR EACH ROW EXECUTE FUNCTION "public"."task_dependencies_validate"();



CREATE OR REPLACE TRIGGER "trg_volunteer_app_rate" BEFORE INSERT ON "public"."volunteer_applications" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_volunteer_app_rate"();



CREATE OR REPLACE TRIGGER "trg_votes_refresh_count" AFTER INSERT OR DELETE ON "public"."votes" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_idea_vote_count"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_generation_log"
    ADD CONSTRAINT "ai_generation_log_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "public"."ai_token_ledger"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_generation_log"
    ADD CONSTRAINT "ai_generation_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_token_balances"
    ADD CONSTRAINT "ai_token_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_token_ledger"
    ADD CONSTRAINT "ai_token_ledger_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."ai_token_purchases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_token_ledger"
    ADD CONSTRAINT "ai_token_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_token_purchases"
    ADD CONSTRAINT "ai_token_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_reports"
    ADD CONSTRAINT "bug_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."claim_join_requests"
    ADD CONSTRAINT "claim_join_requests_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."task_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claim_join_requests"
    ADD CONSTRAINT "claim_join_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claim_join_requests"
    ADD CONSTRAINT "claim_join_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."claim_join_requests"
    ADD CONSTRAINT "claim_join_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."community_showcase_likes"
    ADD CONSTRAINT "community_showcase_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_showcase_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_showcase_likes"
    ADD CONSTRAINT "community_showcase_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_showcase_posts"
    ADD CONSTRAINT "community_showcase_posts_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."community_showcase_posts"
    ADD CONSTRAINT "community_showcase_posts_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."concern_reports"
    ADD CONSTRAINT "concern_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."decision_logs"
    ADD CONSTRAINT "decision_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."decision_logs"
    ADD CONSTRAINT "decision_logs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."forge_award_totals"
    ADD CONSTRAINT "forge_award_totals_award_tier_fkey" FOREIGN KEY ("award_tier") REFERENCES "public"."forge_award_tiers"("id");



ALTER TABLE ONLY "public"."forge_award_totals"
    ADD CONSTRAINT "forge_award_totals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forge_awards"
    ADD CONSTRAINT "forge_awards_award_tier_fkey" FOREIGN KEY ("award_tier") REFERENCES "public"."forge_award_tiers"("id");



ALTER TABLE ONLY "public"."forge_awards"
    ADD CONSTRAINT "forge_awards_giver_id_fkey" FOREIGN KEY ("giver_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."forge_awards"
    ADD CONSTRAINT "forge_awards_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."forge_mark_balances"
    ADD CONSTRAINT "forge_mark_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forge_mark_ledger"
    ADD CONSTRAINT "forge_mark_ledger_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "public"."forge_awards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forge_mark_ledger"
    ADD CONSTRAINT "forge_mark_ledger_donation_fkey" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forge_mark_ledger"
    ADD CONSTRAINT "forge_mark_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."founders_thought_likes"
    ADD CONSTRAINT "founders_thought_likes_thought_id_fkey" FOREIGN KEY ("thought_id") REFERENCES "public"."founders_thoughts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."founders_thought_likes"
    ADD CONSTRAINT "founders_thought_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."idea_tags"
    ADD CONSTRAINT "idea_tags_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."idea_tags"
    ADD CONSTRAINT "idea_tags_suggested_by_fkey" FOREIGN KEY ("suggested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ideas"
    ADD CONSTRAINT "ideas_parent_idea_id_fkey" FOREIGN KEY ("parent_idea_id") REFERENCES "public"."ideas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ideas"
    ADD CONSTRAINT "ideas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."mfa_recovery_codes"
    ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."official_videos"
    ADD CONSTRAINT "official_videos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_suggestions"
    ADD CONSTRAINT "platform_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_contributions"
    ADD CONSTRAINT "project_contributions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_contributions"
    ADD CONSTRAINT "project_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_change_log"
    ADD CONSTRAINT "role_change_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_change_log"
    ADD CONSTRAINT "role_change_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_subscriptions"
    ADD CONSTRAINT "stripe_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_claims"
    ADD CONSTRAINT "task_claims_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_claims"
    ADD CONSTRAINT "task_claims_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_claims"
    ADD CONSTRAINT "task_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_blocks_on_task_id_fkey" FOREIGN KEY ("blocks_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_restriction_events"
    ADD CONSTRAINT "task_restriction_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_restriction_events"
    ADD CONSTRAINT "task_restriction_events_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."task_claims"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_restriction_events"
    ADD CONSTRAINT "task_restriction_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_restriction_events"
    ADD CONSTRAINT "task_restriction_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_scope_requests"
    ADD CONSTRAINT "task_scope_requests_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."task_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_scope_requests"
    ADD CONSTRAINT "task_scope_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_scope_requests"
    ADD CONSTRAINT "task_scope_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_scope_requests"
    ADD CONSTRAINT "task_scope_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_scope_requests"
    ADD CONSTRAINT "task_scope_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_task_restrictions"
    ADD CONSTRAINT "user_task_restrictions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_task_restrictions"
    ADD CONSTRAINT "user_task_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."username_history"
    ADD CONSTRAINT "username_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteer_applications"
    ADD CONSTRAINT "volunteer_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Anyone can read user badges" ON "public"."user_badges" FOR SELECT USING (true);



CREATE POLICY "Anyone can submit concern reports" ON "public"."concern_reports" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("char_length"(TRIM(BOTH FROM "what_happened")) >= 10) AND ("where_happened" = ANY (ARRAY['discord'::"text", 'website'::"text", 'both'::"text"]))));



CREATE POLICY "Anyone can submit volunteer applications" ON "public"."volunteer_applications" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Authenticated can create reports" ON "public"."content_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Authenticated read ai platform enabled flag" ON "public"."ai_platform_config" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert comments" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can insert ideas" ON "public"."ideas" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Authenticated users can insert votes" ON "public"."votes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can like founders thoughts" ON "public"."founders_thought_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can submit bug reports" ON "public"."bug_reports" FOR INSERT TO "authenticated" WITH CHECK ((("reporter_id" = "auth"."uid"()) AND ("length"(TRIM(BOTH FROM "title")) >= 3) AND ("length"(TRIM(BOTH FROM "description")) >= 10)));



CREATE POLICY "Authenticated users can submit showcase posts" ON "public"."community_showcase_posts" FOR INSERT TO "authenticated" WITH CHECK ((("status" = 'pending'::"text") AND ("is_featured" = false) AND ("moderated_by" IS NULL) AND ("moderated_at" IS NULL) AND ("creator_user_id" = "auth"."uid"())));



CREATE POLICY "Claimants can create scope requests" ON "public"."task_scope_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Claimants can update claimed tasks" ON "public"."tasks" FOR UPDATE USING ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."task_claims" "tc"
  WHERE (("tc"."task_id" = "tasks"."id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."status" = 'Active'::"text"))))));



CREATE POLICY "Founders can read role change log" ON "public"."role_change_log" FOR SELECT TO "authenticated" USING ("public"."is_founder"());



CREATE POLICY "Members can claim tasks" ON "public"."task_claims" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Members can insert activity" ON "public"."activity_log" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_project_staff"()));



CREATE POLICY "Owner or staff can resolve join requests" ON "public"."claim_join_requests" FOR UPDATE TO "authenticated" USING (("public"."is_project_staff"() OR (EXISTS ( SELECT 1
   FROM "public"."task_claims" "tc"
  WHERE (("tc"."id" = "claim_join_requests"."claim_id") AND ("tc"."user_id" = "auth"."uid"()) AND ("tc"."status" = 'Active'::"text"))))));



CREATE POLICY "Owners can delete own ideas" ON "public"."ideas" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Owners can update own ideas" ON "public"."ideas" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Owners or staff can delete claims" ON "public"."task_claims" FOR DELETE USING ((("auth"."uid"() = "user_id") OR "public"."is_project_staff"()));



CREATE POLICY "Owners or staff can update claims" ON "public"."task_claims" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR "public"."is_project_staff"()));



CREATE POLICY "Public can read activity_log" ON "public"."activity_log" FOR SELECT USING (true);



CREATE POLICY "Public can read approved showcase posts" ON "public"."community_showcase_posts" FOR SELECT USING (("status" = 'approved'::"text"));



CREATE POLICY "Public can read bug reports" ON "public"."bug_reports" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read comment_likes" ON "public"."comment_likes" FOR SELECT USING (true);



CREATE POLICY "Public can read comments" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Public can read forge award tiers" ON "public"."forge_award_tiers" FOR SELECT USING (true);



CREATE POLICY "Public can read forge award totals" ON "public"."forge_award_totals" FOR SELECT USING (true);



CREATE POLICY "Public can read forge awards" ON "public"."forge_awards" FOR SELECT USING (true);



CREATE POLICY "Public can read founders_thought_likes" ON "public"."founders_thought_likes" FOR SELECT USING (true);



CREATE POLICY "Public can read founders_thoughts" ON "public"."founders_thoughts" FOR SELECT USING (true);



CREATE POLICY "Public can read ideas" ON "public"."ideas" FOR SELECT USING (true);



CREATE POLICY "Public can read join requests" ON "public"."claim_join_requests" FOR SELECT USING (true);



CREATE POLICY "Public can read page_content" ON "public"."page_content" FOR SELECT USING (true);



CREATE POLICY "Public can read project contributions" ON "public"."project_contributions" FOR SELECT USING (("archived_at" IS NULL));



CREATE POLICY "Public can read projects" ON "public"."projects" FOR SELECT USING (true);



CREATE POLICY "Public can read published official videos" ON "public"."official_videos" FOR SELECT USING ((("is_published" = true) AND ("archived_at" IS NULL)));



CREATE POLICY "Public can read scope requests" ON "public"."task_scope_requests" FOR SELECT USING (true);



CREATE POLICY "Public can read task_claims" ON "public"."task_claims" FOR SELECT USING (true);



CREATE POLICY "Public can read task_dependencies" ON "public"."task_dependencies" FOR SELECT USING (true);



CREATE POLICY "Public can read tasks" ON "public"."tasks" FOR SELECT USING (true);



CREATE POLICY "Public can read usernames" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public read active decision logs" ON "public"."decision_logs" FOR SELECT TO "authenticated", "anon" USING (("archived_at" IS NULL));



CREATE POLICY "Requester can cancel own request" ON "public"."claim_join_requests" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "requester_id")) WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Requester can cancel own scope request" ON "public"."task_scope_requests" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "requester_id")) WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Staff can delete any idea" ON "public"."ideas" FOR DELETE TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "Staff can delete bug reports" ON "public"."bug_reports" FOR DELETE TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "Staff can delete official videos" ON "public"."official_videos" FOR DELETE TO "authenticated" USING ("public"."is_project_staff"());



CREATE POLICY "Staff can delete project contributions" ON "public"."project_contributions" FOR DELETE TO "authenticated" USING ("public"."is_project_staff"());



CREATE POLICY "Staff can delete projects" ON "public"."projects" FOR DELETE USING ("public"."is_project_staff"());



CREATE POLICY "Staff can delete showcase posts" ON "public"."community_showcase_posts" FOR DELETE TO "authenticated" USING ("public"."is_project_staff"());



CREATE POLICY "Staff can delete task_dependencies" ON "public"."task_dependencies" FOR DELETE USING ("public"."is_project_staff"());



CREATE POLICY "Staff can delete tasks" ON "public"."tasks" FOR DELETE USING ("public"."is_project_staff"());



CREATE POLICY "Staff can insert official videos" ON "public"."official_videos" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_project_staff"());



CREATE POLICY "Staff can insert project contributions" ON "public"."project_contributions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_project_staff"());



CREATE POLICY "Staff can insert projects" ON "public"."projects" FOR INSERT WITH CHECK ("public"."is_project_staff"());



CREATE POLICY "Staff can insert task_dependencies" ON "public"."task_dependencies" FOR INSERT WITH CHECK ("public"."is_project_staff"());



CREATE POLICY "Staff can insert tasks" ON "public"."tasks" FOR INSERT WITH CHECK ("public"."is_project_staff"());



CREATE POLICY "Staff can moderate profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "Staff can read all official videos" ON "public"."official_videos" FOR SELECT TO "authenticated" USING ("public"."is_project_staff"());



CREATE POLICY "Staff can read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."is_staff"() OR ("auth"."uid"() = "id")));



CREATE POLICY "Staff can read all project contributions" ON "public"."project_contributions" FOR SELECT TO "authenticated" USING ("public"."is_project_staff"());



CREATE POLICY "Staff can read all showcase posts" ON "public"."community_showcase_posts" FOR SELECT TO "authenticated" USING ("public"."is_project_staff"());



CREATE POLICY "Staff can read concern reports" ON "public"."concern_reports" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "Staff can read reports" ON "public"."content_reports" FOR SELECT TO "authenticated" USING (("public"."is_staff"() OR ("auth"."uid"() = "reporter_id")));



CREATE POLICY "Staff can resolve scope requests" ON "public"."task_scope_requests" FOR UPDATE TO "authenticated" USING ("public"."is_project_staff"());



CREATE POLICY "Staff can update any idea" ON "public"."ideas" FOR UPDATE TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "Staff can update bug reports" ON "public"."bug_reports" FOR UPDATE TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "Staff can update concern reports" ON "public"."concern_reports" FOR UPDATE TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "Staff can update official videos" ON "public"."official_videos" FOR UPDATE TO "authenticated" USING ("public"."is_project_staff"()) WITH CHECK ("public"."is_project_staff"());



CREATE POLICY "Staff can update project contributions" ON "public"."project_contributions" FOR UPDATE TO "authenticated" USING ("public"."is_project_staff"());



CREATE POLICY "Staff can update projects" ON "public"."projects" FOR UPDATE USING ("public"."is_project_staff"());



CREATE POLICY "Staff can update reports" ON "public"."content_reports" FOR UPDATE TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "Staff can update showcase posts" ON "public"."community_showcase_posts" FOR UPDATE TO "authenticated" USING ("public"."is_project_staff"()) WITH CHECK ("public"."is_project_staff"());



CREATE POLICY "Staff can update task_dependencies" ON "public"."task_dependencies" FOR UPDATE USING ("public"."is_project_staff"());



CREATE POLICY "Staff can update tasks" ON "public"."tasks" FOR UPDATE USING ("public"."is_project_staff"());



CREATE POLICY "Staff can upsert page_content" ON "public"."page_content" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['moderator'::"text", 'admin'::"text", 'project_lead'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['moderator'::"text", 'admin'::"text", 'project_lead'::"text"]))))));



CREATE POLICY "Staff insert restriction events" ON "public"."task_restriction_events" FOR INSERT WITH CHECK ("public"."is_project_staff"());



CREATE POLICY "Staff manage task restrictions" ON "public"."user_task_restrictions" USING ("public"."is_project_staff"()) WITH CHECK ("public"."is_project_staff"());



CREATE POLICY "Staff read abuse flags" ON "public"."abuse_flags" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "Staff read all decision logs" ON "public"."decision_logs" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "Staff read rate events" ON "public"."action_rate_events" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "Staff write decision logs" ON "public"."decision_logs" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "Users can delete own votes" ON "public"."votes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own username history" ON "public"."username_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can like showcase posts" ON "public"."community_showcase_likes" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."community_showcase_posts" "p"
  WHERE (("p"."id" = "community_showcase_likes"."post_id") AND ("p"."status" = 'approved'::"text"))))));



CREATE POLICY "Users can read own donations" ON "public"."donations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own forge mark balance" ON "public"."forge_mark_balances" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own forge mark ledger" ON "public"."forge_mark_ledger" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own showcase submissions" ON "public"."community_showcase_posts" FOR SELECT TO "authenticated" USING (("creator_user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own username history" ON "public"."username_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove own founders thought likes" ON "public"."founders_thought_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove own showcase likes" ON "public"."community_showcase_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can request to join" ON "public"."claim_join_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "requester_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users manage own comment likes" ON "public"."comment_likes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own ai token balance" ON "public"."ai_token_balances" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own ai token purchases" ON "public"."ai_token_purchases" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own restriction events" ON "public"."task_restriction_events" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_project_staff"()));



CREATE POLICY "Users read own showcase likes" ON "public"."community_showcase_likes" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."user_bypasses_abuse_limits"()));



CREATE POLICY "Users read own task restrictions" ON "public"."user_task_restrictions" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_project_staff"()));



CREATE POLICY "Users read own volunteer applications" ON "public"."volunteer_applications" FOR SELECT TO "authenticated" USING ((("user_id" IS NOT NULL) AND ("auth"."uid"() = "user_id")));



CREATE POLICY "Users read own votes" ON "public"."votes" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."user_bypasses_abuse_limits"()));



ALTER TABLE "public"."abuse_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."action_rate_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_generation_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_platform_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_token_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_token_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_token_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bug_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claim_join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_showcase_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_showcase_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."concern_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."decision_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."donations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forge_award_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forge_award_totals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forge_awards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forge_mark_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forge_mark_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."founders_thought_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."founders_thoughts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."idea_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "idea_tags_delete_staff" ON "public"."idea_tags" FOR DELETE TO "authenticated" USING (("public"."is_idea_tag_admin"() OR "public"."is_idea_tag_staff"()));



CREATE POLICY "idea_tags_insert_suggested" ON "public"."idea_tags" FOR INSERT TO "authenticated" WITH CHECK ((("status" = 'suggested'::"text") AND (("suggested_by" IS NULL) OR ("suggested_by" = "auth"."uid"()))));



CREATE POLICY "idea_tags_select_public" ON "public"."idea_tags" FOR SELECT TO "authenticated", "anon" USING (("public"."idea_tag_is_publicly_selectable"("status", "usage_count") OR "public"."is_idea_tag_staff"() OR (("suggested_by" IS NOT NULL) AND ("suggested_by" = "auth"."uid"()))));



CREATE POLICY "idea_tags_update_staff" ON "public"."idea_tags" FOR UPDATE TO "authenticated" USING ("public"."is_idea_tag_staff"()) WITH CHECK ("public"."is_idea_tag_staff"());



ALTER TABLE "public"."ideas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mfa_recovery_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."official_videos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_suggestions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_suggestions_insert" ON "public"."platform_suggestions" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND ("status" = 'Open'::"text") AND ("is_hidden" = false)));



CREATE POLICY "platform_suggestions_select" ON "public"."platform_suggestions" FOR SELECT TO "authenticated", "anon" USING ((("is_hidden" = false) OR "public"."is_staff"()));



CREATE POLICY "platform_suggestions_update_staff" ON "public"."platform_suggestions" FOR UPDATE TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_contributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_change_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stripe_subscriptions_select_own" ON "public"."stripe_subscriptions" FOR SELECT TO "authenticated" USING ((("user_id" IS NOT NULL) AND ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_restriction_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_scope_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_task_restrictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."username_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."volunteer_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."votes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."idea_tags" TO "anon";
GRANT ALL ON TABLE "public"."idea_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."idea_tags" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_approve_idea_tag"("p_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_delete_idea_tag"("p_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_hide_idea_tag"("p_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_merge_idea_tags"("p_source_id" "uuid", "p_target_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_rename_idea_tag"("p_id" "uuid", "p_new_name" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_unhide_idea_tag"("p_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."apply_claim_restriction"("p_user_id" "uuid", "p_actor_id" "uuid", "p_reason" "text", "p_task_id" "uuid", "p_claim_id" "uuid", "p_increment_fake" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."assert_action_allowed"("p_action" "text", "p_limit" integer, "p_window" interval, "p_min_gap" interval, "p_actor_key" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."backfill_all_user_badges"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_idea_tag_usage"("p_names" "text"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."cancel_task_scope_request"("p_request_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."claim_task"("p_task_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."clawback_forge_marks_for_donation"("p_donation_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clawback_forge_marks_for_donation"("p_donation_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_task"("p_task_id" "uuid") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_ledger" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_ledger" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_ledger" TO "service_role";



REVOKE ALL ON FUNCTION "public"."credit_ai_tokens"("p_user_id" "uuid", "p_tokens" integer, "p_entry_type" "text", "p_status" "text", "p_prompt_summary" "text", "p_pack_id" "text", "p_purchase_id" "uuid", "p_source" "text", "p_source_ref" "text", "p_stripe_session_id" "text", "p_stripe_payment_intent" "text", "p_idempotency_key" "text", "p_meta" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."credit_ai_tokens"("p_user_id" "uuid", "p_tokens" integer, "p_entry_type" "text", "p_status" "text", "p_prompt_summary" "text", "p_pack_id" "text", "p_purchase_id" "uuid", "p_source" "text", "p_source_ref" "text", "p_stripe_session_id" "text", "p_stripe_payment_intent" "text", "p_idempotency_key" "text", "p_meta" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."debug_auth_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."debug_auth_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_auth_context"() TO "anon";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_balances" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_balances" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."ai_token_balances" TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_ai_token_balance"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_ai_token_balance"("p_user_id" "uuid") TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_mark_balances" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_mark_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."forge_mark_balances" TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_forge_mark_balance"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_forge_mark_balance"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_idea_tag"("p_name" "text", "p_as_curated" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."ensure_project_contribution"("p_project_id" "uuid", "p_user_id" "uuid", "p_display_name" "text", "p_category" "text", "p_subcategory" "text", "p_role_label" "text", "p_source_key" "text", "p_project_title" "text", "p_username" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_project_contribution"("p_project_id" "uuid", "p_user_id" "uuid", "p_display_name" "text", "p_category" "text", "p_subcategory" "text", "p_role_label" "text", "p_source_key" "text", "p_project_title" "text", "p_username" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_project_contribution"("p_project_id" "uuid", "p_user_id" "uuid", "p_display_name" "text", "p_category" "text", "p_subcategory" "text", "p_role_label" "text", "p_source_key" "text", "p_project_title" "text", "p_username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."evidence_has_url"("p_evidence" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."evidence_has_url"("p_evidence" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."get_active_project_id_for_donations"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_active_project_id_for_donations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_project_id_for_donations"() TO "anon";



REVOKE ALL ON FUNCTION "public"."get_ai_service_availability"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_ai_service_availability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_service_availability"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_service_availability"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_ai_studio_spend_micros"("p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_ai_studio_spend_micros"("p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_contributor_trust"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_ai_token_balance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_ai_token_balance"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_ai_token_ledger"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_ai_token_ledger"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_ai_token_purchases"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_ai_token_purchases"("p_limit" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_my_billing_history"("limit_n" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_my_claim_quota"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_claim_quota"() TO "anon";



REVOKE ALL ON FUNCTION "public"."get_my_forge_mark_ledger"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_forge_mark_ledger"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_forge_marks"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_forge_marks"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_my_subscription_plan"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_my_subscriptions"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_project_donation_credits"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_donation_credits"("p_project_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_public_community_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_community_stats"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_public_forge_marks_profile"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_forge_marks_profile"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_forge_marks_profile"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_public_fund_contributors"("p_fund_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_fund_contributors"("p_fund_type" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_public_profile_support"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_profile_support"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_public_recent_donations"("limit_n" integer, "p_fund_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_recent_donations"("limit_n" integer, "p_fund_type" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_public_support_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_support_summary"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_public_user_badges"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_user_badges"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_user_badges"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_ai_token_pack_purchase"("p_user_id" "uuid", "p_pack_id" "text", "p_amount_cents" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent" "text", "p_stripe_customer_id" "text", "p_purchase_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_ai_token_pack_purchase"("p_user_id" "uuid", "p_pack_id" "text", "p_amount_cents" integer, "p_stripe_session_id" "text", "p_stripe_payment_intent" "text", "p_stripe_customer_id" "text", "p_purchase_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_forge_marks_from_donation"("p_donation_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_forge_marks_from_donation"("p_donation_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_game_shipper_for_project"("p_project_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."grant_game_shipper_for_project"("p_project_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."idea_cast_vote"("p_idea_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."idea_cast_vote"("p_idea_id" bigint) TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_founder"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_founder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_founder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_project_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_project_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_project_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_forge_awards_for_targets"("p_target_type" "text", "p_target_ids" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_forge_awards_for_targets"("p_target_type" "text", "p_target_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."list_forge_awards_for_targets"("p_target_type" "text", "p_target_ids" "text"[]) TO "authenticated";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ideas" TO "anon";
GRANT ALL ON TABLE "public"."ideas" TO "authenticated";
GRANT ALL ON TABLE "public"."ideas" TO "service_role";



GRANT ALL ON FUNCTION "public"."list_idea_children"("p_parent_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."list_idea_children"("p_parent_id" bigint) TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_restriction_events" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_restriction_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_restriction_events" TO "service_role";



GRANT ALL ON FUNCTION "public"."list_recent_restriction_events"("p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."place_forge_award"("p_tier_id" "text", "p_target_type" "text", "p_target_id" "text", "p_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."place_forge_award"("p_tier_id" "text", "p_target_type" "text", "p_target_id" "text", "p_message" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."recompute_idea_tag_usage"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."reject_task_as_fake_work"("p_task_id" "uuid", "p_feedback" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."request_join_claim"("p_task_id" "uuid", "p_message" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."request_task_scope_help"("p_task_id" "uuid", "p_note" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."request_uid"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_uid"() TO "anon";



GRANT ALL ON FUNCTION "public"."resolve_join_request"("p_request_id" "uuid", "p_approve" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."resolve_task_scope_request"("p_request_id" "uuid", "p_resolution" "text", "p_staff_note" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."return_stale_claims"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."return_stale_claims"("p_days" integer) TO "anon";



GRANT ALL ON FUNCTION "public"."return_task_claim"("p_task_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."review_task_submission"("p_task_id" "uuid", "p_accept" boolean, "p_feedback" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."run_claim_auto_release"("p_idle_days" integer, "p_max_claim_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_claim_auto_release"("p_idle_days" integer, "p_max_claim_days" integer) TO "anon";



GRANT ALL ON FUNCTION "public"."run_claim_auto_release_test"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_my_pinned_badge"("p_badge_key" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_task_dependencies"("p_task_id" "uuid", "p_blocker_ids" "uuid"[], "p_override" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_user_role"("p_user_id" "uuid", "p_new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_role"("p_user_id" "uuid", "p_new_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_task_for_review"("p_task_id" "uuid", "p_evidence" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."sync_idea_tags_after_save"("p_tag_names" "text"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."sync_my_badges"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."sync_user_badges"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_user_badges"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_badges"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."task_child_progress_percent"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."task_child_progress_percent"("p_task_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."task_incomplete_blockers"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."task_incomplete_blockers"("p_task_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."task_is_dependency_locked"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."task_is_dependency_locked"("p_task_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."task_nesting_depth"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."task_nesting_depth"("p_task_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."toggle_idea_vote"("p_idea_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_idea_vote"("p_idea_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."toggle_showcase_like"("p_post_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_showcase_like"("p_post_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."try_debit_ai_tokens"("p_user_id" "uuid", "p_tokens" integer, "p_action_key" "text", "p_prompt_summary" "text", "p_provider" "text", "p_model" "text", "p_api_cost_usd_micros" bigint, "p_margin_usd_micros" bigint, "p_idempotency_key" "text", "p_meta" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."try_debit_ai_tokens"("p_user_id" "uuid", "p_tokens" integer, "p_action_key" "text", "p_prompt_summary" "text", "p_provider" "text", "p_model" "text", "p_api_cost_usd_micros" bigint, "p_margin_usd_micros" bigint, "p_idempotency_key" "text", "p_meta" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."try_debit_ai_tokens_up_to"("p_user_id" "uuid", "p_tokens" integer, "p_action_key" "text", "p_prompt_summary" "text", "p_provider" "text", "p_model" "text", "p_api_cost_usd_micros" bigint, "p_margin_usd_micros" bigint, "p_idempotency_key" "text", "p_meta" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."try_debit_ai_tokens_up_to"("p_user_id" "uuid", "p_tokens" integer, "p_action_key" "text", "p_prompt_summary" "text", "p_provider" "text", "p_model" "text", "p_api_cost_usd_micros" bigint, "p_margin_usd_micros" bigint, "p_idempotency_key" "text", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_task_progress"("p_task_id" "uuid", "p_progress_percent" integer, "p_subtasks" "jsonb", "p_notes" "text", "p_helpers" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."user_accepted_task_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_accepted_task_count"("p_user_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."user_bypasses_abuse_limits"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."user_bypasses_task_limits"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_bypasses_task_limits"("p_user_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."user_claim_limit"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_claim_limit"("p_user_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."user_completed_claim_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_completed_claim_count"("p_user_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."user_identity_gate_status"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_identity_gate_status"("p_user_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."user_is_claim_restricted"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_claim_restricted"("p_user_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."user_meets_identity_gate"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_meets_identity_gate"("p_user_id" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."user_submit_limit_24h"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_submit_limit_24h"("p_user_id" "uuid") TO "anon";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."abuse_flags" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."abuse_flags" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."abuse_flags" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."action_rate_events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."action_rate_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."action_rate_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity_log" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity_log" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity_log" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_generation_log" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_generation_log" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."ai_generation_log" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_platform_config" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_platform_config" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."ai_platform_config" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_ledger_user" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_ledger_user" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_ledger_user" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_purchases" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_token_purchases" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."ai_token_purchases" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bug_reports" TO "anon";
GRANT ALL ON TABLE "public"."bug_reports" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bug_reports" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."claim_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."claim_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."claim_join_requests" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comment_likes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comment_likes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comment_likes" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."comment_likes_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."comment_likes_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."comments_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."comments_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_showcase_likes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_showcase_likes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_showcase_likes" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."community_showcase_posts" TO "anon";
GRANT ALL ON TABLE "public"."community_showcase_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."community_showcase_posts" TO "service_role";



GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."concern_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."concern_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."concern_reports" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."content_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."content_reports" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."content_reports" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."content_reports_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."content_reports_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."decision_logs" TO "anon";
GRANT ALL ON TABLE "public"."decision_logs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."decision_logs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."donations" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."donations" TO "authenticated";
GRANT ALL ON TABLE "public"."donations" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."donations_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."donations_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_award_tiers" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_award_tiers" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_award_tiers" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_award_totals" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_award_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."forge_award_totals" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_awards" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_awards" TO "authenticated";
GRANT ALL ON TABLE "public"."forge_awards" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_mark_ledger" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."forge_mark_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."forge_mark_ledger" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."founders_thought_likes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."founders_thought_likes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."founders_thought_likes" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."founders_thought_likes_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."founders_thought_likes_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."founders_thoughts" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."founders_thoughts" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."founders_thoughts" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."founders_thoughts_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."founders_thoughts_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."idea_tags_public" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."idea_tags_public" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."idea_tags_public" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."ideas_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."ideas_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mfa_recovery_codes" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mfa_recovery_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."mfa_recovery_codes" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."official_videos" TO "anon";
GRANT ALL ON TABLE "public"."official_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."official_videos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."page_content" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."page_content" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."page_content" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_suggestions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."platform_suggestions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_suggestions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."project_contributions" TO "anon";
GRANT ALL ON TABLE "public"."project_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."project_contributions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_change_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_change_log" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_change_log" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."role_change_log_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."role_change_log_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stripe_subscriptions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stripe_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_subscriptions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stripe_webhook_events" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stripe_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_claims" TO "anon";
GRANT ALL ON TABLE "public"."task_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."task_claims" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_dependencies" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_dependencies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_dependencies" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_scope_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."task_scope_requests" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."task_scope_requests" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_badges" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_badges" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_badges" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_task_restrictions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_task_restrictions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_task_restrictions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."username_history" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."username_history" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."username_history" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."username_history_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."username_history_id_seq" TO "service_role";



GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."volunteer_applications" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."volunteer_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."volunteer_applications" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."votes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."votes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."votes" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."votes_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."votes_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";







