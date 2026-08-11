-- =============================================================================
-- Related Ideas / Add-ons: optional parent link (one level deep for v1)
-- =============================================================================
-- Any idea may point at one parent idea via parent_idea_id.
-- Related ideas remain normal ideas (same list, discovery, votes).
--
-- Data model is an adjacency list (parent_idea_id only) so multi-level trees
-- can be enabled later by relaxing the one-level trigger — no column redesign.
--
-- v1 rules (enforced in trigger):
--   • no self-parent
--   • parent must be a root (parent_idea_id IS NULL)
--   • idea that already has children cannot become a child (no grandchildren)
-- =============================================================================

alter table if exists public.ideas
  add column if not exists parent_idea_id bigint;

-- FK to ideas (nullable). SET NULL if parent is deleted.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ideas_parent_idea_id_fkey'
  ) then
    alter table public.ideas
      add constraint ideas_parent_idea_id_fkey
      foreign key (parent_idea_id)
      references public.ideas (id)
      on delete set null;
  end if;
exception
  when others then
    raise notice 'ideas_parent_idea_id_fkey: %', sqlerrm;
end;
$$;

create index if not exists idx_ideas_parent_idea_id
  on public.ideas (parent_idea_id)
  where parent_idea_id is not null;

comment on column public.ideas.parent_idea_id is
  'Optional parent idea (related / builds-on). Adjacency list; v1 enforces one level deep.';

-- -----------------------------------------------------------------------------
-- One-level enforcement (relax later for multi-level without schema change)
-- -----------------------------------------------------------------------------

create or replace function public.ideas_enforce_parent_one_level()
returns trigger
language plpgsql
as $$
declare
  parent_parent bigint;
  child_count integer;
begin
  if new.parent_idea_id is null then
    return new;
  end if;

  -- No self-link
  if new.id is not null and new.parent_idea_id = new.id then
    raise exception 'IDEA_PARENT_SELF: An idea cannot be related to itself.';
  end if;

  -- Parent must exist and be a root (no parent of its own)
  select p.parent_idea_id
    into parent_parent
  from public.ideas p
  where p.id = new.parent_idea_id;

  if not found then
    raise exception 'IDEA_PARENT_MISSING: Parent idea does not exist.';
  end if;

  if parent_parent is not null then
    raise exception 'IDEA_PARENT_NOT_ROOT: Parent idea already builds on another idea. Only one level of related ideas is allowed for now.';
  end if;

  -- If this row already has children, it cannot become a child
  if new.id is not null then
    select count(*)::integer into child_count
    from public.ideas c
    where c.parent_idea_id = new.id;

    if coalesce(child_count, 0) > 0 then
      raise exception 'IDEA_PARENT_HAS_CHILDREN: This idea already has related ideas building on it, so it cannot link to a parent (one level only).';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ideas_parent_one_level on public.ideas;
create trigger ideas_parent_one_level
  before insert or update of parent_idea_id
  on public.ideas
  for each row
  execute function public.ideas_enforce_parent_one_level();

-- Optional helper: list children for a parent (public ideas only callers filter status)
create or replace function public.list_idea_children(p_parent_id bigint)
returns setof public.ideas
language sql
stable
security invoker
as $$
  select *
  from public.ideas
  where parent_idea_id = p_parent_id
  order by created_at desc;
$$;

grant execute on function public.list_idea_children(bigint) to anon, authenticated;
