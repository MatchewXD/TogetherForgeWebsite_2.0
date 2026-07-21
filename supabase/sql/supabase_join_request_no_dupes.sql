-- =============================================================================
-- Block duplicate join requests on the same task/claim
-- Run in Supabase SQL Editor (safe to re-run)
-- =============================================================================

create or replace function public.request_join_claim(p_task_id uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_claim task_claims%rowtype;
  v_req claim_join_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in to request joining a claim';
  end if;

  select * into v_claim
  from task_claims
  where task_id = p_task_id and status = 'Active'
  limit 1;

  if not found then
    raise exception 'No active claim on this task';
  end if;

  if v_claim.user_id = v_uid then
    raise exception 'You already own this claim';
  end if;

  -- One pending request per claim
  select * into v_req
  from claim_join_requests
  where claim_id = v_claim.id and requester_id = v_uid and status = 'pending'
  limit 1;

  if found then
    raise exception 'You already have a pending join request on this task';
  end if;

  -- Already approved helper
  if exists (
    select 1 from claim_join_requests
    where claim_id = v_claim.id
      and requester_id = v_uid
      and status = 'approved'
  ) then
    raise exception 'You are already helping on this task';
  end if;

  if exists (
    select 1 from profiles p
    where p.id = v_uid
      and p.username is not null
      and v_claim.helpers is not null
      and (
        v_claim.helpers @> to_jsonb(p.username)
        or v_claim.helpers @> jsonb_build_array(jsonb_build_object('username', p.username))
      )
  ) then
    raise exception 'You are already helping on this task';
  end if;

  insert into claim_join_requests (claim_id, task_id, requester_id, message, status)
  values (v_claim.id, p_task_id, v_uid, nullif(trim(coalesce(p_message, '')), ''), 'pending')
  returning * into v_req;

  return jsonb_build_object('request', to_jsonb(v_req), 'already_pending', false);
end;
$$;

grant execute on function public.request_join_claim(uuid, text) to authenticated;
