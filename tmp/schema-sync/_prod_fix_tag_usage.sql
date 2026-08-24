create or replace function public.recompute_idea_tag_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  parts text[];
  part text;
  v_slug text;
  v_name text;
  touched integer := 0;
begin
  update public.idea_tags set usage_count = 0 where true;

  for r in
    select tags from public.ideas
    where tags is not null and length(trim(tags)) > 0
  loop
    parts := regexp_split_to_array(r.tags, '[,;#|]+');
    foreach part in array parts
    loop
      v_name := public.normalize_idea_tag_name(part);
      v_slug := public.normalize_idea_tag_slug(v_name);
      if v_slug is null then
        continue;
      end if;

      update public.idea_tags t
      set usage_count = t.usage_count + 1
      where t.slug = v_slug;

      if not found then
        insert into public.idea_tags (slug, name, status, usage_count)
        values (v_slug, v_name, 'suggested', 1)
        on conflict (slug) do update
          set usage_count = public.idea_tags.usage_count + 1;
      end if;

      touched := touched + 1;
    end loop;
  end loop;

  return touched;
end;
$$;

grant execute on function public.recompute_idea_tag_usage() to authenticated;
notify pgrst, 'reload schema';
