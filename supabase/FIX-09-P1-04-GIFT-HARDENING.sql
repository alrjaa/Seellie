-- Seellie · FIX-09 P1-04 — Gift ledger spam & integrity hardening
-- Paste AFTER FIX-08-HARDENING.sql (and FIX-09 P0 if applied).
-- Idempotent: create or replace only. No DELETE / TRUNCATE / DROP TABLE.
--
-- F09-P1-04-A  Server-generated gift transaction id
-- F09-P1-04-B  Stricter uid-based rate limit + per-gifter cap in blob
-- F09-P1-04-C  Max gift_transactions array length
-- F09-P1-04-D  Idempotency via id OR clientRequestId (before rate burn)
-- F09-P1-04-E  Preserves FIX-08 amount/recipient/gifter/catalog/pending_demo

create or replace function public.append_gift_transaction(p_gift jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing jsonb;
  gift_id text;
  client_key text;
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
  found_existing jsonb;
  ledger_count int;
  gifter_count int;
  -- Caps (server-side, uid / ledger based — not client gift id)
  max_ledger int := 5000;
  max_per_gifter int := 200;
  rate_max int := 5;
  rate_window int := 60;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();

  if p_gift is null or jsonb_typeof(p_gift) <> 'object' then
    raise exception 'invalid gift payload';
  end if;

  -- Ownership: gifter must be caller (reject forged ownership) — FIX-08
  if coalesce(p_gift->>'gifterId', '') <> ''
     and p_gift->>'gifterId' is distinct from auth.uid()::text then
    raise exception 'gifter must match authenticated user';
  end if;

  -- Idempotency key from client (optional). Never trusted as the stored primary id
  -- for new rows; only used to detect retries. Changing this key alone still hits caps.
  client_key := nullif(
    trim(coalesce(p_gift->>'clientRequestId', p_gift->>'id', '')),
    ''
  );

  select payload into existing
  from public.app_blobs
  where key = 'gift_transactions'
  for update;

  if existing is null then
    existing := '[]'::jsonb;
  elsif jsonb_typeof(existing) <> 'array' then
    existing := '[]'::jsonb;
  end if;

  -- Idempotent retry BEFORE rate limit (same key → no duplicate, no rate burn)
  if client_key is not null then
    select e
    into found_existing
    from jsonb_array_elements(existing) e
    where e->>'id' = client_key
       or e->>'clientRequestId' = client_key
    limit 1;

    if found_existing is not null then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'gift', found_existing,
        'count', jsonb_array_length(existing)
      );
    end if;
  end if;

  -- F09-P1-04-B: uid-based rate (security_events) — tighter than FIX-08 20/60
  if not public.check_rate_limit('gift_append', rate_max, rate_window) then
    raise exception 'rate_limited';
  end if;

  ledger_count := coalesce(jsonb_array_length(existing), 0);
  if ledger_count >= max_ledger then
    raise exception 'gift_ledger_full';
  end if;

  select count(*)::int into gifter_count
  from jsonb_array_elements(existing) e
  where e->>'gifterId' = auth.uid()::text;

  if gifter_count >= max_per_gifter then
    raise exception 'gifter_quota_exceeded';
  end if;

  cert_type := trim(coalesce(p_gift->>'certificateType', ''));
  if cert_type = '' then
    raise exception 'certificate_type_required';
  end if;

  -- Catalog from support_levels blob (authoritative prices) — FIX-08
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

  -- F09-P1-04-A: server-generated primary id (client cannot mint ledger identity)
  gift_id := 'gift_' || replace(gen_random_uuid()::text, '-', '');

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

  if client_key is not null then
    sanitized := jsonb_set(sanitized, '{clientRequestId}', to_jsonb(client_key), true);
  end if;

  next_payload := jsonb_build_array(sanitized) || existing;

  insert into public.app_blobs (key, payload, updated_at)
  values ('gift_transactions', next_payload, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'gift', sanitized,
    'count', jsonb_array_length(next_payload)
  );
end;
$$;

revoke all on function public.append_gift_transaction(jsonb) from public;
grant execute on function public.append_gift_transaction(jsonb) to authenticated;
