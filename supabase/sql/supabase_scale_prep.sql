-- ============================================================================
-- Scale prep for public launch
-- ============================================================================
--   1. Durable rate limiting for Edge Functions (replaces per-instance memory).
--   2. Cheaper traffic heartbeat: every visitor calls it, so the shared
--      per-minute sample row and the presence sweep must not run on every call.
--      Pageview history is kept in full (the Traffic tab has a Lifetime range).
--   3. Index for the newest-first ideas listing.
--
-- Safe to re-run. Run on STAGING first, then production.
-- Requires: supabase_traffic.sql (section 2 is skipped where it is missing).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Durable Edge Function rate limiting
-- ---------------------------------------------------------------------------
-- One row per (bucket, key). Fixed window: the counter restarts when the
-- window has elapsed. Keys are hashed by the caller (no raw IPs stored).
create table if not exists public.edge_rate_limits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 0,
  primary key (bucket, key_hash)
);

comment on table public.edge_rate_limits is
  'Fixed-window counters for Edge Function rate limits. Service role only. key_hash is a SHA-256 of the user id or client IP.';

create index if not exists idx_edge_rate_limits_window
  on public.edge_rate_limits (window_start);

alter table public.edge_rate_limits enable row level security;
revoke all on table public.edge_rate_limits from public, anon, authenticated;
grant all on table public.edge_rate_limits to service_role;

create or replace function public.edge_rate_limit_hit(
  p_bucket text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_limit integer := greatest(coalesce(p_limit, 1), 1);
  v_window interval := make_interval(secs => greatest(coalesce(p_window_seconds, 60), 1));
  v_hits integer;
  v_start timestamptz;
  v_retry integer;
begin
  if coalesce(trim(p_bucket), '') = '' or coalesce(trim(p_key_hash), '') = '' then
    raise exception 'bucket and key are required';
  end if;

  insert into public.edge_rate_limits as r (bucket, key_hash, window_start, hits)
  values (p_bucket, p_key_hash, v_now, 1)
  on conflict (bucket, key_hash) do update set
    hits = case
      when r.window_start + v_window <= v_now then 1
      else r.hits + 1
    end,
    window_start = case
      when r.window_start + v_window <= v_now then v_now
      else r.window_start
    end
  returning r.hits, r.window_start into v_hits, v_start;

  -- Occasional sweep of long-expired rows (about 1 call in 200)
  if random() < 0.005 then
    delete from public.edge_rate_limits
    where window_start < v_now - interval '2 days';
  end if;

  v_retry := greatest(1, ceil(extract(epoch from (v_start + v_window - v_now)))::integer);
  return jsonb_build_object(
    'allowed', v_hits <= v_limit,
    'hits', v_hits,
    'limit', v_limit,
    'remaining', greatest(v_limit - v_hits, 0),
    'retry_after', case when v_hits <= v_limit then 0 else v_retry end
  );
end;
$$;

revoke all on function public.edge_rate_limit_hit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.edge_rate_limit_hit(text, text, integer, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. Cheaper traffic heartbeat
-- ---------------------------------------------------------------------------
-- Before: every heartbeat swept old presence rows, counted everyone active,
-- and upserted the SAME per-minute sample row, so concurrent visitors queued
-- on one row lock. Now only one heartbeat at a time does that shared work
-- (transaction advisory lock, never waits); the rest just record presence.
do $do$
begin
  if to_regclass('public.traffic_presence') is null
     or to_regprocedure('public.sanitize_traffic_path(text)') is null
  then
    raise notice 'traffic tables not found: skipping heartbeat update';
    return;
  end if;

  execute $fn$
    create or replace function public.record_traffic_heartbeat(
      p_session_key text,
      p_path text,
      p_is_pageview boolean default false
    )
    returns json
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      v_session text;
      v_path text;
      v_uid uuid;
      v_visitor text;
      v_signed boolean;
      v_now timestamptz := now();
      v_minute timestamptz;
      v_active int := 0;
      v_signed_n int := 0;
      v_guest_n int := 0;
      v_prev_path text;
      v_prev_seen timestamptz;
    begin
      v_session := trim(coalesce(p_session_key, ''));
      if v_session !~ '^[A-Za-z0-9_-]{16,64}$' then
        return json_build_object('ok', false);
      end if;

      v_path := public.sanitize_traffic_path(p_path);
      v_uid := auth.uid();
      v_signed := v_uid is not null;
      if v_signed then
        v_visitor := 'u:' || v_uid::text;
      else
        v_visitor := 's:' || v_session;
      end if;

      select path, last_seen_at
        into v_prev_path, v_prev_seen
      from public.traffic_presence
      where visitor_key = v_visitor;

      insert into public.traffic_presence (
        visitor_key, session_key, user_id, last_seen_at, path, signed_in
      ) values (
        v_visitor, v_session, v_uid, v_now, v_path, v_signed
      )
      on conflict (visitor_key) do update set
        session_key = excluded.session_key,
        user_id = excluded.user_id,
        last_seen_at = excluded.last_seen_at,
        path = excluded.path,
        signed_in = excluded.signed_in;

      -- Shared bookkeeping: one heartbeat at a time, others skip it.
      if pg_try_advisory_xact_lock(hashtext('tf_traffic_sample')) then
        delete from public.traffic_presence
        where last_seen_at < v_now - interval '5 minutes';

        select
          count(*)::int,
          count(*) filter (where signed_in)::int,
          count(*) filter (where not signed_in)::int
        into v_active, v_signed_n, v_guest_n
        from public.traffic_presence
        where last_seen_at > v_now - interval '60 seconds';

        v_minute := date_trunc('minute', v_now);
        insert into public.traffic_concurrent_samples (
          sampled_at, active_count, signed_in_count, guest_count
        ) values (
          v_minute, v_active, v_signed_n, v_guest_n
        )
        on conflict (sampled_at) do update set
          active_count = greatest(
            public.traffic_concurrent_samples.active_count,
            excluded.active_count
          ),
          signed_in_count = greatest(
            public.traffic_concurrent_samples.signed_in_count,
            excluded.signed_in_count
          ),
          guest_count = greatest(
            public.traffic_concurrent_samples.guest_count,
            excluded.guest_count
          );
      end if;

      if coalesce(p_is_pageview, false)
         and (
           v_prev_path is null
           or v_prev_path is distinct from v_path
           or v_prev_seen is null
           or v_prev_seen < v_now - interval '2 seconds'
         )
      then
        insert into public.traffic_pageviews (
          occurred_at, session_key, signed_in, path
        ) values (
          v_now, v_session, v_signed, v_path
        );
      end if;

      return json_build_object('ok', true);
    end;
    $body$;
  $fn$;

  execute 'revoke all on function public.record_traffic_heartbeat(text, text, boolean) from public';
  execute 'grant execute on function public.record_traffic_heartbeat(text, text, boolean) to anon, authenticated, service_role';
end;
$do$;

-- ---------------------------------------------------------------------------
-- 3. Ideas listing (newest first)
-- ---------------------------------------------------------------------------
create index if not exists idx_ideas_created_at
  on public.ideas (created_at desc);

notify pgrst, 'reload schema';
