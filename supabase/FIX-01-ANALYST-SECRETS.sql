-- FIX-01 · Analyst access secrets (idempotent, hardened)
-- Checkpoint: FIX-01-SQL-APPLY
-- Depends on: profiles, is_app_superadmin(), assert_account_active()
-- Non-destructive: migrates accessCode out of profiles.content; no user/profile deletes.
-- Safe to re-run.

-- ═══════════════════════════════════════════════════════════
-- 0) Prerequisites (fail fast if missing)
-- ═══════════════════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.is_app_superadmin()') is null then
    raise exception 'FIX-01 blocked: public.is_app_superadmin() missing — run SECURITY phases first';
  end if;
  if to_regprocedure('public.assert_account_active()') is null then
    raise exception 'FIX-01 blocked: public.assert_account_active() missing — run SECURITY-PHASE4 first';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════
-- 1) Secret table
-- ═══════════════════════════════════════════════════════════
create table if not exists public.analyst_access_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  access_code text not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  constraint analyst_access_codes_code_len check (
    char_length(access_code) >= 6 and char_length(access_code) <= 64
  )
);

alter table public.analyst_access_codes enable row level security;

-- Least privilege table grants (RLS still applies)
revoke all on table public.analyst_access_codes from public, anon, authenticated;
grant select on table public.analyst_access_codes to authenticated;
-- No insert/update/delete for clients — SECURITY DEFINER RPCs only (owner = table owner / postgres)

drop policy if exists analyst_access_codes_select_own on public.analyst_access_codes;
create policy analyst_access_codes_select_own
  on public.analyst_access_codes
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_app_superadmin()
  );

-- Explicitly no write policies for authenticated/anon
drop policy if exists analyst_access_codes_insert on public.analyst_access_codes;
drop policy if exists analyst_access_codes_update on public.analyst_access_codes;
drop policy if exists analyst_access_codes_delete on public.analyst_access_codes;

-- ═══════════════════════════════════════════════════════════
-- 2) Data migrate: content → secret table, then strip public JSON
--    On conflict: keep existing secret-table value (source of truth on re-run)
-- ═══════════════════════════════════════════════════════════
insert into public.analyst_access_codes (user_id, access_code, created_at)
select
  p.id,
  left(nullif(trim(p.content #>> '{analyst,accessCode}'), ''), 64),
  coalesce(
    nullif(p.content #>> '{analyst,accessCodeSentAt}', '')::timestamptz,
    now()
  )
from public.profiles p
where nullif(trim(p.content #>> '{analyst,accessCode}'), '') is not null
  and char_length(nullif(trim(p.content #>> '{analyst,accessCode}'), '')) >= 6
on conflict (user_id) do nothing;

-- Strip ONLY the accessCode key; keep all other analyst fields
update public.profiles
set content = content #- '{analyst,accessCode}',
    updated_at = now()
where content ? 'analyst'
  and content #> '{analyst}' ? 'accessCode';

-- ═══════════════════════════════════════════════════════════
-- 3) Hardened set_profile_analyst
--    - strips accessCode from public content
--    - stores code in secret table when provided
--    - non-admin cannot self-elevate to active/moderation statuses
--    - non-admin "approved" only when autoApproveAnalystRequests is true
-- ═══════════════════════════════════════════════════════════
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
    -- Owner self-service only: never activate / moderate yourself via this RPC
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
        -- Do not persist a self-chosen code unless auto-approve path
        code := null;
      end if;
    end if;
  end if;

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

-- ═══════════════════════════════════════════════════════════
-- 4) set_analyst_access_code — admin or owner (owner only for self)
-- ═══════════════════════════════════════════════════════════
create or replace function public.set_analyst_access_code(
  p_id uuid,
  p_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  code text := nullif(trim(p_code), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();
  if auth.uid() <> p_id and not public.is_app_superadmin() then
    raise exception 'forbidden';
  end if;
  if code is null or char_length(code) < 6 or char_length(code) > 64 then
    raise exception 'invalid_code';
  end if;

  insert into public.analyst_access_codes (user_id, access_code, created_at, verified_at)
  values (p_id, code, now(), null)
  on conflict (user_id) do update
    set access_code = excluded.access_code,
        created_at = now(),
        verified_at = null;

  update public.profiles
  set content = case
    when content ? 'analyst' then content #- '{analyst,accessCode}'
    else content
  end,
  updated_at = now()
  where id = p_id;
end;
$$;

revoke all on function public.set_analyst_access_code(uuid, text) from public, anon;
grant execute on function public.set_analyst_access_code(uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 5) get_own_analyst_access_code — owner only, approved + unverified
-- ═══════════════════════════════════════════════════════════
create or replace function public.get_own_analyst_access_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  code text;
  st text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select nullif(trim(content #>> '{analyst,status}'), '')
  into st
  from public.profiles
  where id = auth.uid();

  -- Only pending activation (approved). Never re-expose after verify.
  if st is distinct from 'approved' then
    return null;
  end if;

  select a.access_code into code
  from public.analyst_access_codes a
  where a.user_id = auth.uid()
    and a.verified_at is null;

  return code;
end;
$$;

revoke all on function public.get_own_analyst_access_code() from public, anon;
grant execute on function public.get_own_analyst_access_code() to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 6) admin_get_analyst_access_code — superadmin only (server-side)
-- ═══════════════════════════════════════════════════════════
create or replace function public.admin_get_analyst_access_code(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_app_superadmin() then
    raise exception 'forbidden';
  end if;
  return (
    select a.access_code
    from public.analyst_access_codes a
    where a.user_id = p_id
  );
end;
$$;

revoke all on function public.admin_get_analyst_access_code(uuid) from public, anon;
grant execute on function public.admin_get_analyst_access_code(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 7) verify_and_activate_analyst — owner only via auth.uid() (no p_id → no IDOR)
-- ═══════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════
-- 8) BEFORE trigger — never persist accessCode inside profiles.content
--    (idempotent strip; no nested UPDATE → no recursion)
-- ═══════════════════════════════════════════════════════════
create or replace function public.strip_analyst_access_code_from_content()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.content is not null
     and jsonb_typeof(new.content) = 'object'
     and new.content ? 'analyst'
     and jsonb_typeof(new.content -> 'analyst') = 'object'
     and (new.content -> 'analyst') ? 'accessCode' then
    new.content := new.content #- '{analyst,accessCode}';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_strip_analyst_access_code on public.profiles;
create trigger profiles_strip_analyst_access_code
  before insert or update of content on public.profiles
  for each row
  execute function public.strip_analyst_access_code_from_content();

-- Do NOT add analyst_access_codes to supabase_realtime

-- ═══════════════════════════════════════════════════════════
-- 9) Post-checks (counts only — no secrets returned)
-- ═══════════════════════════════════════════════════════════
do $$
declare
  leaked int;
  secrets int;
begin
  select count(*) into leaked
  from public.profiles
  where content #>> '{analyst,accessCode}' is not null;

  select count(*) into secrets from public.analyst_access_codes;

  raise notice 'FIX-01 verify: leaked_in_content=% secret_rows=%', leaked, secrets;
  if leaked <> 0 then
    raise exception 'FIX-01 failed: accessCode still present in profiles.content (% rows)', leaked;
  end if;
end $$;
