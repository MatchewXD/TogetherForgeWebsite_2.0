-- When staff hide an Open Question reply, write an inbox row for the author.
-- Does not depend on the client. Safe to re-run.

create or replace function public.trg_oq_hidden_reply_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if new.hidden_at is null or new.user_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.hidden_at is not null
     and old.hidden_note is not distinct from new.hidden_note then
    return new;
  end if;

  select coalesce(nullif(btrim(title), ''), 'Open Question')
    into v_title
  from public.open_questions
  where id = new.question_id;

  insert into public.dashboard_notices (
    user_id, kind, title, body, href, source_id
  ) values (
    new.user_id,
    'oq_hide',
    coalesce(v_title, 'Open Question'),
    coalesce(nullif(btrim(new.hidden_note), ''), 'Staff hid this reply as off-brief.'),
    '/questions/' || new.question_id::text || '/answers/' || new.id::text,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_oq_hidden_reply_notice on public.open_question_replies;
create trigger trg_oq_hidden_reply_notice
  after insert or update of hidden_at, hidden_note
  on public.open_question_replies
  for each row
  execute function public.trg_oq_hidden_reply_notice();

-- Unread inbox row for every currently hidden reply (new id, so old dismissals do not hide it).
insert into public.dashboard_notices (
  user_id, kind, title, body, href, source_id
)
select
  r.user_id,
  'oq_hide',
  coalesce(nullif(btrim(q.title), ''), 'Open Question'),
  coalesce(nullif(btrim(r.hidden_note), ''), 'Staff hid this reply as off-brief.'),
  '/questions/' || r.question_id::text || '/answers/' || r.id::text,
  r.id
from public.open_question_replies r
left join public.open_questions q on q.id = r.question_id
where r.hidden_at is not null
  and r.user_id is not null
  and not exists (
    select 1
    from public.dashboard_notices n
    where n.source_id = r.id
      and n.kind = 'oq_hide'
      and n.user_id = r.user_id
      and n.dismissed_at is null
  );

notify pgrst, 'reload schema';
