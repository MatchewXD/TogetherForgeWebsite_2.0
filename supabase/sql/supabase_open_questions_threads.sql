-- =============================================================================
-- Open Questions — true comment threads
-- Allow a reply on a Suggestion or on another reply (same question).
-- Votes stay on Suggestions only.
-- Safe to re-run.
-- =============================================================================

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
    if new.id is not null and new.parent_id = new.id then
      raise exception 'A reply cannot be its own parent';
    end if;

    select * into v_parent
    from public.open_question_replies
    where id = new.parent_id;

    if not found then
      raise exception 'Reply not found';
    end if;
    if v_parent.question_id is distinct from new.question_id then
      raise exception 'Reply must belong to the same question';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_open_question_reply() is
  'Open questions only. Parent may be a Suggestion or any nested comment on the same question.';
