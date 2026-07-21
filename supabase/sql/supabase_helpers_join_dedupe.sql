-- =============================================================================
-- Improve resolve_join_request: add helper as {username, user_id}, no duplicates
-- Run if you already applied supabase_claim_anti_hoarding.sql earlier
-- =============================================================================

create or replace function public.resolve_join_request(p_request_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req claim_join_requests%rowtype;
  v_claim task_claims%rowtype;
  v_helpers jsonb;
  v_profile profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_req from claim_join_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Request is already %', v_req.status;
  end if;

  select * into v_claim from task_claims where id = v_req.claim_id for update;
  if not found or v_claim.status <> 'Active' then
    raise exception 'Claim is no longer active';
  end if;

  -- Strict owner check (IS DISTINCT FROM avoids NULL bypass)
  if v_claim.user_id is distinct from v_uid
     and not coalesce(public.is_project_staff(), false) then
    raise exception 'Only the claim owner or staff can resolve this request';
  end if;

  update claim_join_requests set
    status = case when p_approve then 'approved' else 'rejected' end,
    resolved_at = now(),
    resolved_by = v_uid
  where id = p_request_id
  returning * into v_req;

  if p_approve then
    select * into v_profile from profiles where id = v_req.requester_id;
    v_helpers := case
      when v_claim.helpers is null then '[]'::jsonb
      when jsonb_typeof(v_claim.helpers) = 'array' then v_claim.helpers
      else '[]'::jsonb
    end;

    if v_profile.username is not null
       and not exists (
         select 1
         from jsonb_array_elements(v_helpers) elem
         where elem #>> '{}' = v_profile.username
            or elem->>'username' = v_profile.username
       )
    then
      v_helpers := v_helpers || jsonb_build_array(
        jsonb_build_object(
          'username', v_profile.username,
          'user_id', v_req.requester_id
        )
      );
    end if;

    update task_claims
    set helpers = v_helpers,
        last_activity_at = now()
    where id = v_claim.id
    returning * into v_claim;
  end if;

  return jsonb_build_object('request', to_jsonb(v_req), 'claim', to_jsonb(v_claim));
end;
$$;

grant execute on function public.resolve_join_request(uuid, boolean) to authenticated;
