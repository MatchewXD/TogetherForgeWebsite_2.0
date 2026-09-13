-- Open Questions: optional project, plus Early / Mid / Late Game (not fake sprint rows).
-- Safe to re-run.

alter table public.open_questions
  alter column project_id drop not null;

alter table public.open_questions
  add column if not exists related_to text;

comment on column public.open_questions.related_to is
  'Scope: null = no project; early|mid|late = game stage; otherwise a live project slug.';

update public.open_questions q
set related_to = case
  when p.slug in ('core-features') then 'mid'
  when p.slug in ('polish-playtests') then 'late'
  else p.slug
end
from public.projects p
where q.project_id = p.id
  and (q.related_to is null or btrim(q.related_to) = '');

update public.open_questions q
set project_id = null
from public.projects p
where q.project_id = p.id
  and p.slug in ('core-features', 'polish-playtests');

notify pgrst, 'reload schema';
