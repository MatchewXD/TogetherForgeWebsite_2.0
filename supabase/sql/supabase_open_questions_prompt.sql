-- Open Questions staff prompt (Ideas-style fields).
-- context, question detail, should-fit / should-not-fit, additional info.
-- Safe to re-run.

alter table public.open_questions
  add column if not exists prompt jsonb;

comment on column public.open_questions.prompt is
  'Staff prompt: context, questionDetail, shouldFit, shouldNotFit, additional.';
