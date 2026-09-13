-- Built-in "None of these" option. Not one of the staff 2-8 choices.
-- Always last. Counts as a vote. Safe to re-run.

alter table public.poll_options
  add column if not exists is_none boolean not null default false;

comment on column public.poll_options.is_none is
  'Built-in None of these. Not a staff option. Always present and last.';

create unique index if not exists idx_poll_options_one_none
  on public.poll_options (poll_id)
  where is_none;

create or replace function public.ensure_poll_none_option(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.poll_options (
    poll_id, sort_order, name, description, is_none
  )
  select
    p_poll_id,
    100,
    'None of these',
    'I do not want any of these.',
    true
  where not exists (
    select 1 from public.poll_options o
    where o.poll_id = p_poll_id and o.is_none
  );
end;
$$;

create or replace function public.enforce_poll_status()
returns trigger
language plpgsql
as $$
declare
  v_staff int;
  v_none int;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'closed' and new.status is distinct from 'closed' then
      raise exception 'Closed polls stay closed.';
    end if;
    if old.status = 'live' and new.status = 'draft' then
      raise exception 'A live poll cannot return to draft. Close it instead.';
    end if;
  end if;

  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    perform public.ensure_poll_none_option(new.id);
    select count(*) filter (where not is_none),
           count(*) filter (where is_none)
      into v_staff, v_none
    from public.poll_options
    where poll_id = new.id;
    if v_staff < 2 or v_staff > 8 then
      raise exception 'A live poll needs between 2 and 8 staff options.';
    end if;
    if v_none <> 1 then
      raise exception 'A live poll needs the built-in None of these option.';
    end if;
    new.opened_at := coalesce(new.opened_at, now());
    if new.opened_by is null then
      new.opened_by := auth.uid();
    end if;
  end if;

  if new.status = 'closed' and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    new.closed_at := coalesce(new.closed_at, now());
  end if;

  return new;
end;
$$;

create or replace function public.enforce_poll_option_count()
returns trigger
language plpgsql
as $$
declare
  v_poll uuid;
  v_status text;
  v_staff int;
  v_none int;
  v_is_none boolean;
begin
  v_poll := coalesce(new.poll_id, old.poll_id);
  v_is_none := coalesce(new.is_none, old.is_none, false);
  select status into v_status from public.polls where id = v_poll;
  select count(*) filter (where not is_none),
         count(*) filter (where is_none)
    into v_staff, v_none
  from public.poll_options
  where poll_id = v_poll;

  if v_staff > 8 then
    raise exception 'A poll can have at most 8 staff options.';
  end if;

  if coalesce(v_status, 'draft') is distinct from 'draft' and v_staff < 2 then
    raise exception 'A poll needs at least 2 staff options.';
  end if;

  if v_none > 1 then
    raise exception 'A poll can have only one None of these option.';
  end if;

  if tg_op = 'DELETE' and coalesce(old.is_none, false) then
    raise exception 'None of these cannot be removed.';
  end if;

  if tg_op = 'UPDATE' and old.is_none and (
       new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.is_none is distinct from old.is_none
  ) then
    raise exception 'None of these cannot be edited.';
  end if;

  -- Staff options lock once live. Backfill of missing None is allowed.
  if coalesce(v_status, 'draft') in ('live', 'closed') then
    if tg_op = 'INSERT' and v_is_none then
      null;
    elsif not v_is_none then
      raise exception 'Staff options cannot change after a poll opens.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enforce_poll_option_count on public.poll_options;
create trigger trg_enforce_poll_option_count
  after insert or delete or update of poll_id, name, description, is_none
  on public.poll_options
  for each row
  execute function public.enforce_poll_option_count();

insert into public.poll_options (poll_id, sort_order, name, description, is_none)
select p.id, 100, 'None of these', 'I do not want any of these.', true
from public.polls p
where not exists (
  select 1 from public.poll_options o
  where o.poll_id = p.id and o.is_none
);

grant execute on function public.ensure_poll_none_option(uuid) to authenticated;

notify pgrst, 'reload schema';
