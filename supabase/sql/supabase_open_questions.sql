-- =============================================================================
-- Open Questions — staff-initiated project decisions
-- Community posts Suggestions. Suggestions can be supported and receive replies.
-- Ranked by supports, then replies. Staff may Adopt a suggestion or close with a note.
-- Run AFTER supabase_tasks_schema.sql (projects + is_project_staff).
-- Safe to re-run.
-- =============================================================================

create table if not exists public.open_questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  selected_reply_id uuid,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint open_questions_title_len check (
    char_length(trim(title)) >= 8 and char_length(trim(title)) <= 160
  )
);

create table if not exists public.open_question_replies (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.open_questions(id) on delete cascade,
  parent_id uuid references public.open_question_replies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint open_question_replies_body_len check (
    char_length(trim(body)) >= 2 and char_length(trim(body)) <= 2000
  )
);

create index if not exists idx_open_questions_project
  on public.open_questions (project_id, status, created_at desc);

create index if not exists idx_open_question_replies_question
  on public.open_question_replies (question_id, created_at);

create index if not exists idx_open_question_replies_parent
  on public.open_question_replies (parent_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'open_questions_selected_reply_fk'
  ) then
    alter table public.open_questions
      add constraint open_questions_selected_reply_fk
      foreign key (selected_reply_id)
      references public.open_question_replies(id)
      on delete set null;
  end if;
end $$;

comment on table public.open_questions is
  'Staff-initiated project questions. Community posts Suggestions; staff may Adopt one or close with a note.';
comment on table public.open_question_replies is
  'Suggestions (parent_id null) and one-level replies. Ranking uses supports, then reply count.';

create or replace function public.touch_open_questions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_open_questions_updated_at on public.open_questions;
create trigger trg_open_questions_updated_at
  before update on public.open_questions
  for each row
  execute function public.touch_open_questions_updated_at();

-- One-level replies: parent must be a top-level Suggestion on the same question.
-- No replies on closed questions.
create or replace function public.enforce_open_question_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_parent public.open_question_replies%rowtype;
begin
  select status into v_status
  from public.open_questions
  where id = new.question_id;

  if not found then
    raise exception 'Question not found';
  end if;

  if v_status is distinct from 'open' then
    raise exception 'This question is closed';
  end if;

  if new.parent_id is not null then
    select * into v_parent
    from public.open_question_replies
    where id = new.parent_id;

    if not found then
      raise exception 'Suggestion not found';
    end if;
    if v_parent.question_id is distinct from new.question_id then
      raise exception 'Reply must belong to the same question';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Replies can only be posted on a Suggestion, not on another reply';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_open_question_reply on public.open_question_replies;
create trigger trg_enforce_open_question_reply
  before insert on public.open_question_replies
  for each row
  execute function public.enforce_open_question_reply();

grant select on table public.open_questions to anon, authenticated;
grant select on table public.open_question_replies to anon, authenticated;
grant insert, update, delete on table public.open_questions to authenticated;
grant insert, delete on table public.open_question_replies to authenticated;

alter table public.open_questions enable row level security;
alter table public.open_question_replies enable row level security;

drop policy if exists "Public can read open questions" on public.open_questions;
create policy "Public can read open questions"
  on public.open_questions for select
  using (true);

drop policy if exists "Staff can insert open questions" on public.open_questions;
create policy "Staff can insert open questions"
  on public.open_questions for insert
  to authenticated
  with check (
    public.is_project_staff()
    and created_by = auth.uid()
  );

drop policy if exists "Staff can update open questions" on public.open_questions;
create policy "Staff can update open questions"
  on public.open_questions for update
  to authenticated
  using (public.is_project_staff())
  with check (public.is_project_staff());

drop policy if exists "Staff can delete open questions" on public.open_questions;
create policy "Staff can delete open questions"
  on public.open_questions for delete
  to authenticated
  using (public.is_project_staff());

drop policy if exists "Public can read open question replies" on public.open_question_replies;
create policy "Public can read open question replies"
  on public.open_question_replies for select
  using (true);

drop policy if exists "Members can insert open question replies" on public.open_question_replies;
create policy "Members can insert open question replies"
  on public.open_question_replies for insert
  to authenticated
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
  );

drop policy if exists "Owners or staff can delete open question replies" on public.open_question_replies;
create policy "Owners or staff can delete open question replies"
  on public.open_question_replies for delete
  to authenticated
  using (user_id = auth.uid() or public.is_project_staff());

-- ---------------------------------------------------------------------------
-- Close note + suggestion supports (upvote)
-- ---------------------------------------------------------------------------
alter table public.open_questions
  add column if not exists close_note text;

comment on column public.open_questions.close_note is
  'Staff note explaining the final choice when the question is closed.';
comment on column public.open_questions.selected_reply_id is
  'Adopted suggestion (official decision). Staff judgment; need not be the top-ranked.';

create table if not exists public.open_question_supports (
  reply_id uuid not null references public.open_question_replies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

create index if not exists idx_open_question_supports_user
  on public.open_question_supports (user_id);

comment on table public.open_question_supports is
  'One support per user per Suggestion (top-level reply).';

create or replace function public.enforce_open_question_support()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent uuid;
  v_status text;
begin
  select r.parent_id, q.status
  into v_parent, v_status
  from public.open_question_replies r
  join public.open_questions q on q.id = r.question_id
  where r.id = new.reply_id;

  if not found then
    raise exception 'Suggestion not found';
  end if;
  if v_parent is not null then
    raise exception 'Only Suggestions can be supported, not replies';
  end if;
  if v_status is distinct from 'open' then
    raise exception 'This question is closed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_open_question_support on public.open_question_supports;
create trigger trg_enforce_open_question_support
  before insert on public.open_question_supports
  for each row
  execute function public.enforce_open_question_support();

grant select on table public.open_question_supports to anon, authenticated;
grant insert, delete on table public.open_question_supports to authenticated;

alter table public.open_question_supports enable row level security;

drop policy if exists "Public can read open question supports" on public.open_question_supports;
create policy "Public can read open question supports"
  on public.open_question_supports for select
  using (true);

drop policy if exists "Members can insert open question supports" on public.open_question_supports;
create policy "Members can insert open question supports"
  on public.open_question_supports for insert
  to authenticated
  with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Members can delete own open question supports" on public.open_question_supports;
create policy "Members can delete own open question supports"
  on public.open_question_supports for delete
  to authenticated
  using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'open_questions_close_note_len'
  ) then
    alter table public.open_questions
      add constraint open_questions_close_note_len
      check (close_note is null or char_length(close_note) <= 500);
  end if;
end $$;

-- Closing requires a short staff note. Adopted row must be a Suggestion on this question.
create or replace function public.enforce_open_question_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent uuid;
  v_qid uuid;
begin
  if new.status = 'closed' then
    if char_length(trim(coalesce(new.close_note, ''))) < 8 then
      raise exception 'Add a short note explaining the final choice';
    end if;
  end if;

  if new.selected_reply_id is not null then
    select parent_id, question_id
      into v_parent, v_qid
    from public.open_question_replies
    where id = new.selected_reply_id;

    if not found then
      raise exception 'Suggestion not found';
    end if;
    if v_qid is distinct from new.id then
      raise exception 'Adopted suggestion must belong to this question';
    end if;
    if v_parent is not null then
      raise exception 'Only a Suggestion can be adopted, not a reply';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_open_question_decision on public.open_questions;
create trigger trg_enforce_open_question_decision
  before insert or update on public.open_questions
  for each row
  execute function public.enforce_open_question_decision();

