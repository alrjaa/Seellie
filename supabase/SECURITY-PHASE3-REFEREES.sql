-- Seellie · SECURITY-PHASE3-REFEREES
-- Paste in SQL Editor AFTER SECURITY-PHASE1.sql
--
-- Problem: PHASE1 made `referees` blob superadmin-only.
-- Organizers register referees + avatars, but upsertAppBlob('referees')
-- fails under RLS — photos never sync to the cloud.
--
-- Fix:
-- 1) Allow authenticated users to write the `referees` key (like offers).
-- 2) Provide upsert_referee_in_blob RPC for safer per-referee merges.

drop policy if exists "app_blobs_insert_scoped" on public.app_blobs;
drop policy if exists "app_blobs_update_scoped" on public.app_blobs;
drop policy if exists "app_blobs_delete_scoped" on public.app_blobs;

create policy "app_blobs_insert_scoped"
  on public.app_blobs for insert
  to authenticated
  with check (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
    or key in ('offers', 'gift_transactions', 'referees')
  );

create policy "app_blobs_update_scoped"
  on public.app_blobs for update
  to authenticated
  using (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
    or key in ('offers', 'gift_transactions', 'referees')
  )
  with check (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
    or key in ('offers', 'gift_transactions', 'referees')
  );

create policy "app_blobs_delete_scoped"
  on public.app_blobs for delete
  to authenticated
  using (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
  );

create or replace function public.upsert_referee_in_blob(p_referee jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing jsonb;
  list jsonb;
  rid text;
  found boolean := false;
  i int;
  item jsonb;
  prev_avatar text;
  next_avatar text;
  next_list jsonb := '[]'::jsonb;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_referee is null or jsonb_typeof(p_referee) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_referee');
  end if;

  rid := coalesce(p_referee->>'id', '');
  if rid = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_id');
  end if;

  select payload into existing from public.app_blobs where key = 'referees';
  list := coalesce(existing, '[]'::jsonb);
  if jsonb_typeof(list) <> 'array' then
    list := '[]'::jsonb;
  end if;

  for i in 0 .. greatest(jsonb_array_length(list) - 1, -1) loop
    item := list -> i;
    if item->>'id' = rid then
      prev_avatar := nullif(item->>'avatar', '');
      item := item || p_referee;
      next_avatar := nullif(item->>'avatar', '');
      if next_avatar is null and prev_avatar is not null then
        item := jsonb_set(item, '{avatar}', to_jsonb(prev_avatar));
      end if;
      next_list := next_list || jsonb_build_array(item);
      found := true;
    else
      next_list := next_list || jsonb_build_array(item);
    end if;
  end loop;

  if not found then
    next_list := next_list || jsonb_build_array(p_referee);
  end if;

  insert into public.app_blobs (key, payload, updated_at)
  values ('referees', next_list, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(next_list));
end;
$$;

revoke all on function public.upsert_referee_in_blob(jsonb) from public;
grant execute on function public.upsert_referee_in_blob(jsonb) to authenticated;
