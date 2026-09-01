-- Seellie · FIX-09 P0 HARDENING
-- Paste AFTER FIX-08-HARDENING.sql in SQL Editor.
-- Idempotent: create or replace only. No destructive data changes.
--
-- F09-S01  upsert_offer_in_blob — immutable identity fields after create
-- F09-S02  upsert_referee_in_blob — competition/owner scope (not global organizer)
-- F09-S03  profiles.content — lock analyst/permissions privilege fields

-- ═══════════════════════════════════════════════════════════
-- Helpers
-- ═══════════════════════════════════════════════════════════

create or replace function public.seellie_allow_privileged_content()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('seellie.allow_privileged_content', true), ''), '') = '1';
$$;

create or replace function public.organizer_owns_competition(p_competition_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_competition_id is not null
    and length(trim(p_competition_id)) > 0
    and exists (
      select 1
      from public.app_competitions c
      where c.id = trim(p_competition_id)
        and c.organizer_id = auth.uid()::text
    );
$$;

revoke all on function public.organizer_owns_competition(text) from public;
grant execute on function public.organizer_owns_competition(text) to authenticated;

-- Authoritative referee ownership ONLY: stamped ownerId on referees blob.
-- NEVER use app_competitions.payload.refereeIds (organizer-writable) for authz.
create or replace function public.organizer_controls_referee(p_referee_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_referee_id is not null
    and length(trim(p_referee_id)) > 0
    and exists (
      select 1
      from public.app_blobs b,
           lateral jsonb_array_elements(coalesce(b.payload, '[]'::jsonb)) ref
      where b.key = 'referees'
        and ref->>'id' = trim(p_referee_id)
        and ref->>'ownerId' = auth.uid()::text
    );
$$;

revoke all on function public.organizer_controls_referee(text) from public;
grant execute on function public.organizer_controls_referee(text) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- F09-S01 — Offers: immutable identity after create
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
  keep_freelancer text;
  keep_team text;
  keep_competition text;
  keep_organizer text;
  patch jsonb := '{}'::jsonb;
  allowed_keys text[] := array[
    'message',
    'note',
    'body',
    'timestamp',
    'expiresAt',
    'updatedAt'
  ];
  k text;
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

  -- Never accept client status via upsert (F08-S01 preserved)
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

      -- Reject identity rewrites (explicit errors for clients/tests)
      if incoming ? 'freelancerId'
         and coalesce(incoming->>'freelancerId', '')
            is distinct from coalesce(item->>'freelancerId', '') then
        return jsonb_build_object('ok', false, 'error', 'immutable_freelancerId');
      end if;
      if incoming ? 'teamId'
         and coalesce(incoming->>'teamId', '')
            is distinct from coalesce(item->>'teamId', '') then
        return jsonb_build_object('ok', false, 'error', 'immutable_teamId');
      end if;
      if incoming ? 'competitionId'
         and coalesce(incoming->>'competitionId', '')
            is distinct from coalesce(item->>'competitionId', '') then
        return jsonb_build_object('ok', false, 'error', 'immutable_competitionId');
      end if;
      if incoming ? 'organizerId'
         and coalesce(incoming->>'organizerId', '')
            is distinct from coalesce(item->>'organizerId', '') then
        return jsonb_build_object('ok', false, 'error', 'immutable_organizerId');
      end if;

      keep_status := coalesce(item->>'status', 'pending');
      keep_freelancer := item->>'freelancerId';
      keep_team := item->>'teamId';
      keep_competition := item->>'competitionId';
      keep_organizer := item->>'organizerId';

      -- Allowlist patch only (no open JSON merge)
      patch := '{}'::jsonb;
      foreach k in array allowed_keys loop
        if incoming ? k then
          patch := patch || jsonb_build_object(k, incoming -> k);
        end if;
      end loop;

      item := item || patch;
      item := jsonb_set(item, '{status}', to_jsonb(keep_status));
      if keep_freelancer is not null then
        item := jsonb_set(item, '{freelancerId}', to_jsonb(keep_freelancer));
      end if;
      if keep_team is not null then
        item := jsonb_set(item, '{teamId}', to_jsonb(keep_team));
      end if;
      if keep_competition is not null then
        item := jsonb_set(item, '{competitionId}', to_jsonb(keep_competition));
      end if;
      if keep_organizer is not null then
        item := jsonb_set(item, '{organizerId}', to_jsonb(keep_organizer));
      end if;

      next_list := next_list || jsonb_build_array(item);
      found := true;
    else
      next_list := next_list || jsonb_build_array(item);
    end if;
  end loop;

  if not found then
    -- Create: require identity fields; force pending status
    if coalesce(incoming->>'freelancerId', '') = ''
       or coalesce(incoming->>'teamId', '') = ''
       or coalesce(incoming->>'competitionId', '') = '' then
      return jsonb_build_object('ok', false, 'error', 'missing_identity_fields');
    end if;
    incoming := jsonb_set(incoming, '{status}', '"pending"'::jsonb);
    incoming := jsonb_set(incoming, '{organizerId}', to_jsonb(oid));
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

-- ═══════════════════════════════════════════════════════════
-- F09-S02 — Referees: competition / owner scope
-- ═══════════════════════════════════════════════════════════

create or replace function public.upsert_referee_in_blob(p_referee jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  is_admin boolean;
  existing jsonb;
  list jsonb;
  rid text;
  competition_id text;
  found boolean := false;
  i int;
  item jsonb;
  prev_avatar text;
  next_avatar text;
  keep_owner text;
  next_list jsonb := '[]'::jsonb;
  incoming jsonb;
  patch jsonb := '{}'::jsonb;
  allowed_keys text[] := array[
    'name',
    'role',
    'mobile',
    'city',
    'avatar',
    'rating',
    'status'
  ];
  k text;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  perform public.assert_account_active();

  is_admin := public.is_app_superadmin();

  if not is_admin and not public.is_app_organizer() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_referee is null or jsonb_typeof(p_referee) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_referee');
  end if;

  rid := coalesce(p_referee->>'id', '');
  if rid = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_id');
  end if;

  competition_id := nullif(trim(coalesce(p_referee->>'competitionId', '')), '');

  -- Strip ownership / scoping keys from client (server-controlled)
  incoming := p_referee - 'ownerId' - 'createdBy' - 'competitionId' - 'organizerId';

  select payload into existing from public.app_blobs where key = 'referees' for update;
  list := coalesce(existing, '[]'::jsonb);
  if jsonb_typeof(list) <> 'array' then
    list := '[]'::jsonb;
  end if;

  for i in 0 .. greatest(jsonb_array_length(list) - 1, -1) loop
    item := list -> i;
    if item->>'id' = rid then
      if not is_admin and not public.organizer_controls_referee(rid) then
        return jsonb_build_object('ok', false, 'error', 'referee_not_owned');
      end if;

      keep_owner := item->>'ownerId';
      prev_avatar := nullif(item->>'avatar', '');

      if is_admin then
        item := item || incoming;
      else
        patch := '{}'::jsonb;
        foreach k in array allowed_keys loop
          if incoming ? k then
            patch := patch || jsonb_build_object(k, incoming -> k);
          end if;
        end loop;
        item := item || patch;
      end if;

      next_avatar := nullif(item->>'avatar', '');
      if next_avatar is null and prev_avatar is not null then
        item := jsonb_set(item, '{avatar}', to_jsonb(prev_avatar));
      end if;

      -- Ownership immutable (even for admin payload forge of ownerId — already stripped;
      -- re-apply previous owner; stamp if missing and organizer controls)
      if keep_owner is not null and length(keep_owner) > 0 then
        item := jsonb_set(item, '{ownerId}', to_jsonb(keep_owner));
      elsif not is_admin then
        item := jsonb_set(item, '{ownerId}', to_jsonb(me::text));
      end if;

      next_list := next_list || jsonb_build_array(item);
      found := true;
    else
      next_list := next_list || jsonb_build_array(item);
    end if;
  end loop;

  if not found then
    if not is_admin then
      if competition_id is null then
        return jsonb_build_object('ok', false, 'error', 'competition_required');
      end if;
      if not public.organizer_owns_competition(competition_id) then
        return jsonb_build_object('ok', false, 'error', 'competition_not_owned');
      end if;
      incoming := jsonb_set(incoming, '{ownerId}', to_jsonb(me::text));
    else
      -- Superadmin create: optional ownerId left unset unless provided via trusted path
      null;
    end if;
    next_list := next_list || jsonb_build_array(incoming);
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

-- ═══════════════════════════════════════════════════════════
-- F09-S03 — Lock privileged profile content fields
-- ═══════════════════════════════════════════════════════════

create or replace function public.preserve_privileged_profile_content(
  old_content jsonb,
  new_content jsonb
)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb;
  old_perm jsonb;
  new_perm jsonb;
begin
  result := coalesce(new_content, '{}'::jsonb);
  if jsonb_typeof(result) <> 'object' then
    result := '{}'::jsonb;
  end if;

  -- Always preserve analyst object from old (RPCs use allow flag)
  if coalesce(old_content, '{}'::jsonb) ? 'analyst' then
    result := jsonb_set(
      result,
      '{analyst}',
      coalesce(old_content -> 'analyst', 'null'::jsonb),
      true
    );
  else
    result := result - 'analyst';
  end if;

  -- Preserve permissions.canCreateContent (and do not invent true)
  old_perm := coalesce(old_content -> 'permissions', '{}'::jsonb);
  new_perm := coalesce(result -> 'permissions', '{}'::jsonb);
  if jsonb_typeof(new_perm) <> 'object' then
    new_perm := '{}'::jsonb;
  end if;
  if old_perm ? 'canCreateContent' then
    new_perm := jsonb_set(
      new_perm,
      '{canCreateContent}',
      old_perm -> 'canCreateContent',
      true
    );
  else
    new_perm := new_perm - 'canCreateContent';
  end if;
  result := jsonb_set(result, '{permissions}', new_perm, true);

  return result;
end;
$$;

create or replace function public.guard_profile_privileged_content()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.content is not distinct from old.content then
    return new;
  end if;

  -- Trusted RPCs (set_profile_analyst / verify_and_activate_analyst)
  if public.seellie_allow_privileged_content() then
    return new;
  end if;

  -- Superadmin may update privileged fields (admin console)
  if public.is_app_superadmin() then
    return new;
  end if;

  new.content := public.preserve_privileged_profile_content(old.content, new.content);
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_content on public.profiles;
create trigger profiles_guard_privileged_content
  before update of content on public.profiles
  for each row
  execute function public.guard_profile_privileged_content();

-- Harden replace_profile_content owner path (belt + suspenders with trigger)
create or replace function public.replace_profile_content(
  p_id uuid,
  p_content jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_content jsonb;
  merged jsonb;
  next_content jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();

  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'profile not found';
  end if;

  if auth.uid() = p_id or public.is_app_superadmin() then
    if public.is_app_superadmin() or public.seellie_allow_privileged_content() then
      next_content := coalesce(p_content, '{}'::jsonb);
    else
      select content into old_content from public.profiles where id = p_id for update;
      next_content := public.preserve_privileged_profile_content(
        old_content,
        coalesce(p_content, '{}'::jsonb)
      );
    end if;

    update public.profiles
    set
      content = next_content,
      updated_at = now()
    where id = p_id;
    return;
  end if;

  select content into old_content
  from public.profiles
  where id = p_id
  for update;

  merged := public.merge_profile_social_json(
    old_content,
    p_content,
    auth.uid()::text
  );
  -- Social merge must not escalate privileges
  merged := public.preserve_privileged_profile_content(old_content, merged);

  update public.profiles
  set
    content = merged,
    updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.replace_profile_content(uuid, jsonb) to authenticated;

-- Allow official analyst RPCs to write privileged fields
create or replace function public.set_profile_analyst(
  p_id uuid,
  p_analyst jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sanitized jsonb;
  code text;
  new_status text;
  auto_approve boolean := false;
  is_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();

  is_admin := public.is_app_superadmin();

  if auth.uid() <> p_id and not is_admin then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'profile not found';
  end if;

  sanitized := coalesce(p_analyst, 'null'::jsonb);
  if sanitized is not null and jsonb_typeof(sanitized) = 'object' then
    code := nullif(trim(sanitized ->> 'accessCode'), '');
    if code is not null and char_length(code) > 64 then
      code := left(code, 64);
    end if;
    sanitized := sanitized - 'accessCode';
    new_status := nullif(trim(sanitized ->> 'status'), '');
  end if;

  if not is_admin then
    if new_status in ('active', 'warned', 'suspended', 'banned', 'rejected') then
      raise exception 'forbidden_status';
    end if;

    if new_status = 'approved' then
      select coalesce((payload ->> 'autoApproveAnalystRequests')::boolean, false)
        into auto_approve
      from public.app_blobs
      where key = 'settings'
      limit 1;

      if not coalesce(auto_approve, false) then
        sanitized := jsonb_set(
          coalesce(sanitized, '{}'::jsonb),
          '{status}',
          to_jsonb('pending'::text),
          true
        );
        code := null;
      end if;
    end if;
  end if;

  perform set_config('seellie.allow_privileged_content', '1', true);

  update public.profiles
  set
    content = jsonb_set(
      coalesce(content, '{}'::jsonb),
      '{analyst}',
      coalesce(sanitized, 'null'::jsonb),
      true
    ),
    updated_at = now()
  where id = p_id;

  if code is not null and char_length(code) >= 6 then
    insert into public.analyst_access_codes (user_id, access_code, created_at, verified_at)
    values (p_id, code, now(), null)
    on conflict (user_id) do update
      set access_code = excluded.access_code,
          created_at = now(),
          verified_at = null;
  end if;
end;
$$;

revoke all on function public.set_profile_analyst(uuid, jsonb) from public, anon;
grant execute on function public.set_profile_analyst(uuid, jsonb) to authenticated;

create or replace function public.verify_and_activate_analyst(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expected text;
  entered text := nullif(trim(p_code), '');
  st text;
  analyst jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();

  if entered is null then
    return jsonb_build_object('ok', false, 'error', 'empty_code');
  end if;

  select nullif(trim(content #>> '{analyst,status}'), ''),
         coalesce(content -> 'analyst', '{}'::jsonb)
  into st, analyst
  from public.profiles
  where id = auth.uid();

  if st is distinct from 'approved' then
    return jsonb_build_object('ok', false, 'error', 'not_approved');
  end if;

  select a.access_code into expected
  from public.analyst_access_codes a
  where a.user_id = auth.uid()
    and a.verified_at is null;

  if expected is null or expected <> entered then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  analyst := (analyst - 'accessCode')
    || jsonb_build_object(
      'status', 'active',
      'activatedAt', to_jsonb(now())
    );

  perform set_config('seellie.allow_privileged_content', '1', true);

  update public.profiles
  set
    content = jsonb_set(
      jsonb_set(
        coalesce(content, '{}'::jsonb),
        '{analyst}',
        analyst,
        true
      ),
      '{permissions,canCreateContent}',
      'true'::jsonb,
      true
    ),
    updated_at = now()
  where id = auth.uid();

  update public.analyst_access_codes
  set verified_at = now()
  where user_id = auth.uid();

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.verify_and_activate_analyst(text) from public, anon;
grant execute on function public.verify_and_activate_analyst(text) to authenticated;
