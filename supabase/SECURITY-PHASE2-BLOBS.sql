-- Seellie · SECURITY-PHASE2-BLOBS
-- Paste in SQL Editor AFTER SECURITY-PHASE1.sql
--
-- Goal: stop any authenticated user from overwriting the shared
-- `gift_transactions` blob (full replace), while keeping purchase working
-- via append-only RPC.
--
-- Remaining risks (documented, not changed here):
--   • `offers` — still writable by any authenticated user (organizers need
--     to send/update offers; freelancers accept/decline). A safer model later
--     would be per-organizer keys or an RPC that validates organizerId.
--   • `announcements:{uid}` / `prizes:{uid}` — already scoped to owner or
--     superadmin in PHASE1 (do not tighten further).
--   • `referees` / `support_levels` / `app_branding` — superadmin-only writes
--     via PHASE1 (is_app_superadmin).

-- 1) Append-only gift purchase (caller must be the gifter)
create or replace function public.append_gift_transaction(p_gift jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing jsonb;
  gifter text;
  gift_id text;
  next_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_gift is null or jsonb_typeof(p_gift) <> 'object' then
    raise exception 'invalid gift payload';
  end if;

  gifter := coalesce(p_gift->>'gifterId', '');
  gift_id := coalesce(p_gift->>'id', '');

  if gift_id = '' then
    raise exception 'gift id required';
  end if;

  if gifter <> auth.uid()::text then
    raise exception 'gifter must match authenticated user';
  end if;

  select payload into existing
  from public.app_blobs
  where key = 'gift_transactions'
  for update;

  if existing is null then
    existing := '[]'::jsonb;
  elsif jsonb_typeof(existing) <> 'array' then
    existing := '[]'::jsonb;
  end if;

  -- idempotent: skip if same id already present
  if exists (
    select 1
    from jsonb_array_elements(existing) e
    where e->>'id' = gift_id
  ) then
    return existing;
  end if;

  next_payload := jsonb_build_array(p_gift) || existing;

  insert into public.app_blobs (key, payload, updated_at)
  values ('gift_transactions', next_payload, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = excluded.updated_at;

  return next_payload;
end;
$$;

grant execute on function public.append_gift_transaction(jsonb) to authenticated;

-- Superadmin may still replace / repair the full gift ledger
create or replace function public.replace_gift_transactions(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_app_superadmin() then
    raise exception 'superadmin only';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a json array';
  end if;

  insert into public.app_blobs (key, payload, updated_at)
  values ('gift_transactions', p_items, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.replace_gift_transactions(jsonb) to authenticated;

-- 2) Drop open gift_transactions writes from PHASE1 policies
--    (offers stay open for organizer purchase/accept flows)
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
    or key = 'offers'
  );

create policy "app_blobs_update_scoped"
  on public.app_blobs for update
  to authenticated
  using (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
    or key = 'offers'
  )
  with check (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
    or key = 'offers'
  );

create policy "app_blobs_delete_scoped"
  on public.app_blobs for delete
  to authenticated
  using (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
  );

-- Client: call append_gift_transaction on purchase (see supabase-app-blobs.ts).
-- Do NOT upsertAppBlob('gift_transactions', ...) from regular users after this patch.
