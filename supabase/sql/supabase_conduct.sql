-- Staff Conduct: reports, cases, notices, strikes, restrictions, audit.
-- Not a public shame board. Safe to re-run.
--
-- Staging check:
--   1. Apply this file.
--   2. Sign in as a member → report an idea.
--   3. Sign in as staff → Moderator → Conduct → open the case.
--   4. First off-brief decline: notify, no strike. Repeat: strike allowed.

-- ---------------------------------------------------------------------------
-- Account state (staff marks + enforcement)
-- ---------------------------------------------------------------------------
create table if not exists public.conduct_account_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  strike_count integer not null default 0 check (strike_count >= 0),
  last_cite_reason text,
  last_cite_at timestamptz,
  last_strike_at timestamptz,
  noisy_reporter boolean not null default false,
  linked_accounts_note text,
  restrict_claims_until timestamptz,
  restrict_ideas_until timestamptz,
  restrict_comments_until timestamptz,
  restrict_showcase_until timestamptz,
  restrict_claims_permanent boolean not null default false,
  restrict_ideas_permanent boolean not null default false,
  restrict_comments_permanent boolean not null default false,
  restrict_showcase_permanent boolean not null default false,
  suspended_until timestamptz,
  banned_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.conduct_cases (
  id uuid primary key default gen_random_uuid(),
  case_code text not null unique,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  content_type text not null,
  content_id text,
  content_path text,
  source text not null default 'member_report',
  reason_code text not null,
  details text,
  reporter_id uuid references public.profiles (id) on delete set null,
  status text not null default 'open',
  cited_document text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  constraint conduct_cases_type_chk check (
    content_type in (
      'task', 'task_comment', 'idea', 'idea_comment',
      'showcase', 'profile', 'user'
    )
  ),
  constraint conduct_cases_source_chk check (
    source in ('member_report', 'staff')
  ),
  constraint conduct_cases_reason_chk check (
    reason_code in (
      'off_brief', 'political_branding', 'harassment', 'brigading',
      'spam', 'impersonation', 'other_coc'
    )
  ),
  constraint conduct_cases_status_chk check (
    status in (
      'open', 'needs_info', 'action_taken', 'dismissed', 'disputed', 'closed'
    )
  ),
  constraint conduct_cases_details_len check (
    details is null or char_length(details) <= 4000
  ),
  constraint conduct_cases_cite_len check (
    cited_document is null or char_length(cited_document) <= 240
  )
);

create index if not exists idx_conduct_cases_status
  on public.conduct_cases (status, created_at desc);
create index if not exists idx_conduct_cases_target
  on public.conduct_cases (target_user_id, created_at desc);
create index if not exists idx_conduct_cases_reporter
  on public.conduct_cases (reporter_id, created_at desc);

create table if not exists public.conduct_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.conduct_cases (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint conduct_notes_len check (char_length(trim(body)) between 1 and 4000)
);

create index if not exists idx_conduct_notes_case
  on public.conduct_notes (case_id, created_at);

