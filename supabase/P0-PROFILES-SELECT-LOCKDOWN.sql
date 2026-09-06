-- Seellie · P0 Profiles SELECT lockdown (Audit 2026-09-06 / FIX-01)
-- Apply once on staging/test project (sjfkdipgvivomllpfnkt).
-- Goal: authenticated users cannot read other users' email/mobile from public.profiles.
-- Public discovery continues via profiles_catalog (no email/mobile).

-- 1) Recreate catalog view (DROP required: column order/name cannot change via CREATE OR REPLACE)
drop view if exists public.profiles_catalog cascade;

create view public.profiles_catalog
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

-- 2) Lock table SELECT — own row or superadmin only
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

-- 3) Verification
select
  pol.polname as policy,
  rel.relname as table_name
from pg_policy pol
join pg_class rel on rel.oid = pol.polrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'profiles'
  and pol.polname like 'profiles_select%';
