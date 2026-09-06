-- Seellie · P0 Profiles SELECT lockdown (Audit 2026-09-06 / FIX-01)
-- Same contents as supabase/P0-PROFILES-SELECT-LOCKDOWN.sql

create or replace view public.profiles_catalog
with (security_invoker = false)
as
select
  id,
  name,
  handle,
  visible_id,
  role,
  roles,
  active_role,
  avatar,
  bio,
  city,
  region,
  country,
  status,
  content,
  created_at,
  updated_at
from public.profiles;

comment on view public.profiles_catalog is
  'P0: public profile fields for search/feeds. Never expose email or mobile.';

revoke all on public.profiles_catalog from public;
revoke all on public.profiles_catalog from anon;
grant select on public.profiles_catalog to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_app_superadmin()
  );