create table if not exists public.conduct_audit (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.conduct_cases (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  reason_code text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_conduct_audit_case
  on public.conduct_audit (case_id, created_at desc);
create index if not exists idx_conduct_audit_user
  on public.conduct_audit (target_user_id, created_at desc);

create table if not exists public.conduct_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  case_id uuid references public.conduct_cases (id) on delete set null,
  kind text not null,
  body text not null,
  strike_count integer,
  added_strike boolean not null default false,
  email_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conduct_notices_kind_chk check (
    kind in (
      'cite', 'warn', 'strike', 'restrict', 'suspend', 'ban',
      'lift', 'dismiss'
    )
  )
);

create index if not exists idx_conduct_notices_user
  on public.conduct_notices (user_id, created_at desc);

alter table public.comments add column if not exists hidden_at timestamptz;

alter table public.conduct_account_state enable row level security;
alter table public.conduct_cases enable row level security;
alter table public.conduct_notes enable row level security;
alter table public.conduct_audit enable row level security;
alter table public.conduct_notices enable row level security;

revoke all on public.conduct_account_state from public, anon, authenticated;
revoke all on public.conduct_cases from public, anon, authenticated;
revoke all on public.conduct_notes from public, anon, authenticated;
revoke all on public.conduct_audit from public, anon, authenticated;
revoke all on public.conduct_notices from public, anon, authenticated;
grant all on public.conduct_account_state to postgres, service_role;
grant all on public.conduct_cases to postgres, service_role;
grant all on public.conduct_notes to postgres, service_role;
grant all on public.conduct_audit to postgres, service_role;
grant all on public.conduct_notices to postgres, service_role;

drop policy if exists "Staff read conduct accounts" on public.conduct_account_state;
drop policy if exists "Staff write conduct accounts" on public.conduct_account_state;
drop policy if exists "Staff read conduct cases" on public.conduct_cases;
drop policy if exists "Staff write conduct cases" on public.conduct_cases;
drop policy if exists "Staff read conduct notes" on public.conduct_notes;
drop policy if exists "Staff write conduct notes" on public.conduct_notes;
drop policy if exists "Staff read conduct audit" on public.conduct_audit;
drop policy if exists "Own conduct notices" on public.conduct_notices;
drop policy if exists "Staff read conduct notices" on public.conduct_notices;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_staff'
  ) then
    create policy "Staff read conduct accounts"
      on public.conduct_account_state for select
      to authenticated
      using (public.is_staff());

    create policy "Staff write conduct accounts"
      on public.conduct_account_state for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());

    create policy "Staff read conduct cases"
      on public.conduct_cases for select
      to authenticated
      using (public.is_staff());

    create policy "Staff write conduct cases"
      on public.conduct_cases for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());

    create policy "Staff read conduct notes"
      on public.conduct_notes for select
      to authenticated
      using (public.is_staff());

    create policy "Staff write conduct notes"
      on public.conduct_notes for insert
      to authenticated
      with check (public.is_staff());

    create policy "Staff read conduct audit"
      on public.conduct_audit for select
      to authenticated
      using (public.is_staff());

    create policy "Own conduct notices"
      on public.conduct_notices for select
      to authenticated
      using (user_id = auth.uid() or public.is_staff());

    create policy "Staff read conduct notices"
      on public.conduct_notices for update
      to authenticated
      using (user_id = auth.uid() or public.is_staff())
      with check (user_id = auth.uid() or public.is_staff());
  end if;
end $$;

grant select on public.conduct_account_state to authenticated;
grant select on public.conduct_cases to authenticated;
grant select, insert on public.conduct_notes to authenticated;
grant select on public.conduct_audit to authenticated;
grant select, update on public.conduct_notices to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.conduct_new_case_code()
returns text
language plpgsql
as $$
declare
  v text;
begin
  loop
    v := 'C-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.conduct_cases where case_code = v);
  end loop;
  return v;
end;
$$;

