-- FIX-01 · Analyst access secrets (idempotent)
-- Run once in Supabase SQL Editor after PHASE4 + SET-PROFILE-ANALYST.sql
-- Non-destructive: migrates accessCode out of profiles.content into a restricted table.

-- 1) Secret table (not in realtime publication)
create table if not exists public.analyst_access_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  access_code text not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

alter table public.analyst_access_codes enable row level security;

drop policy if exists analyst_access_codes_select_own on public.analyst_access_codes;
create policy analyst_access_codes_select_own
  on public.analyst_access_codes
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_app_superadmin()
  );

-- No direct insert/update/delete for clients — RPCs only
revoke insert, update, delete on public.analyst_access_codes from authenticated, anon, public;

-- 2) Migrate existing codes from content → table, then strip from public JSON
insert into public.analyst_access_codes (user_id, access_code, created_at)
select
  p.id,
  nullif(trim(p.content #>> '{analyst,accessCode}'), ''),
  coalesce(
    (p.content #>> '{analyst,accessCodeSentAt}')::timestamptz,
    now()
  )
from public.profiles p
where nullif(trim(p.content #>> '{analyst,accessCode}'), '') is not null
on conflict (user_id) do update
  set access_code = excluded.access_code,
      created_at = excluded.created_at;

update public.profiles
set content = content #- '{analyst,accessCode}'
where content ? 'analyst'
  and content #> '{analyst}' ? 'accessCode';

-- 3) Hardened set_profile_analyst: never persist accessCode inside content
create or replace function public.set_profile_analyst(
  p_id uuid,
  p_analyst jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sanitized jsonb;
  code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();

  if auth.uid() <> p_id and not public.is_app_superadmin() then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'profile not found';
  end if;

  sanitized := coalesce(p_analyst, 'null'::jsonb);
  if sanitized is not null and jsonb_typeof(sanitized) = 'object' then
    code := nullif(trim(sanitized ->> 'accessCode'), '');
    sanitized := sanitized - 'accessCode';
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

  if code is not null then
    insert into public.analyst_access_codes (user_id, access_code, created_at, verified_at)
    values (p_id, code, now(), null)
    on conflict (user_id) do update
      set access_code = excluded.access_code,
          created_at = now(),
          verified_at = null;
  end if;
end;
$$;

revoke all on function public.set_profile_analyst(uuid, jsonb) from public;
grant execute on function public.set_profile_analyst(uuid, jsonb) to authenticated;

-- 4) Store / rotate code (admin or owner)
create or replace function public.set_analyst_access_code(
  p_id uuid,
  p_code text
)
returns void
language plpgsql
security definer
set search_path = public
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
  if code is null or char_length(code) < 6 then
    raise exception 'invalid_code';
  end if;

  insert into public.analyst_access_codes (user_id, access_code, created_at, verified_at)
  values (p_id, code, now(), null)
  on conflict (user_id) do update
    set access_code = excluded.access_code,
        created_at = now(),
        verified_at = null;

  -- ensure public JSON never keeps the secret
  update public.profiles
  set content = case
    when content ? 'analyst' then content #- '{analyst,accessCode}'
    else content
  end,
  updated_at = now()
  where id = p_id;
end;
$$;

revoke all on function public.set_analyst_access_code(uuid, text) from public;
grant execute on function public.set_analyst_access_code(uuid, text) to authenticated;

-- 5) Owner reads own pending code (approved, not yet verified)
create or replace function public.get_own_analyst_access_code()
returns text
language plpgsql
security definer
set search_path = public
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

  if st is distinct from 'approved' and st is distinct from 'active' then
    return null;
  end if;

  select a.access_code into code
  from public.analyst_access_codes a
  where a.user_id = auth.uid()
    and a.verified_at is null;

  return code;
end;
$$;

revoke all on function public.get_own_analyst_access_code() from public;
grant execute on function public.get_own_analyst_access_code() to authenticated;

-- 6) Admin reads a user's code
create or replace function public.admin_get_analyst_access_code(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
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

revoke all on function public.admin_get_analyst_access_code(uuid) from public;
grant execute on function public.admin_get_analyst_access_code(uuid) to authenticated;

-- 7) Server-side verify + activate (owner only)
create or replace function public.verify_and_activate_analyst(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  where a.user_id = auth.uid();

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

revoke all on function public.verify_and_activate_analyst(text) from public;
grant execute on function public.verify_and_activate_analyst(text) to authenticated;

-- 8) Strip accessCode from any replace_profile_content merge path (defense)
create or replace function public.strip_analyst_access_code_from_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.content is not null and new.content ? 'analyst' then
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
