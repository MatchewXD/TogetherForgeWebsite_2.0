-- Published Together Forge LLC operating expenses (Transparency Hub).
-- Staff-entered report of Relay Operating spend. Not a bank feed.
-- Do not import Stripe payouts, 25% tax withholding transfers, refunds,
-- or Runway / Ko-fi. Safe to re-run.

create table if not exists public.studio_published_expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  category text not null,
  vendor text not null,
  amount_cents integer not null,
  description text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint studio_published_expenses_amount_chk check (amount_cents > 0),
  constraint studio_published_expenses_vendor_len check (
    char_length(trim(vendor)) between 2 and 80
  ),
  constraint studio_published_expenses_desc_len check (
    char_length(trim(description)) between 8 and 280
  ),
  constraint studio_published_expenses_category_chk check (
    category in (
      'Development & tools',
      'Tools & infrastructure',
      'Community',
      'Operations'
    )
  )
);

comment on table public.studio_published_expenses is
  'Published Together Forge LLC expenses from Relay Operating. Not a bank feed; do not store Stripe payouts, tax withholding, refunds, or Runway/Ko-fi.';

create index if not exists idx_studio_published_expenses_public
  on public.studio_published_expenses (spent_on desc, created_at desc)
  where archived_at is null;

create index if not exists idx_studio_published_expenses_staff
  on public.studio_published_expenses (archived_at nulls first, spent_on desc);

alter table public.studio_published_expenses enable row level security;

drop policy if exists "Public read published studio expenses"
  on public.studio_published_expenses;
create policy "Public read published studio expenses"
  on public.studio_published_expenses for select
  to anon, authenticated
  using (archived_at is null);

drop policy if exists "Staff read all studio expenses"
  on public.studio_published_expenses;
drop policy if exists "Staff write studio expenses"
  on public.studio_published_expenses;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_staff'
  ) then
    create policy "Staff read all studio expenses"
      on public.studio_published_expenses for select
      to authenticated
      using (public.is_staff());

    create policy "Staff write studio expenses"
      on public.studio_published_expenses for all
      to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  else
    create policy "Staff write studio expenses"
      on public.studio_published_expenses for all
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

grant select on public.studio_published_expenses to anon, authenticated;
grant insert, update, delete on public.studio_published_expenses to authenticated;

notify pgrst, 'reload schema';
