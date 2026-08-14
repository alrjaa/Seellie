-- Seellie · FIX-08 HARDENING
-- Paste AFTER SECURITY-PHASE4 (+ REFEREES-REPLACE) in SQL Editor.
-- Idempotent: create or replace only. No destructive data changes.
--
-- F08-S01  set_offer_status + upsert_offer_in_blob — only recipient may accept
-- F08-S02  append_gift_transaction — server derives amount/recipient/catalog
-- F08-S03  upsert_referee_in_blob — organizer or superadmin only

-- ═══════════════════════════════════════════════════════════
-- Helpers
-- ═══════════════════════════════════════════════════════════

create or replace function public.is_app_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'organizer'
        or p.active_role = 'organizer'
        or coalesce(p.roles, array[]::text[]) && array['organizer']::text[]
      )
  );
$$;

revoke all on function public.is_app_organizer() from public;
grant execute on function public.is_app_organizer() to authenticated;
grant execute on function public.is_app_organizer() to anon;

-- ═══════════════════════════════════════════════════════════
-- F08-S01 — Offers
-- ═══════════════════════════════════════════════════════════

create or replace function public.upsert_offer_in_blob(p_offer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing jsonb;
  list jsonb;
  oid text;
  rid text;
  found boolean := false;
  i int;
  item jsonb;
  next_list jsonb := '[]'::jsonb;
  incoming jsonb;
  keep_status text;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  perform public.assert_account_active();
  if p_offer is null or jsonb_typeof(p_offer) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_offer');
  end if;

  rid := coalesce(p_offer->>'id', '');
  oid := coalesce(p_offer->>'organizerId', '');
  if rid = '' or oid = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;
  if oid <> me::text and not public.is_app_superadmin() then
    return jsonb_build_object('ok', false, 'error', 'not_organizer');
  end if;

  -- Organizers must not forge acceptance via upsert; status changes use set_offer_status.
  incoming := p_offer - 'status';

  select payload into existing from public.app_blobs where key = 'offers' for update;
  list := coalesce(existing, '[]'::jsonb);
  if jsonb_typeof(list) <> 'array' then
    list := '[]'::jsonb;
  end if;

  for i in 0 .. greatest(jsonb_array_length(list) - 1, -1) loop
    item := list -> i;
    if item->>'id' = rid then
      if item->>'organizerId' is distinct from oid and not public.is_app_superadmin() then
        return jsonb_build_object('ok', false, 'error', 'offer_owner_mismatch');
      end if;
      keep_status := coalesce(item->>'status', 'pending');
      item := item || incoming;
      item := jsonb_set(item, '{status}', to_jsonb(keep_status));
      next_list := next_list || jsonb_build_array(item);
      found := true;
    else
      next_list := next_list || jsonb_build_array(item);
    end if;
  end loop;

  if not found then
    incoming := jsonb_set(incoming, '{status}', '"pending"'::jsonb);
    next_list := next_list || jsonb_build_array(incoming);
  end if;

  insert into public.app_blobs (key, payload, updated_at)
  values ('offers', next_list, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(next_list));
end;
$$;

revoke all on function public.upsert_offer_in_blob(jsonb) from public;
grant execute on function public.upsert_offer_in_blob(jsonb) to authenticated;

create or replace function public.set_offer_status(
  p_offer_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing jsonb;
  list jsonb;
  found boolean := false;
  i int;
  item jsonb;
  next_list jsonb := '[]'::jsonb;
  is_recipient boolean;
  is_creator boolean;
  is_admin boolean;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  perform public.assert_account_active();
  if p_offer_id is null or p_offer_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_id');
  end if;
  if p_status is null or p_status not in ('accepted', 'declined', 'pending') then
    return jsonb_build_object('ok', false, 'error', 'bad_status');
  end if;

  is_admin := public.is_app_superadmin();

  select payload into existing from public.app_blobs where key = 'offers' for update;
  list := coalesce(existing, '[]'::jsonb);
  if jsonb_typeof(list) <> 'array' then
    list := '[]'::jsonb;
  end if;

  for i in 0 .. greatest(jsonb_array_length(list) - 1, -1) loop
    item := list -> i;
    if item->>'id' = p_offer_id then
      is_recipient := item->>'freelancerId' = me::text;
      is_creator := item->>'organizerId' = me::text;

      if not is_recipient and not is_creator and not is_admin then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
      end if;

      -- F08-S01: only recipient (freelancer) or superadmin may accept
      if p_status = 'accepted' and not is_recipient and not is_admin then
        return jsonb_build_object('ok', false, 'error', 'only_recipient_can_accept');
      end if;

      -- Recipient may accept/decline; creator may withdraw (declined); admin any
      if p_status = 'declined' and not is_recipient and not is_creator and not is_admin then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
      end if;

      -- Reset to pending: admin only
      if p_status = 'pending' and not is_admin then
        return jsonb_build_object('ok', false, 'error', 'admin_pending_only');
      end if;

      item := jsonb_set(item, '{status}', to_jsonb(p_status));
      next_list := next_list || jsonb_build_array(item);
      found := true;
    else
      next_list := next_list || jsonb_build_array(item);
    end if;
  end loop;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.app_blobs (key, payload, updated_at)
  values ('offers', next_list, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_offer_status(text, text) from public;
grant execute on function public.set_offer_status(text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- F08-S02 — Gifts
-- ═══════════════════════════════════════════════════════════

create or replace function public.append_gift_transaction(p_gift jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing jsonb;
  gift_id text;
  next_payload jsonb;
  levels jsonb;
  level jsonb;
  cert_type text;
  catalog_price numeric;
  client_amount numeric;
  recipient_id text;
  recipient_uuid uuid;
  recipient_row public.profiles%rowtype;
  gifter_row public.profiles%rowtype;
  recipient_type text;
  allowed_types text[] := array['organizer', 'team', 'player', 'freelancer', 'follower'];
  sanitized jsonb;
  i int;
  found_level boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();

  if p_gift is null or jsonb_typeof(p_gift) <> 'object' then
    raise exception 'invalid gift payload';
  end if;

  gift_id := coalesce(p_gift->>'id', '');
  if gift_id = '' then
    raise exception 'gift id required';
  end if;

  -- Ownership: gifter must be caller (reject forged ownership)
  if coalesce(p_gift->>'gifterId', '') <> '' 
     and p_gift->>'gifterId' is distinct from auth.uid()::text then
    raise exception 'gifter must match authenticated user';
  end if;

  if not public.check_rate_limit('gift_append', 20, 60) then
    raise exception 'rate_limited';
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

  -- Idempotent retry: same id already present
  if exists (
    select 1
    from jsonb_array_elements(existing) e
    where e->>'id' = gift_id
  ) then
    return existing;
  end if;

  cert_type := trim(coalesce(p_gift->>'certificateType', ''));
  if cert_type = '' then
    raise exception 'certificate_type_required';
  end if;

  -- Catalog from support_levels blob (authoritative prices)
  select payload into levels from public.app_blobs where key = 'support_levels';
  if levels is not null and jsonb_typeof(levels) = 'array' then
    for i in 0 .. greatest(jsonb_array_length(levels) - 1, -1) loop
      level := levels -> i;
      if trim(coalesce(level->>'name', '')) = cert_type then
        catalog_price := coalesce((level->>'price')::numeric, 0);
        found_level := true;
        exit;
      end if;
    end loop;
  end if;

  -- Fallback built-in catalog (matches initial client seed) when blob empty
  if not found_level then
    case cert_type
      when 'إبداع' then catalog_price := 5; found_level := true;
      when 'برونزي' then catalog_price := 10; found_level := true;
      when 'فضي' then catalog_price := 25; found_level := true;
      when 'ذهبي' then catalog_price := 50; found_level := true;
      when 'ماسي' then catalog_price := 100; found_level := true;
      else found_level := false;
    end case;
  end if;

  if not found_level or catalog_price is null or catalog_price < 0 then
    raise exception 'unknown_certificate_type';
  end if;

  if p_gift ? 'amountPaid' then
    begin
      client_amount := (p_gift->>'amountPaid')::numeric;
    exception when others then
      raise exception 'forged_amount';
    end;
    if client_amount is distinct from catalog_price then
      raise exception 'forged_amount';
    end if;
  end if;

  recipient_id := trim(coalesce(p_gift->>'recipientId', ''));
  if recipient_id = '' then
    raise exception 'recipient_required';
  end if;
  if recipient_id = auth.uid()::text then
    raise exception 'cannot_gift_self';
  end if;

  begin
    recipient_uuid := recipient_id::uuid;
  exception when others then
    raise exception 'invalid_recipient';
  end;

  select * into recipient_row from public.profiles where id = recipient_uuid;
  if not found then
    raise exception 'recipient_not_found';
  end if;
  if coalesce(recipient_row.status, 'active') in ('suspended', 'banned', 'deleted') then
    raise exception 'recipient_inactive';
  end if;

  select * into gifter_row from public.profiles where id = auth.uid();

  recipient_type := coalesce(nullif(trim(p_gift->>'recipientType'), ''), recipient_row.role, 'follower');
  if not (recipient_type = any (allowed_types)) then
    raise exception 'bad_recipient_type';
  end if;

  sanitized := jsonb_build_object(
    'id', gift_id,
    'certificateNumber', coalesce(nullif(trim(p_gift->>'certificateNumber'), ''), 'SUP-000000'),
    'gifterId', auth.uid()::text,
    'gifterName', coalesce(gifter_row.name, p_gift->>'gifterName', ''),
    'gifterVisibleId', coalesce(gifter_row.visible_id, gifter_row.handle, p_gift->>'gifterVisibleId'),
    'recipientId', recipient_uuid::text,
    'recipientName', coalesce(recipient_row.name, p_gift->>'recipientName', ''),
    'recipientType', recipient_type,
    'recipientVisibleId', coalesce(recipient_row.visible_id, recipient_row.handle, p_gift->>'recipientVisibleId'),
    'certificateType', cert_type,
    'amountPaid', catalog_price,
    'timestamp', coalesce(p_gift->>'timestamp', now()::text),
    'status', 'pending_demo'
  );

  next_payload := jsonb_build_array(sanitized) || existing;

  insert into public.app_blobs (key, payload, updated_at)
  values ('gift_transactions', next_payload, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = excluded.updated_at;

  return next_payload;
end;
$$;

revoke all on function public.append_gift_transaction(jsonb) from public;
grant execute on function public.append_gift_transaction(jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- F08-S03 — Referees (organizer or superadmin)
-- ═══════════════════════════════════════════════════════════

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
  perform public.assert_account_active();

  if not public.is_app_superadmin() and not public.is_app_organizer() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_referee is null or jsonb_typeof(p_referee) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_referee');
  end if;

  rid := coalesce(p_referee->>'id', '');
  if rid = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_id');
  end if;

  select payload into existing from public.app_blobs where key = 'referees' for update;
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
