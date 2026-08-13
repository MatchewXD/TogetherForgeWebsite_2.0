-- =============================================================================
-- Projects / tasks public API grants
-- RLS policies exist ("Public can read…") but greenfield tables often lack
-- GRANT SELECT for anon/authenticated → client lists empty, donations not
-- attributed only if webhook RPC works (security definer) but UI still blank.
-- Safe to re-run.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Projects (Contributors landing, hubs, workspaces)
do $$
begin
  if to_regclass('public.projects') is not null then
    grant select on table public.projects to anon, authenticated, service_role;
    grant insert, update, delete on table public.projects to authenticated, service_role;
  end if;
  if to_regclass('public.tasks') is not null then
    grant select on table public.tasks to anon, authenticated, service_role;
    grant insert, update, delete on table public.tasks to authenticated, service_role;
  end if;
  if to_regclass('public.task_claims') is not null then
    grant select on table public.task_claims to anon, authenticated, service_role;
    grant insert, update, delete on table public.task_claims to authenticated, service_role;
  end if;
  if to_regclass('public.activity_log') is not null then
    grant select on table public.activity_log to anon, authenticated, service_role;
    grant insert on table public.activity_log to authenticated, service_role;
  end if;
  if to_regclass('public.project_contributions') is not null then
    grant select on table public.project_contributions to anon, authenticated, service_role;
    grant insert, update, delete on table public.project_contributions to authenticated, service_role;
  end if;
  if to_regclass('public.claim_join_requests') is not null then
    grant select on table public.claim_join_requests to anon, authenticated, service_role;
    grant insert, update, delete on table public.claim_join_requests to authenticated, service_role;
  end if;
end $$;

grant usage, select on all sequences in schema public to authenticated, service_role;

-- Donation attribution RPC (if SQL applied)
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_active_project_id_for_donations'
  ) then
    grant execute on function public.get_active_project_id_for_donations() to anon, authenticated, service_role;
  end if;
end $$;

-- Optional: attach unattributed studio donations to current active project
-- (only rows that never got project_id — e.g. backfills or pre-RPC webhook)
do $$
declare
  v_active uuid;
begin
  if to_regclass('public.donations') is null then
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'donations' and column_name = 'project_id'
  ) then
    return;
  end if;

  begin
    v_active := public.get_active_project_id_for_donations();
  exception when others then
    v_active := null;
  end;

  if v_active is null then
    select p.id into v_active
    from public.projects p
    where p.completed_at is null
      and lower(trim(coalesce(p.status, ''))) in (
        'in development', 'development', 'active', 'live', ''
      )
    order by
      case when lower(coalesce(p.phase, '')) like 'early%' then 0 else 1 end,
      p.created_at asc
    limit 1;
  end if;

  if v_active is null then
    raise notice 'No active project for donation backfill';
    return;
  end if;

  update public.donations d
  set project_id = v_active
  where d.project_id is null
    and coalesce(d.fund_type, 'studio') = 'studio'
    and coalesce(d.status, 'completed') in ('completed', 'paid', 'succeeded');

  raise notice 'Backfilled donations.project_id → %', v_active;
end $$;

notify pgrst, 'reload schema';
