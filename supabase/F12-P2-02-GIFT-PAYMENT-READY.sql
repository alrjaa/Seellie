-- Seellie · F12-P2-02 — Gift / Appreciation payment-ready ledger
-- Paste AFTER FIX-09-P1-04-GIFT-HARDENING.sql (idempotent create or replace).
-- No DELETE / TRUNCATE / DROP TABLE / data rewrite.
--
-- Changes vs F09-P1-04:
--   * New rows: status = awaiting_payment (NOT pending_demo)
--   * Reject client-forced paid / issued / refunded
--   * Reject client-forced certificateStatus = issued
--   * Ignore client certificateNumber / timestamp (server authoritative)
--   * Persist appreciationKind, certificateStatus, certificateTier, reason
--   * Prefer profiles.role for recipientType
--   * Preserve rate limit, caps, idempotency, catalog amount checks

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
  catalog_kind text;
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
  max_ledger int := 5000;
  max_per_gifter int := 200;
  rate_max int := 5;
  rate_window int := 60;
  appreciation_kind text;
  certificate_status text;
  certificate_tier int;
  reason_text text;
  client_status text;
  client_cert_status text;
  server_now text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();

  if p_gift is null or jsonb_typeof(p_gift) <> 'object' then
    raise exception 'invalid gift payload';
  end if;

  -- Ownership: gifter must be caller
  if coalesce(p_gift->>'gifterId', '') <> ''
     and p_gift->>'gifterId' is distinct from auth.uid()::text then
    raise exception 'gifter must match authenticated user';
  end if;

  -- Reject forged terminal / paid states from client
  client_status := lower(trim(coalesce(p_gift->>'status', '')));
  if client_status in ('paid', 'issued', 'refunded') then
    raise exception 'forged_status';
  end if;
  client_cert_status := lower(trim(coalesce(p_gift->>'certificateStatus', '')));
  if client_cert_status = 'issued' then
    raise exception 'forged_certificate_status';
  end if;

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

  select payload into levels from public.app_blobs where key = 'support_levels';
  if levels is not null and jsonb_typeof(levels) = 'array' then
    for i in 0 .. greatest(jsonb_array_length(levels) - 1, -1) loop
      level := levels -> i;
      if trim(coalesce(level->>'name', '')) = cert_type then
        catalog_price := coalesce((level->>'price')::numeric, 0);
        catalog_kind := lower(trim(coalesce(level->>'kind', '')));
        found_level := true;
        exit;
      end if;
    end loop;
  end if;

  if not found_level then
    case cert_type
      when 'إبداع' then catalog_price := 5; catalog_kind := 'gift'; found_level := true;
      when 'برونزي' then catalog_price := 10; catalog_kind := 'gift'; found_level := true;
      when 'فضي' then catalog_price := 25; catalog_kind := 'gift'; found_level := true;
      when 'ذهبي' then catalog_price := 50; catalog_kind := 'gift'; found_level := true;
      when 'ماسي' then catalog_price := 100; catalog_kind := 'gift'; found_level := true;
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
  if p_gift ? 'amount' then
    begin
      client_amount := (p_gift->>'amount')::numeric;
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

  -- Prefer profile role over client claim
  recipient_type := coalesce(nullif(trim(recipient_row.role), ''), 'follower');
  if not (recipient_type = any (allowed_types)) then
    recipient_type := 'follower';
  end if;

  if catalog_kind in ('gift', 'certificate') then
    appreciation_kind := catalog_kind;
  elsif catalog_price >= 200 then
    appreciation_kind := 'certificate';
  else
    appreciation_kind := 'gift';
  end if;

  if appreciation_kind = 'certificate' then
    certificate_status := 'awaiting_payment';
    if catalog_price >= 200 then
      certificate_tier := floor((catalog_price - 200) / 200)::int + 1;
    else
      certificate_tier := 1;
    end if;
  else
    certificate_status := null;
    certificate_tier := null;
  end if;

  reason_text := nullif(left(trim(coalesce(p_gift->>'reason', '')), 500), '');

  gift_id := 'gift_' || replace(gen_random_uuid()::text, '-', '');
  server_now := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  -- Official certificateNumber is minted only after paid→issued (future RPC).
  -- New intents store empty string — never trust client SUP-######.
  sanitized := jsonb_build_object(
    'id', gift_id,
    'certificateNumber', '',
    'gifterId', auth.uid()::text,
    'gifterName', coalesce(gifter_row.name, p_gift->>'gifterName', ''),
    'gifterVisibleId', coalesce(gifter_row.visible_id, gifter_row.handle, p_gift->>'gifterVisibleId'),
    'recipientId', recipient_uuid::text,
    'recipientName', coalesce(recipient_row.name, p_gift->>'recipientName', ''),
    'recipientType', recipient_type,
    'recipientVisibleId', coalesce(recipient_row.visible_id, recipient_row.handle, p_gift->>'recipientVisibleId'),
    'certificateType', cert_type,
    'amountPaid', catalog_price,
    'timestamp', server_now,
    'createdAt', server_now,
    'status', 'awaiting_payment',
    'appreciationKind', appreciation_kind
  );

  if certificate_status is not null then
    sanitized := jsonb_set(sanitized, '{certificateStatus}', to_jsonb(certificate_status), true);
  end if;
  if certificate_tier is not null then
    sanitized := jsonb_set(sanitized, '{certificateTier}', to_jsonb(certificate_tier), true);
  end if;
  if reason_text is not null then
    sanitized := jsonb_set(sanitized, '{reason}', to_jsonb(reason_text), true);
  end if;

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

-- FUTURE (not created now): mark_gift_paid / issue_appreciation_certificate
-- pending|awaiting_payment → paid → issued with server-minted certificateNumber.
