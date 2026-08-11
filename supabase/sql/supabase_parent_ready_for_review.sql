-- Together Forge: when all direct children are Completed, move parent to InReview
-- (Ready for Review). Staff must still call complete_task to mark parent Completed.
-- Safe to re-run.
--
-- Applies to Mediums (all Smalls Completed) and Epics (all Mediums Completed).

create or replace function public.sync_parent_ready_for_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_id uuid;
  v_grandparent_id uuid;
  v_total integer;
  v_done integer;
begin
  v_parent_id := coalesce(new.parent_task_id, old.parent_task_id);
  if v_parent_id is null then
    return coalesce(new, old);
  end if;

  select
    count(*)::integer,
    count(*) filter (where status = 'Completed')::integer
  into v_total, v_done
  from tasks
  where parent_task_id = v_parent_id;

  if v_total is null or v_total = 0 then
    return coalesce(new, old);
  end if;

  if v_done = v_total then
    -- All direct children Completed → parent Ready for Review (not Completed)
    update tasks
    set status = 'InReview'
    where id = v_parent_id
      and status is distinct from 'Completed'
      and status is distinct from 'InReview';
  else
    -- A child left Completed → parent should not stay in review unless staff
    -- is reviewing a claim on the parent itself.
    update tasks t
    set status = case
      when exists (
        select 1 from task_claims tc
        where tc.task_id = t.id and tc.status = 'Active'
      ) then 'InProgress'
      else 'ToDo'
    end
    where t.id = v_parent_id
      and t.status = 'InReview'
      and not exists (
        select 1 from task_claims tc
        where tc.task_id = t.id and tc.status = 'PendingReview'
      );
  end if;

  -- Bubble: if parent was just staff-Completed, re-evaluate grandparent
  select parent_task_id into v_grandparent_id
  from tasks where id = v_parent_id;

  if v_grandparent_id is not null then
    select
      count(*)::integer,
      count(*) filter (where status = 'Completed')::integer
    into v_total, v_done
    from tasks
    where parent_task_id = v_grandparent_id;

    if v_total > 0 and v_done = v_total then
      update tasks
      set status = 'InReview'
      where id = v_grandparent_id
        and status is distinct from 'Completed'
        and status is distinct from 'InReview';
    elsif v_total > 0 and v_done < v_total then
      update tasks t
      set status = case
        when exists (
          select 1 from task_claims tc
          where tc.task_id = t.id and tc.status = 'Active'
        ) then 'InProgress'
        else 'ToDo'
      end
      where t.id = v_grandparent_id
        and t.status = 'InReview'
        and not exists (
          select 1 from task_claims tc
          where tc.task_id = t.id and tc.status = 'PendingReview'
        );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_parent_ready_for_review on tasks;
create trigger trg_sync_parent_ready_for_review
  after insert or update of status, parent_task_id or delete
  on tasks
  for each row
  execute function public.sync_parent_ready_for_review();

comment on function public.sync_parent_ready_for_review is
  'When all direct children are Completed, set parent to InReview. Staff complete_task still required for parent Completed.';
