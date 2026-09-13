-- Inbox rows for the member dashboard + avatar red dot.
-- Staff can insert (e.g. hide-note). Members read/update their own.
-- Safe to re-run.

create table if not exists public.dashboard_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text,
  body text,
  href text,
  source_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz
);

create index if not exists idx_dashboard_notices_user
  on public.dashboard_notices (user_id, dismissed_at, created_at desc);

comment on table public.dashboard_notices is
  'Per-user dashboard inbox. Unread (read_at is null, dismissed_at is null) drives the avatar red dot.';

alter table public.dashboard_notices enable row level security;

grant select, update on table public.dashboard_notices to authenticated;
grant insert on table public.dashboard_notices to authenticated;

drop policy if exists "Members read own dashboard notices" on public.dashboard_notices;
create policy "Members read own dashboard notices"
  on public.dashboard_notices for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Staff can insert dashboard notices" on public.dashboard_notices;
create policy "Staff can insert dashboard notices"
  on public.dashboard_notices for insert
  to authenticated
  with check (public.is_project_staff());

drop policy if exists "Members update own dashboard notices" on public.dashboard_notices;
create policy "Members update own dashboard notices"
  on public.dashboard_notices for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Backfill hide notes that never got an inbox row (including new hides).
insert into public.dashboard_notices (user_id, kind, title, body, href, source_id, created_at)
select
  r.user_id,
  'oq_hide',
  coalesce(q.title, 'Open Question'),
  coalesce(nullif(btrim(r.hidden_note), ''), 'Staff hid this reply as off-brief.'),
  '/questions/' || r.question_id::text || '/answers/' || r.id::text,
  r.id,
  coalesce(r.hidden_at, now())
from public.open_question_replies r
left join public.open_questions q on q.id = r.question_id
where r.hidden_at is not null
  and not exists (
    select 1
    from public.dashboard_notices n
    where n.source_id = r.id
      and n.kind = 'oq_hide'
      and n.user_id = r.user_id
  );

create or replace function public.notify_dashboard(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_href text,
  p_source_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;
  if auth.uid() is null or not public.is_project_staff() then
    raise exception 'Staff only';
  end if;

  if p_source_id is not null then
    update public.dashboard_notices
    set
      title = coalesce(p_title, title),
      body = coalesce(p_body, body),
      href = coalesce(p_href, href),
      read_at = null,
      dismissed_at = null,
      created_at = now()
    where user_id = p_user_id
      and source_id = p_source_id
      and kind = coalesce(p_kind, 'notice')
    returning id into v_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.dashboard_notices (
    user_id, kind, title, body, href, source_id
  ) values (
    p_user_id, coalesce(p_kind, 'notice'), p_title, p_body, p_href, p_source_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.notify_dashboard(uuid, text, text, text, text, uuid)
  to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.dashboard_notices;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
