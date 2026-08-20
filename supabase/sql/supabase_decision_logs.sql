-- Public decision logs (Transparency Hub) with staff create / edit / archive.
-- Safe to re-run.

create table if not exists public.decision_logs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Governance',
  logged_on date not null default current_date,
  body text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint decision_logs_title_len check (
    char_length(trim(title)) between 3 and 160
  ),
  constraint decision_logs_body_len check (
    char_length(trim(body)) between 10 and 1200
  ),
  constraint decision_logs_category_chk check (
    category in ('Governance', 'Process', 'Legal', 'Community')
  )
);

create index if not exists idx_decision_logs_public
  on public.decision_logs (logged_on desc, created_at desc)
  where archived_at is null;

create index if not exists idx_decision_logs_staff
  on public.decision_logs (archived_at nulls first, logged_on desc);

alter table public.decision_logs enable row level security;

drop policy if exists "Public read active decision logs" on public.decision_logs;
create policy "Public read active decision logs"
  on public.decision_logs for select
  to anon, authenticated
  using (archived_at is null);

drop policy if exists "Staff read all decision logs" on public.decision_logs;
drop policy if exists "Staff write decision logs" on public.decision_logs;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_staff'
  ) then
    create policy "Staff read all decision logs"
      on public.decision_logs for select
      to authenticated
      using (public.is_staff());

    create policy "Staff write decision logs"
      on public.decision_logs for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  else
    create policy "Staff write decision logs"
      on public.decision_logs for all
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and coalesce(p.role, 'user') in (
              'founder', 'moderator', 'admin', 'project_lead'
            )
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and coalesce(p.role, 'user') in (
              'founder', 'moderator', 'admin', 'project_lead'
            )
        )
      );
  end if;
end $$;

grant select on public.decision_logs to anon, authenticated;
grant insert, update, delete on public.decision_logs to authenticated;

insert into public.decision_logs (title, category, logged_on, body)
select *
from (
  values
    (
      'Studio support builds projects, not founder pay',
      'Governance',
      '2026-07-15'::date,
      'Together Forge project support funds development and operations only. Founder living wage comes from profits once the studio can pay all employees a family-supporting wage, or from a separate personal runway path that is not project funds.'
    ),
    (
      'Public workspaces over private silos',
      'Process',
      '2026-07-15'::date,
      'Every active project gets a public workspace with kanban, updates, and shoutouts so progress does not require insider access.'
    ),
    (
      'Support is not a charitable donation',
      'Legal',
      '2026-07-15'::date,
      'Together Forge is a community-supported for-profit studio. Contributions are not tax-deductible. That is stated clearly on Support and here.'
    ),
    (
      'Five active task claims per volunteer',
      'Community',
      '2026-07-15'::date,
      'A cap of five active claims keeps boards fair. Completing or releasing a task frees a slot.'
    )
) as seed(title, category, logged_on, body)
where not exists (select 1 from public.decision_logs);

notify pgrst, 'reload schema';
