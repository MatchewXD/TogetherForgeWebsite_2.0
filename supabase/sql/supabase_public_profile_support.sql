-- =============================================================================
-- Public profile: GitHub handle, donation total opt-in, public support summary
-- Run after profiles + donations tables exist.
-- Safe to re-run.
-- =============================================================================

alter table if exists public.profiles
  add column if not exists github text;

alter table if exists public.profiles
  add column if not exists show_donation_total boolean not null default false;

comment on column public.profiles.github is
  'Public GitHub username or profile URL (display / link on public profile).';
comment on column public.profiles.show_donation_total is
  'DISPLAY only: when true, public profile shows the non-anonymous donation total. Does not affect whether donations are counted.';

-- ---------------------------------------------------------------------------
-- Public support summary for a profile (security definer).
--
-- COUNTING (always):
--   Every non-anonymous completed donation for this user is counted.
--   show_donation_total does NOT affect the sum or donation_count.
--   Only is_anonymous = true excludes a donation from counting.
--
-- DISPLAY:
--   Project list / supporter recognition: always for non-anon credit.
--   total_cents returned to clients only when show_donation_total = true
--   (privacy: amount is not leaked when the user opted out of showing it).
-- ---------------------------------------------------------------------------
create or replace function public.get_public_profile_support(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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

grant execute on function public.get_public_profile_support(uuid) to anon, authenticated;

comment on function public.get_public_profile_support is
  'Non-anon donations always counted; show_donation_total only controls whether total_cents is returned for display.';
