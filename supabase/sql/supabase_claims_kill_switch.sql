-- Claims kill switch. Default not paused.
-- Website Edge function claim-task syncs this from ENABLE_CLAIMS.
-- Direct claim_task RPC is blocked for non-staff when paused = true.
-- Staff may still claim. Existing In Progress claims are not touched.
-- Safe to re-run.

create table if not exists public.app_kill_switches (
  name text primary key,
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.app_kill_switches (name, paused)
values ('claims', false)
on conflict (name) do nothing;

alter table public.app_kill_switches enable row level security;

drop policy if exists "Anyone can read kill switches" on public.app_kill_switches;
create policy "Anyone can read kill switches"
  on public.app_kill_switches for select
  using (true);

grant select on table public.app_kill_switches to anon, authenticated;

create or replace function public.trg_claims_kill_switch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paused boolean;
begin
  if public.is_project_staff() then
    return new;
  end if;

  select paused into v_paused
  from public.app_kill_switches
  where name = 'claims';

  if coalesce(v_paused, false) then
    raise exception 'CLAIMS_PAUSED: Claims are paused right now.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_claims_kill_switch on public.task_claims;
create trigger trg_claims_kill_switch
  before insert on public.task_claims
  for each row
  execute function public.trg_claims_kill_switch();

notify pgrst, 'reload schema';
