-- =============================================================================
-- Staff-only internal notes when a task suggestion is struck.
-- Authors never see this table. They only get a general rules notice.
-- Safe to re-run.
-- =============================================================================

create table if not exists public.task_suggestion_staff_notes (
  suggestion_id uuid primary key references public.task_suggestions(id) on delete cascade,
  note text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint task_suggestion_staff_notes_len check (
    char_length(btrim(note)) between 8 and 500
  )
);

comment on table public.task_suggestion_staff_notes is
  'Staff-only reason for a strike. Never shown to the suggestion author.';

alter table public.task_suggestion_staff_notes enable row level security;

grant select, insert, update, delete on public.task_suggestion_staff_notes to authenticated;

drop policy if exists "Staff read strike notes" on public.task_suggestion_staff_notes;
create policy "Staff read strike notes"
  on public.task_suggestion_staff_notes for select
  to authenticated
  using (public.is_project_staff());

drop policy if exists "Staff write strike notes" on public.task_suggestion_staff_notes;
create policy "Staff write strike notes"
  on public.task_suggestion_staff_notes for all
  to authenticated
  using (public.is_project_staff())
  with check (public.is_project_staff());

notify pgrst, 'reload schema';
