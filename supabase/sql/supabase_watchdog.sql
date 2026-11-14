-- =============================================================================
-- Together Forge watchdog: posts to a private Discord channel when something
-- needs fixing now. Runs inside the database every 5 minutes (pg_cron) and
-- sends with pg_net. A daily check-in proves it is still alive.
--
-- It cannot report "the whole database is down" (it runs inside it). Use an
-- external uptime monitor for that.
--
-- Setup per project (the webhook URL lives in Vault, never in this file):
--   select vault.create_secret('<discord webhook url>', 'watchdog_discord_webhook');
--   insert into public.watchdog_settings (id, env_label) values (1, 'PRODUCTION')
--     on conflict (id) do update set env_label = excluded.env_label;
--
-- Test:      select public.watchdog_test();
-- Run now:   select public.watchdog_run();
-- Pause all: update public.watchdog_settings set enabled = false;
--
-- Safe to re-run.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Settings and per-check state (staff never read these from the browser)
-- ---------------------------------------------------------------------------
create table if not exists public.watchdog_settings (
  id smallint primary key default 1 check (id = 1),
  env_label text not null default 'PRODUCTION',
  enabled boolean not null default true,
  -- Thresholds (tune here, no code change needed)
  site_errors_10m integer not null default 25,
  site_error_sessions_10m integer not null default 8,
  db_connection_pct integer not null default 75,
  db_size_mb integer not null default 6000,
  stuck_query_minutes integer not null default 5,
  repeat_minutes integer not null default 60,
  daily_hour_utc integer not null default 16
);

insert into public.watchdog_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.watchdog_state (
  check_key text primary key,
  firing boolean not null default false,
  last_alert_at timestamptz,
  last_detail text,
  updated_at timestamptz not null default now()
);

alter table public.watchdog_settings enable row level security;
alter table public.watchdog_state enable row level security;
revoke all on table public.watchdog_settings from public, anon, authenticated;
revoke all on table public.watchdog_state from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Send one Discord message. Returns false when no webhook is configured.
-- ---------------------------------------------------------------------------
create or replace function public.watchdog_send(p_content text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'watchdog_discord_webhook'
  limit 1;

  if v_url is null or v_url !~ '^https://(discord\.com|discordapp\.com)/api/webhooks/' then
    raise warning 'watchdog: no Discord webhook in vault (watchdog_discord_webhook)';
    return false;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'username', 'Together Forge Watchdog',
      'content', left(p_content, 1900),
      'allowed_mentions', jsonb_build_object('parse', jsonb_build_array())
    ),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Record a check result; alert on start, repeat while firing, note recovery.
