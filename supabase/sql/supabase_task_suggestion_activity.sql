-- =============================================================================
-- Credit the author in Recent Activity when staff accept a task suggestion.
-- Safe to re-run.
-- =============================================================================

create or replace function public.log_accepted_task_suggestion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.activity_log (
      project_id,
      user_id,
      action,
      target_type,
      target_id,
      target_title,
      metadata
    ) values (
      new.project_id,
      new.created_by,
      'suggested_task',
      'task_suggestion',
      new.id,
      new.title,
      jsonb_build_object(
        'accepted_task_id', new.accepted_task_id,
        'reviewed_by', new.reviewed_by
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_accepted_task_suggestion on public.task_suggestions;
create trigger trg_log_accepted_task_suggestion
  after update of status on public.task_suggestions
  for each row
  execute function public.log_accepted_task_suggestion();

comment on function public.log_accepted_task_suggestion() is
  'When a volunteer suggestion is accepted, credit the author in activity_log.';

notify pgrst, 'reload schema';
