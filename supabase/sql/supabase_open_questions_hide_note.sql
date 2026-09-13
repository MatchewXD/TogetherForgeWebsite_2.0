-- Staff hide note on Open Question replies.
-- Author can still read their own hidden reply (to see why).
-- Safe to re-run.

alter table public.open_question_replies
  add column if not exists hidden_note text;

comment on column public.open_question_replies.hidden_note is
  'Staff reason the reply was hidden. Shown to the author on the post and on their dashboard. Not a public shame label.';

alter table public.open_question_replies
  drop constraint if exists open_question_replies_hidden_note_len;
alter table public.open_question_replies
  add constraint open_question_replies_hidden_note_len
  check (hidden_note is null or char_length(hidden_note) <= 500);

drop policy if exists "Public can read open question replies" on public.open_question_replies;
create policy "Public can read open question replies"
  on public.open_question_replies for select
  using (
    hidden_at is null
    or user_id = auth.uid()
    or public.is_project_staff()
  );

notify pgrst, 'reload schema';
