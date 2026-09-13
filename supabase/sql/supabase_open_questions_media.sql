-- Open Questions: up to 3 images per question/reply, optional closes_at,
-- staff hide for off-brief replies. Safe to re-run.

alter table public.open_questions
  add column if not exists image_urls text[] not null default '{}'::text[];

alter table public.open_questions
  add column if not exists closes_at timestamptz;

alter table public.open_question_replies
  add column if not exists image_urls text[] not null default '{}'::text[];

alter table public.open_question_replies
  add column if not exists hidden_at timestamptz;

alter table public.open_question_replies
  add column if not exists hidden_by uuid references auth.users(id) on delete set null;

comment on column public.open_questions.image_urls is
  'Up to 3 public image URLs on the staff brief.';
comment on column public.open_questions.closes_at is
  'Optional. When set, the question stops new replies at this time. Staff may close early. No auto-reopen.';
comment on column public.open_questions.selected_reply_id is
  'Staff-picked reply. Shown at the top. Does not delete other replies.';
comment on column public.open_question_replies.image_urls is
  'Up to 3 public image URLs on a member reply.';
comment on column public.open_question_replies.hidden_at is
  'Staff hide for off-brief work. Not a public shame label.';

alter table public.open_questions
  drop constraint if exists open_questions_image_urls_len;
alter table public.open_questions
  add constraint open_questions_image_urls_len
  check (cardinality(image_urls) <= 3);

alter table public.open_question_replies
  drop constraint if exists open_question_replies_image_urls_len;
alter table public.open_question_replies
  add constraint open_question_replies_image_urls_len
  check (cardinality(image_urls) <= 3);

create or replace function public.close_expired_open_questions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
begin
  update public.open_questions
  set status = 'closed',
      closed_at = coalesce(closed_at, now())
  where status = 'open'
    and closes_at is not null
    and closes_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function public.close_expired_open_questions() to anon, authenticated;

create or replace function public.enforce_open_question_reply()
returns trigger
language plpgsql
as $$
declare
  v_q public.open_questions%rowtype;
  v_parent public.open_question_replies%rowtype;
begin
  perform public.close_expired_open_questions();

  select * into v_q from public.open_questions where id = new.question_id;
  if not found then
    raise exception 'Question not found';
  end if;

  if v_q.status is distinct from 'open' then
    raise exception 'This question is closed';
  end if;

  if cardinality(coalesce(new.image_urls, '{}'::text[])) > 3 then
    raise exception 'A post can have at most 3 images.';
  end if;

  if new.parent_id is not null then
    if new.id is not null and new.parent_id = new.id then
      raise exception 'A reply cannot be its own parent';
    end if;
    select * into v_parent from public.open_question_replies where id = new.parent_id;
    if not found then
      raise exception 'Reply not found';
    end if;
    if v_parent.question_id is distinct from new.question_id then
      raise exception 'Reply must belong to the same question';
    end if;
    if v_parent.hidden_at is not null then
      raise exception 'That reply is hidden';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_open_question_support()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reply public.open_question_replies%rowtype;
  v_status text;
  v_closes timestamptz;
begin
  perform public.close_expired_open_questions();

  select * into v_reply from public.open_question_replies where id = new.reply_id;
  if not found then
    raise exception 'Suggestion not found';
  end if;
  if v_reply.parent_id is not null then
    raise exception 'Only top-level answers can be voted';
  end if;
  if v_reply.hidden_at is not null then
    raise exception 'That reply is hidden';
  end if;

  select status, closes_at into v_status, v_closes
  from public.open_questions
  where id = v_reply.question_id;

  if v_status is distinct from 'open' then
    raise exception 'This question is closed';
  end if;

  return new;
end;
$$;

grant update on table public.open_question_replies to authenticated;

drop policy if exists "Public can read open question replies" on public.open_question_replies;
create policy "Public can read open question replies"
  on public.open_question_replies for select
  using (hidden_at is null or public.is_project_staff());

drop policy if exists "Staff can hide open question replies" on public.open_question_replies;
create policy "Staff can hide open question replies"
  on public.open_question_replies for update
  to authenticated
  using (public.is_project_staff())
  with check (public.is_project_staff());

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('question-images', 'question-images', true)
  on conflict (id) do update set public = true;
exception
  when others then
    raise notice 'storage.buckets insert skipped: %', sqlerrm;
end $$;

drop policy if exists "Public read question images" on storage.objects;
create policy "Public read question images"
  on storage.objects for select
  using (bucket_id = 'question-images');

drop policy if exists "Users can upload question images" on storage.objects;
create policy "Users can upload question images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'question-images'
    and auth.uid()::text = (storage.foldername(name))[1]
    and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif'))
  );

drop policy if exists "Users can update own question images" on storage.objects;
create policy "Users can update own question images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'question-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own question images" on storage.objects;
create policy "Users can delete own question images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'question-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Staff can delete question images" on storage.objects;
create policy "Staff can delete question images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'question-images'
    and public.is_project_staff()
  );

notify pgrst, 'reload schema';
