-- =============================================================================
-- Donation → project attribution
-- While a project is In Development (active), studio donations attach to it.
-- After completed_at is set (released), new donations no longer attach.
-- Run after: supabase_tasks_schema, supabase_projects_completion,
--            supabase_donations_stripe, supabase_project_contributions.
-- Safe to re-run.
-- =============================================================================

alter table if exists donations
  add column if not exists project_id uuid references projects(id) on delete set null;

alter table if exists donations
  add column if not exists display_name text;

create index if not exists idx_donations_project
  on donations (project_id)
  where project_id is not null;

create index if not exists idx_donations_project_created
  on donations (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Resolve which project should receive a new studio donation right now.
-- Prefer Early + In Development, lowest sort_order; never completed.
-- ---------------------------------------------------------------------------
create or replace function public.get_active_project_id_for_donations()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
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

grant execute on function public.get_active_project_id_for_donations() to service_role;
grant execute on function public.get_active_project_id_for_donations() to authenticated;
grant execute on function public.get_active_project_id_for_donations() to anon;

comment on function public.get_active_project_id_for_donations is
  'Project UUID for new studio donations (active In Development only). Null if none active.';

-- ---------------------------------------------------------------------------
-- Public read: project donation totals + named donors (no per-person amounts)
-- Only rows with project_id = this project (attributed while it was active).
-- ---------------------------------------------------------------------------
create or replace function public.get_project_donation_credits(p_project_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
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

grant execute on function public.get_project_donation_credits(uuid) to anon, authenticated;

comment on function public.get_project_donation_credits is
  'Public project donation total + named donors (no individual amounts). Only donations attributed via project_id while project was active.';

-- ---------------------------------------------------------------------------
-- Optional backfill: attach unattributed studio donations to a project if they
-- fall strictly inside that project's active window [created_at, completed_at).
-- Only runs when the donation has no project_id yet.
-- ---------------------------------------------------------------------------
-- Example (review before running in production):
-- update donations d
-- set project_id = p.id
-- from projects p
-- where d.project_id is null
--   and coalesce(d.fund_type, 'studio') = 'studio'
--   and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded')
--   and d.created_at >= p.created_at
--   and (p.completed_at is null or d.created_at < p.completed_at)
--   and lower(coalesce(p.phase, '')) like 'early%';