-- ---------------------------------------------------------------------------
create or replace function public.watchdog_apply(
  p_key text,
  p_firing boolean,
  p_title text,
  p_detail text,
  p_fix text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.watchdog_settings%rowtype;
  st public.watchdog_state%rowtype;
  v_now timestamptz := now();
begin
  select * into s from public.watchdog_settings where id = 1;
  select * into st from public.watchdog_state where check_key = p_key;

  if p_firing then
    if not coalesce(st.firing, false)
       or st.last_alert_at is null
       or st.last_alert_at < v_now - make_interval(mins => s.repeat_minutes) then
      perform public.watchdog_send(
        format(
          E'🚨 **[%s] %s**%s\n%s\n**What to do:** %s',
          s.env_label,
          p_title,
          case when coalesce(st.firing, false) then ' (still happening)' else '' end,
          p_detail,
          p_fix
        )
      );
      st.last_alert_at := v_now;
    end if;
  elsif coalesce(st.firing, false) then
    perform public.watchdog_send(
      format(E'✅ **[%s] Resolved:** %s', s.env_label, p_title)
    );
  end if;

  insert into public.watchdog_state (check_key, firing, last_alert_at, last_detail, updated_at)
  values (p_key, p_firing, st.last_alert_at, left(p_detail, 500), v_now)
  on conflict (check_key) do update
    set firing = excluded.firing,
        last_alert_at = excluded.last_alert_at,
        last_detail = excluded.last_detail,
        updated_at = excluded.updated_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- The checks
-- ---------------------------------------------------------------------------
create or replace function public.watchdog_run()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.watchdog_settings%rowtype;
  v_out jsonb := '{}'::jsonb;
  v_n integer;
  v_m integer;
  v_text text;
  v_max integer;
  v_size_mb integer;
begin
  select * into s from public.watchdog_settings where id = 1;
  if s.id is null or not s.enabled then
    return jsonb_build_object('skipped', 'disabled');
  end if;

  -- 1. Site errors spiking (a bad deploy or a broken page)
  begin
    select count(*), count(distinct session_key)
      into v_n, v_m
    from public.client_error_log
    where occurred_at > now() - interval '10 minutes'
      and kind <> 'auth_email';

    select message into v_text
    from public.client_error_log
    where occurred_at > now() - interval '10 minutes'
      and kind <> 'auth_email'
    group by message
    order by count(*) desc
    limit 1;

    perform public.watchdog_apply(
      'site_errors',
      v_n >= s.site_errors_10m or v_m >= s.site_error_sessions_10m,
      'Site errors are spiking',
      format('%s errors from %s visits in the last 10 minutes. Most common: %s',
             v_n, v_m, coalesce(left(v_text, 300), 'n/a')),
      'Open Moderator → Site errors. If it started with a deploy, roll back in Vercel → Deployments → Promote the previous one.'
    );
    v_out := v_out || jsonb_build_object('site_errors_10m', v_n, 'error_sessions_10m', v_m);
  exception when undefined_table then
    v_out := v_out || jsonb_build_object('site_errors', 'client_error_log missing');
  end;

  -- 2. Auth emails failing (sign-up confirmations, password resets)
  begin
    select count(*), max(message)
      into v_n, v_text
    from public.client_error_log
    where occurred_at > now() - interval '15 minutes'
      and kind = 'auth_email';

    perform public.watchdog_apply(
      'auth_email',
      v_n >= 1,
      'Sign-up / password emails are failing',
      format('%s failure(s) in the last 15 minutes. Latest: %s', v_n, coalesce(v_text, 'n/a')),
      'New members cannot confirm their accounts. Check Resend (plan limit / domain) and Supabase → Authentication → Rate Limits → email sending.'
    );
    v_out := v_out || jsonb_build_object('auth_email_15m', v_n);
  exception when undefined_table then
    null;
  end;

  -- 3. Database connections close to the limit
  v_max := current_setting('max_connections')::integer;
  select count(*) into v_n from pg_stat_activity;
  perform public.watchdog_apply(
    'db_connections',
    v_n * 100 >= v_max * s.db_connection_pct,
    'Database connections are nearly full',
    format('%s of %s connections in use (%s%%).', v_n, v_max, round(v_n * 100.0 / v_max)),
    'Requests will start failing at 100%. Check Supabase → Reports → Database. A bigger compute size raises the limit.'
  );
  v_out := v_out || jsonb_build_object('connections', v_n, 'max_connections', v_max);

  -- 4. Queries stuck for minutes (locks, runaway queries)
  select count(*), max(left(regexp_replace(query, '\s+', ' ', 'g'), 200))
    into v_n, v_text
  from pg_stat_activity
  where state = 'active'
    and pid <> pg_backend_pid()
    and backend_type = 'client backend'
    and query_start < now() - make_interval(mins => s.stuck_query_minutes)
    and query not ilike '%pg_stat_activity%';
  perform public.watchdog_apply(
    'stuck_queries',
    v_n > 0,
    'Database queries are stuck',
    format('%s quer%s running longer than %s minutes. Example: %s',
           v_n, case when v_n = 1 then 'y' else 'ies' end, s.stuck_query_minutes,
           coalesce(v_text, 'n/a')),
    'Pages may hang. Check Supabase → Reports → Query performance; cancel the query from the SQL editor if needed.'
  );
  v_out := v_out || jsonb_build_object('stuck_queries', v_n);

  -- 5. Database size
  v_size_mb := (pg_database_size(current_database()) / 1024 / 1024)::integer;
  perform public.watchdog_apply(
    'db_size',
    v_size_mb >= s.db_size_mb,
    'Database is getting large',
    format('Database is %s MB (alert threshold %s MB).', v_size_mb, s.db_size_mb),
    'Check Supabase → Settings → Usage for disk limits and what is growing.'
  );
  v_out := v_out || jsonb_build_object('db_size_mb', v_size_mb);

  -- 6. Scheduled jobs failing (any pg_cron job other than this one)
  begin
    select count(*), max(left(d.return_message, 200))
      into v_n, v_text
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where d.status = 'failed'
      and d.start_time > now() - interval '15 minutes'
      and j.jobname not like 'tf-watchdog%';
    perform public.watchdog_apply(
      'cron_failures',
      v_n > 0,
      'Scheduled database jobs are failing',
      format('%s failed run(s) in the last 15 minutes. Latest: %s', v_n, coalesce(v_text, 'n/a')),
      'Check cron.job_run_details in the Supabase SQL editor.'
    );
    v_out := v_out || jsonb_build_object('cron_failures_15m', v_n);
  exception when undefined_table then
    null;
  end;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily check-in: proves the watchdog is alive and gives a quick pulse.
-- ---------------------------------------------------------------------------
create or replace function public.watchdog_daily()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.watchdog_settings%rowtype;
  v_errors integer := 0;
  v_email integer := 0;
  v_signups integer := 0;
  v_firing text;
begin
  select * into s from public.watchdog_settings where id = 1;
  if s.id is null or not s.enabled then
    return;
  end if;

  begin
    select count(*) filter (where kind <> 'auth_email'),
           count(*) filter (where kind = 'auth_email')
      into v_errors, v_email
    from public.client_error_log
    where occurred_at > now() - interval '24 hours';
  exception when undefined_table then
    null;
  end;

  select count(*) into v_signups
  from auth.users
  where created_at > now() - interval '24 hours';

  select string_agg(check_key, ', ') into v_firing
  from public.watchdog_state
  where firing;

  perform public.watchdog_send(
    format(
      E'🟢 **[%s] Daily check-in.** Watchdog is running.\nLast 24h: %s new sign-ups, %s site errors, %s auth email failures.%s',
      s.env_label, v_signups, v_errors, v_email,
      case when v_firing is not null
        then E'\n⚠️ Still open: ' || v_firing
        else E'\nNo open alerts.' end
    )
  );
end;
$$;

create or replace function public.watchdog_test()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.watchdog_send(
    format(E'🔔 **[%s] Test message.** The Together Forge watchdog can reach this channel.',
           (select env_label from public.watchdog_settings where id = 1))
  );
$$;

revoke all on function public.watchdog_send(text) from public, anon, authenticated;
revoke all on function public.watchdog_apply(text, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.watchdog_run() from public, anon, authenticated;
revoke all on function public.watchdog_daily() from public, anon, authenticated;
revoke all on function public.watchdog_test() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedules (cron.schedule replaces a job with the same name)
-- ---------------------------------------------------------------------------
select cron.schedule('tf-watchdog', '*/5 * * * *', 'select public.watchdog_run()');
select cron.schedule(
  'tf-watchdog-daily',
  format('0 %s * * *', (select daily_hour_utc from public.watchdog_settings where id = 1)),
  'select public.watchdog_daily()'
);