create or replace function public.conduct_ensure_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.conduct_account_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.conduct_is_restricted(p_user_id uuid, p_kind text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.conduct_account_state%rowtype;
begin
  if p_user_id is null then
    return false;
  end if;
  select * into s from public.conduct_account_state where user_id = p_user_id;
  if s.user_id is null then
    return false;
  end if;
  if s.banned_at is not null then
    return true;
  end if;
  if s.suspended_until is not null and s.suspended_until > now() then
    return true;
  end if;
  if p_kind = 'claims' then
    return s.restrict_claims_permanent
      or (s.restrict_claims_until is not null and s.restrict_claims_until > now());
  end if;
  if p_kind = 'ideas' then
    return s.restrict_ideas_permanent
      or (s.restrict_ideas_until is not null and s.restrict_ideas_until > now());
  end if;
  if p_kind = 'comments' then
    return s.restrict_comments_permanent
      or (s.restrict_comments_until is not null and s.restrict_comments_until > now());
  end if;
  if p_kind = 'showcase' then
    return s.restrict_showcase_permanent
      or (s.restrict_showcase_until is not null and s.restrict_showcase_until > now());
  end if;
  return false;
end;
$$;

create or replace function public.conduct_assert_allowed(p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.conduct_is_restricted(auth.uid(), p_kind) then
    raise exception 'CONDUCT_RESTRICTED'
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.conduct_has_prior_notice(p_user_id uuid, p_reason text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conduct_notices n
    join public.conduct_cases c on c.id = n.case_id
    where n.user_id = p_user_id
      and n.kind in ('cite', 'warn', 'strike')
      and (p_reason is null or c.reason_code = p_reason)
  );
$$;

create or replace function public.trg_conduct_block_ideas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.conduct_assert_allowed('ideas');
  return new;
end;
$$;

drop trigger if exists trg_conduct_block_ideas on public.ideas;
create trigger trg_conduct_block_ideas
  before insert on public.ideas
  for each row execute function public.trg_conduct_block_ideas();

create or replace function public.trg_conduct_block_comments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.conduct_assert_allowed('comments');
  return new;
end;
$$;

drop trigger if exists trg_conduct_block_comments on public.comments;
create trigger trg_conduct_block_comments
  before insert on public.comments
  for each row execute function public.trg_conduct_block_comments();

do $$
begin
  if to_regclass('public.community_showcase_posts') is not null then
    execute $fn$
      create or replace function public.trg_conduct_block_showcase()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $t$
      begin
        perform public.conduct_assert_allowed('showcase');
        return new;
      end;
      $t$;
    $fn$;
    execute 'drop trigger if exists trg_conduct_block_showcase on public.community_showcase_posts';
    execute 'create trigger trg_conduct_block_showcase before insert on public.community_showcase_posts for each row execute function public.trg_conduct_block_showcase()';
  end if;
  if to_regclass('public.task_claims') is not null then
    execute $fn$
      create or replace function public.trg_conduct_block_claims()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $t$
      begin
        perform public.conduct_assert_allowed('claims');
        return new;
      end;
      $t$;
    $fn$;
    execute 'drop trigger if exists trg_conduct_block_claims on public.task_claims';
    execute 'create trigger trg_conduct_block_claims before insert on public.task_claims for each row execute function public.trg_conduct_block_claims()';
  end if;
end $$;

create or replace function public.conduct_log(
  p_case_id uuid,
  p_target uuid,
  p_action text,
  p_reason text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.conduct_audit (case_id, target_user_id, actor_id, action, reason_code, payload)
  values (p_case_id, p_target, auth.uid(), p_action, p_reason, p_payload);
end;
$$;

-- ---------------------------------------------------------------------------
-- Member report / staff open
-- ---------------------------------------------------------------------------
create or replace function public.submit_conduct_report(
  p_content_type text,
  p_content_id text default null,
  p_target_user_id uuid default null,
  p_project_id uuid default null,
  p_content_path text default null,
  p_reason_code text default 'other_coc',
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_id uuid;
  v_code text;
  v_details text;
begin
  if v_uid is null then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;
  if to_regprocedure('public.assert_action_allowed(text,integer,interval,interval,text)') is not null then
    perform public.assert_action_allowed('conduct_report', 8, interval '15 minutes', interval '3 seconds');
  end if;

  v_details := nullif(trim(coalesce(p_details, '')), '');
  if v_details is not null and char_length(v_details) > 4000 then
    raise exception 'Details are too long.';
  end if;
  if p_reason_code is null or p_reason_code not in (
    'off_brief', 'political_branding', 'harassment', 'brigading',
    'spam', 'impersonation', 'other_coc'
  ) then
    raise exception 'Pick a reason.';
  end if;
  if p_content_type is null or p_content_type not in (
    'task', 'task_comment', 'idea', 'idea_comment', 'showcase', 'profile', 'user'
  ) then
    raise exception 'Pick what you are reporting.';
  end if;

  v_target := p_target_user_id;
  if v_target is null and p_content_type = 'idea' and p_content_id is not null then
    select user_id into v_target from public.ideas where id::text = p_content_id;
  end if;
  if v_target is null and p_content_type = 'idea_comment' and p_content_id is not null then
    select user_id into v_target from public.comments where id::text = p_content_id;
  end if;
  if v_target is null and p_content_type = 'profile' then
    v_target := p_target_user_id;
  end if;
  if v_target is null then
    raise exception 'Could not find who this report is about.';
  end if;
  if v_target = v_uid then
    raise exception 'You cannot open a conduct report on yourself.';
  end if;

  perform public.conduct_ensure_account(v_target);
  v_code := public.conduct_new_case_code();
  insert into public.conduct_cases (
    case_code, target_user_id, project_id, content_type, content_id, content_path,
    source, reason_code, details, reporter_id, created_by, updated_by
  ) values (
    v_code, v_target, p_project_id, p_content_type, nullif(p_content_id, ''),
    nullif(p_content_path, ''), 'member_report', p_reason_code, v_details,
    v_uid, v_uid, v_uid
  )
  returning id into v_id;

  perform public.conduct_log(v_id, v_target, 'report', p_reason_code, jsonb_build_object(
    'source', 'member_report',
    'content_type', p_content_type
  ));

  return jsonb_build_object('ok', true, 'id', v_id, 'caseCode', v_code);
end;
$$;

create or replace function public.open_conduct_case(
  p_target_user_id uuid,
  p_content_type text default 'user',
  p_content_id text default null,
  p_project_id uuid default null,
  p_content_path text default null,
  p_reason_code text default 'other_coc',
  p_details text default null,
  p_cited_document text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_code text;
begin
  if not public.is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;
  if p_target_user_id is null then
    raise exception 'Pick the person this case is about.';
  end if;
  perform public.conduct_ensure_account(p_target_user_id);
  v_code := public.conduct_new_case_code();
  insert into public.conduct_cases (
    case_code, target_user_id, project_id, content_type, content_id, content_path,
    source, reason_code, details, cited_document, created_by, updated_by
  ) values (
    v_code, p_target_user_id, p_project_id,
    coalesce(nullif(p_content_type, ''), 'user'),
    nullif(p_content_id, ''), nullif(p_content_path, ''),
    'staff', coalesce(nullif(p_reason_code, ''), 'other_coc'),
    nullif(trim(coalesce(p_details, '')), ''),
    nullif(trim(coalesce(p_cited_document, '')), ''),
    v_uid, v_uid
  )
  returning id into v_id;

  perform public.conduct_log(v_id, p_target_user_id, 'open', p_reason_code, jsonb_build_object(
    'source', 'staff'
  ));

  return jsonb_build_object('ok', true, 'id', v_id, 'caseCode', v_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- Apply review (one or more outcomes)
-- ---------------------------------------------------------------------------
create or replace function public.apply_conduct_review(
  p_case_id uuid,
  p_actions jsonb default '[]'::jsonb,
  p_status text default null,
  p_cited_document text default null,
  p_staff_note text default null,
  p_notice_body text default null,
  p_notify boolean default false,
  p_skip_ladder_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  c public.conduct_cases%rowtype;
  s public.conduct_account_state%rowtype;
  v_act jsonb;
  v_type text;
  v_has_strike boolean := false;
  v_has_cite boolean := false;
  v_added_strike boolean := false;
  v_notice_id uuid;
  v_kind text := 'cite';
  v_days int;
  v_until timestamptz;
  v_skip text;
  v_status text;
  v_auth text := null;
begin
  if not public.is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;
  select * into c from public.conduct_cases where id = p_case_id;
  if c.id is null then
    raise exception 'Case not found.';
  end if;
  perform public.conduct_ensure_account(c.target_user_id);
  select * into s from public.conduct_account_state where user_id = c.target_user_id;
  v_skip := nullif(trim(coalesce(p_skip_ladder_reason, '')), '');

  for v_act in select * from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    v_type := v_act->>'type';
    if v_type = 'strike' then v_has_strike := true; end if;
    if v_type = 'notify_cite' then v_has_cite := true; end if;
  end loop;

  if v_has_strike
     and c.reason_code in ('off_brief', 'political_branding')
     and not public.conduct_has_prior_notice(c.target_user_id, c.reason_code)
     and v_skip is null then
    raise exception 'FIRST_OFF_BRIEF_NO_STRIKE'
      using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(p_staff_note, '')), '') is not null then
    insert into public.conduct_notes (case_id, author_id, body)
    values (p_case_id, v_uid, trim(p_staff_note));
  end if;

  if p_cited_document is not null then
    update public.conduct_cases
      set cited_document = nullif(trim(p_cited_document), ''),
          updated_at = now(),
          updated_by = v_uid
    where id = p_case_id;
    c.cited_document := nullif(trim(p_cited_document), '');
  end if;

  for v_act in select * from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    v_type := v_act->>'type';

    if v_type = 'dismiss' then
      perform public.conduct_log(p_case_id, c.target_user_id, 'dismiss', c.reason_code, v_act);

    elsif v_type = 'decline_content' then
      if c.content_type = 'idea' and c.content_id is not null then
        update public.ideas set status = 'Archived' where id::text = c.content_id;
      elsif c.content_type = 'idea_comment' and c.content_id is not null then
        update public.comments set hidden_at = now() where id::text = c.content_id;
      elsif c.content_type = 'showcase' and c.content_id is not null
            and to_regclass('public.community_showcase_posts') is not null then
        execute 'update public.community_showcase_posts set status = ''rejected'' where id::text = $1'
          using c.content_id;
      elsif c.content_type in ('task', 'task_comment') and c.content_id is not null then
        if to_regclass('public.task_claims') is not null then
          execute $q$
            update public.task_claims
            set status = 'Returned'
            where id::text = $1 and status in ('PendingReview', 'Active')
          $q$ using c.content_id;
        end if;
        if to_regclass('public.project_contributions') is not null then
          update public.project_contributions
            set archived_at = now(), updated_at = now()
          where archived_at is null
            and (
              source_key = 'task-claim:' || c.content_id
              or source_key like 'task-claim:' || c.content_id || '%'
            );
        end if;
      end if;
      perform public.conduct_log(p_case_id, c.target_user_id, 'decline_content', c.reason_code, v_act);

    elsif v_type = 'notify_cite' then
      update public.conduct_account_state set
        last_cite_reason = c.reason_code,
        last_cite_at = now(),
        updated_at = now(),
        updated_by = v_uid
      where user_id = c.target_user_id;
      perform public.conduct_log(p_case_id, c.target_user_id, 'notify_cite', c.reason_code, v_act);

    elsif v_type = 'warn' then
      perform public.conduct_log(p_case_id, c.target_user_id, 'warn', c.reason_code, v_act);
      v_kind := 'warn';

    elsif v_type = 'strike' then
      update public.conduct_account_state set
        strike_count = strike_count + 1,
        last_strike_at = now(),
        last_cite_reason = c.reason_code,
        last_cite_at = coalesce(last_cite_at, now()),
        updated_at = now(),
        updated_by = v_uid
      where user_id = c.target_user_id
      returning * into s;
      v_added_strike := true;
      v_kind := 'strike';
      -- Default ladder: 2 strikes → 14-day claim restriction unless staff set restrict
      if s.strike_count = 2 and not exists (
        select 1 from jsonb_array_elements(p_actions) a where a->>'type' = 'restrict'
      ) then
        update public.conduct_account_state set
          restrict_claims_until = now() + interval '14 days',
          updated_at = now(),
          updated_by = v_uid
        where user_id = c.target_user_id;
        perform public.conduct_log(
          p_case_id, c.target_user_id, 'restrict', c.reason_code,
          jsonb_build_object('auto', true, 'claims', true, 'days', 14)
        );
      end if;
      if v_skip is not null then
        perform public.conduct_log(
          p_case_id, c.target_user_id, 'skip_ladder', c.reason_code,
          jsonb_build_object('reason', v_skip)
        );
      end if;
      perform public.conduct_log(p_case_id, c.target_user_id, 'strike', c.reason_code,
        jsonb_build_object('strike_count', s.strike_count));

    elsif v_type = 'restrict' then
      v_days := coalesce((v_act->>'days')::int, 14);
      v_until := case when coalesce((v_act->>'permanent')::boolean, false)
        then null else now() + make_interval(days => greatest(v_days, 1)) end;
      update public.conduct_account_state set
        restrict_claims_until = case when coalesce((v_act->>'claims')::boolean, false)
          then coalesce(v_until, restrict_claims_until) else restrict_claims_until end,
        restrict_claims_permanent = restrict_claims_permanent or (
          coalesce((v_act->>'claims')::boolean, false)
          and coalesce((v_act->>'permanent')::boolean, false)
        ),
        restrict_ideas_until = case when coalesce((v_act->>'ideas')::boolean, false)
          then coalesce(v_until, restrict_ideas_until) else restrict_ideas_until end,
        restrict_ideas_permanent = restrict_ideas_permanent or (
          coalesce((v_act->>'ideas')::boolean, false)
          and coalesce((v_act->>'permanent')::boolean, false)
        ),
        restrict_comments_until = case when coalesce((v_act->>'comments')::boolean, false)
          then coalesce(v_until, restrict_comments_until) else restrict_comments_until end,
        restrict_comments_permanent = restrict_comments_permanent or (
          coalesce((v_act->>'comments')::boolean, false)
          and coalesce((v_act->>'permanent')::boolean, false)
        ),
        restrict_showcase_until = case when coalesce((v_act->>'showcase')::boolean, false)
          then coalesce(v_until, restrict_showcase_until) else restrict_showcase_until end,
        restrict_showcase_permanent = restrict_showcase_permanent or (
          coalesce((v_act->>'showcase')::boolean, false)
          and coalesce((v_act->>'permanent')::boolean, false)
        ),
        updated_at = now(),
        updated_by = v_uid
      where user_id = c.target_user_id;
      v_kind := 'restrict';
      perform public.conduct_log(p_case_id, c.target_user_id, 'restrict', c.reason_code, v_act);

    elsif v_type = 'suspend' then
      v_days := coalesce((v_act->>'days')::int, 7);
      v_until := now() + make_interval(days => greatest(v_days, 1));
      update public.conduct_account_state set
        suspended_until = v_until,
        updated_at = now(),
        updated_by = v_uid
      where user_id = c.target_user_id;
      update public.profiles set
        moderation_status = 'suspended',
        moderation_note = 'Conduct case ' || c.case_code
      where id = c.target_user_id;
      v_kind := 'suspend';
      v_auth := 'suspend:' || v_days::text;
      perform public.conduct_log(p_case_id, c.target_user_id, 'suspend', c.reason_code, v_act);

    elsif v_type = 'ban' then
      update public.conduct_account_state set
        banned_at = now(),
        updated_at = now(),
        updated_by = v_uid
      where user_id = c.target_user_id;
      update public.profiles set
        moderation_status = 'banned',
        moderation_note = 'Conduct case ' || c.case_code
      where id = c.target_user_id;
      v_kind := 'ban';
      v_auth := 'ban';
      perform public.conduct_log(p_case_id, c.target_user_id, 'ban', c.reason_code, v_act);

    elsif v_type = 'unban' then
      update public.conduct_account_state set
        banned_at = null,
        suspended_until = null,
        updated_at = now(),
        updated_by = v_uid
      where user_id = c.target_user_id;
      update public.profiles set
        moderation_status = 'active',
        moderation_note = null
      where id = c.target_user_id;
      v_kind := 'lift';
      v_auth := 'unban';
      perform public.conduct_log(p_case_id, c.target_user_id, 'unban', c.reason_code, v_act);

    elsif v_type = 'lift_strike' then
      update public.conduct_account_state set
        strike_count = greatest(strike_count - 1, 0),
        updated_at = now(),
        updated_by = v_uid
      where user_id = c.target_user_id
      returning * into s;
      v_kind := 'lift';
      perform public.conduct_log(p_case_id, c.target_user_id, 'lift_strike', c.reason_code,
        jsonb_build_object('strike_count', s.strike_count, 'reason', v_act->>'reason'));

    elsif v_type = 'lift_restriction' then
      update public.conduct_account_state set
        restrict_claims_until = null,
        restrict_ideas_until = null,
        restrict_comments_until = null,
        restrict_showcase_until = null,
        restrict_claims_permanent = false,
        restrict_ideas_permanent = false,
        restrict_comments_permanent = false,
        restrict_showcase_permanent = false,
        updated_at = now(),
        updated_by = v_uid
      where user_id = c.target_user_id;
      v_kind := 'lift';
      perform public.conduct_log(p_case_id, c.target_user_id, 'lift_restriction', c.reason_code, v_act);

    elsif v_type = 'mark_disputed' then
      perform public.conduct_log(p_case_id, c.target_user_id, 'mark_disputed', c.reason_code, v_act);
    end if;
  end loop;

  select * into s from public.conduct_account_state where user_id = c.target_user_id;

  v_status := coalesce(nullif(trim(coalesce(p_status, '')), ''), c.status);
  if p_status is null then
    if exists (select 1 from jsonb_array_elements(p_actions) a where a->>'type' = 'dismiss')
       and jsonb_array_length(p_actions) = 1 then
      v_status := 'dismissed';
    elsif exists (select 1 from jsonb_array_elements(p_actions) a where a->>'type' = 'mark_disputed') then
      v_status := 'disputed';
    else
      v_status := 'action_taken';
    end if;
  end if;

  update public.conduct_cases set
    status = v_status,
    closed_at = case when v_status in ('dismissed', 'closed') then now() else closed_at end,
    updated_at = now(),
    updated_by = v_uid
  where id = p_case_id;

  if coalesce(p_notify, false) and nullif(trim(coalesce(p_notice_body, '')), '') is not null then
    insert into public.conduct_notices (
      user_id, case_id, kind, body, strike_count, added_strike
    ) values (
      c.target_user_id, p_case_id, v_kind, trim(p_notice_body),
      s.strike_count, v_added_strike
    )
    returning id into v_notice_id;
    perform public.conduct_log(p_case_id, c.target_user_id, 'notice', c.reason_code,
      jsonb_build_object('notice_id', v_notice_id, 'kind', v_kind));
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', p_case_id,
    'caseCode', c.case_code,
    'status', v_status,
    'strikeCount', s.strike_count,
    'noticeId', v_notice_id,
    'authAction', v_auth,
    'targetUserId', c.target_user_id
  );
end;
$$;

create or replace function public.add_conduct_note(p_case_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 then
    raise exception 'Write a note.';
  end if;
  insert into public.conduct_notes (case_id, author_id, body)
  values (p_case_id, auth.uid(), trim(p_body))
  returning id into v_id;
  perform public.conduct_log(p_case_id, null, 'note', null, jsonb_build_object('note_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.set_conduct_noisy_reporter(p_user_id uuid, p_noisy boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;
  perform public.conduct_ensure_account(p_user_id);
  update public.conduct_account_state set
    noisy_reporter = coalesce(p_noisy, false),
    updated_at = now(),
    updated_by = auth.uid()
  where user_id = p_user_id;
  perform public.conduct_log(null, p_user_id, 'noisy_reporter', null,
    jsonb_build_object('noisy', coalesce(p_noisy, false)));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_conduct_linked_accounts(p_user_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;
  perform public.conduct_ensure_account(p_user_id);
  update public.conduct_account_state set
    linked_accounts_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = now(),
    updated_by = auth.uid()
  where user_id = p_user_id;
  perform public.conduct_log(null, p_user_id, 'linked_accounts', null, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_my_conduct_file()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s public.conduct_account_state%rowtype;
begin
  if v_uid is null then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;
  select * into s from public.conduct_account_state where user_id = v_uid;
  return jsonb_build_object(
    'strikeCount', coalesce(s.strike_count, 0),
    'restrictClaimsUntil', s.restrict_claims_until,
    'restrictIdeasUntil', s.restrict_ideas_until,
    'restrictCommentsUntil', s.restrict_comments_until,
    'restrictShowcaseUntil', s.restrict_showcase_until,
    'restrictClaimsPermanent', coalesce(s.restrict_claims_permanent, false),
    'restrictIdeasPermanent', coalesce(s.restrict_ideas_permanent, false),
    'restrictCommentsPermanent', coalesce(s.restrict_comments_permanent, false),
    'restrictShowcasePermanent', coalesce(s.restrict_showcase_permanent, false),
    'suspendedUntil', s.suspended_until,
    'banned', s.banned_at is not null,
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id,
        'caseId', n.case_id,
        'caseCode', c.case_code,
        'kind', n.kind,
        'body', n.body,
        'strikeCount', n.strike_count,
        'addedStrike', n.added_strike,
        'readAt', n.read_at,
        'createdAt', n.created_at
      ) order by n.created_at desc)
      from public.conduct_notices n
      left join public.conduct_cases c on c.id = n.case_id
      where n.user_id = v_uid
    ), '[]'::jsonb),
    'caseIds', coalesce((
      select jsonb_agg(distinct c.case_code)
      from public.conduct_cases c
      where c.target_user_id = v_uid
        and c.status not in ('dismissed')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.mark_conduct_notice_read(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'SIGN_IN_REQUIRED' using errcode = 'P0001';
  end if;
  update public.conduct_notices
    set read_at = coalesce(read_at, now())
  where id = p_id and user_id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.mark_conduct_notice_emailed(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'STAFF_ONLY' using errcode = '42501';
  end if;
  update public.conduct_notices set email_sent_at = now() where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_conduct_report(text, text, uuid, uuid, text, text, text) from public;
revoke all on function public.open_conduct_case(uuid, text, text, uuid, text, text, text, text) from public;
revoke all on function public.apply_conduct_review(uuid, jsonb, text, text, text, text, boolean, text) from public;
revoke all on function public.add_conduct_note(uuid, text) from public;
revoke all on function public.set_conduct_noisy_reporter(uuid, boolean) from public;
revoke all on function public.set_conduct_linked_accounts(uuid, text) from public;
revoke all on function public.get_my_conduct_file() from public;
revoke all on function public.mark_conduct_notice_read(uuid) from public;
revoke all on function public.mark_conduct_notice_emailed(uuid) from public;

grant execute on function public.submit_conduct_report(text, text, uuid, uuid, text, text, text) to authenticated;
grant execute on function public.open_conduct_case(uuid, text, text, uuid, text, text, text, text) to authenticated;
grant execute on function public.apply_conduct_review(uuid, jsonb, text, text, text, text, boolean, text) to authenticated;
grant execute on function public.add_conduct_note(uuid, text) to authenticated;
grant execute on function public.set_conduct_noisy_reporter(uuid, boolean) to authenticated;
grant execute on function public.set_conduct_linked_accounts(uuid, text) to authenticated;
grant execute on function public.get_my_conduct_file() to authenticated;
grant execute on function public.mark_conduct_notice_read(uuid) to authenticated;
grant execute on function public.mark_conduct_notice_emailed(uuid) to authenticated;

notify pgrst, 'reload schema';
