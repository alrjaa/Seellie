-- Seellie · replace/delete referees blob (superadmin)
-- Paste AFTER SECURITY-PHASE3 / PHASE4
-- Needed so admin delete/dedupe actually removes names from cloud
-- (otherwise organizers keep seeing duplicates after hydrate).

create or replace function public.replace_referees_blob(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if not public.is_app_superadmin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_items');
  end if;

  insert into public.app_blobs (key, payload, updated_at)
  values ('referees', p_items, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(p_items));
end;
$$;

revoke all on function public.replace_referees_blob(jsonb) from public;
grant execute on function public.replace_referees_blob(jsonb) to authenticated;

create or replace function public.delete_referee_from_blob(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing jsonb;
  next_list jsonb := '[]'::jsonb;
  item jsonb;
  i int;
  rid text := coalesce(p_id, '');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if not public.is_app_superadmin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if rid = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_id');
  end if;

  select payload into existing from public.app_blobs where key = 'referees' for update;
  if existing is null or jsonb_typeof(existing) <> 'array' then
    return jsonb_build_object('ok', true, 'count', 0);
  end if;

  for i in 0 .. greatest(jsonb_array_length(existing) - 1, -1) loop
    item := existing -> i;
    if item->>'id' is distinct from rid then
      next_list := next_list || jsonb_build_array(item);
    end if;
  end loop;

  insert into public.app_blobs (key, payload, updated_at)
  values ('referees', next_list, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(next_list));
end;
$$;

revoke all on function public.delete_referee_from_blob(text) from public;
grant execute on function public.delete_referee_from_blob(text) to authenticated;

select 'referees replace/delete RPC ready' as status;
