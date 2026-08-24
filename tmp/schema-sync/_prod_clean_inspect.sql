select jsonb_build_object(
  'profiles', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'role', p.role,
      'joined_at', p.joined_at,
      'idea_count', (select count(*) from public.ideas i where i.user_id = p.id),
      'donation_count', (select count(*) from public.donations d where d.user_id = p.id),
      'task_claim_count', (select count(*) from public.task_claims c where c.user_id = p.id)
    ) order by p.username), '[]'::jsonb)
    from public.profiles p
  ),
  'auth_emails', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'created_at', u.created_at
    ) order by u.created_at), '[]'::jsonb)
    from auth.users u
  ),
  'projects', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', pr.id,
      'slug', pr.slug,
      'title', pr.title,
      'task_count', (select count(*) from public.tasks t where t.project_id = pr.id)
    ) order by pr.slug), '[]'::jsonb)
    from public.projects pr
  ),
  'tether_tasks', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'status', t.status,
      'parent_task_id', t.parent_task_id
    ) order by t.created_at), '[]'::jsonb)
    from public.tasks t
    join public.projects pr on pr.id = t.project_id
    where pr.slug = 'prototype-systems'
       or lower(pr.title) = 'tether'
  ),
  'donations', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id,
      'user_id', d.user_id,
      'display_name', d.display_name,
      'amount_cents', d.amount_cents,
      'status', d.status,
      'fund_type', d.fund_type,
      'is_anonymous', d.is_anonymous,
      'created_at', d.created_at
    ) order by d.created_at), '[]'::jsonb)
    from public.donations d
  ),
  'contributions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'display_name', c.display_name,
      'category', c.category,
      'project_id', c.project_id,
      'amount_cents', c.amount_cents,
      'user_id', c.user_id
    ) order by c.created_at), '[]'::jsonb)
    from public.project_contributions c
  ),
  'stripe_subscriptions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'user_id', s.user_id,
      'status', s.status,
      'amount_cents', s.amount_cents
    )), '[]'::jsonb)
    from public.stripe_subscriptions s
  )
) as inventory;
