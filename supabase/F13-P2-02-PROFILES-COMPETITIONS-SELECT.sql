-- F13-P2-02 — Least-privilege SELECT for profiles + app_competitions
-- Idempotent. Does not modify user rows. Peer DMs (F13-P1) untouched.
--
-- Catalog (authenticated): public columns + sanitized JSON only.
-- Table SELECT: owner row OR is_app_superadmin() (email/mobile/full JSON).
-- Anonymous: no catalog/table rows.
-- Exact email lookup: find_profile_by_email (no directory dump).

-- ── helpers ────────────────────────────────────────────────
create or replace function public.profile_catalog_content(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(p, '{}'::jsonb)
    - 'mobile'
    #- '{analyst,accessCode}'
    #- '{analyst,warningReason}'
    #- '{analyst,suspendReason}'
    #- '{analyst,banReason}'
    #- '{analyst,rejectionReason}';
$$;

create or replace function public.sanitize_competition_payload(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(p, '{}'::jsonb)
    || jsonb_build_object(
      'staff', (
        select coalesce(jsonb_agg(elem - 'mobile' - 'email'), '[]'::jsonb)
        from jsonb_array_elements(coalesce(p->'staff', '[]'::jsonb)) as elem
      ),
      'teams', (
        select coalesce(jsonb_agg(
          (elem - 'bankAccountNumber')
          || jsonb_build_object(
            'players', (
              select coalesce(jsonb_agg(
                player
                  - 'email'
                  - 'mobile'
                  - 'address'
                  - 'bankAccountNumber'
              ), '[]'::jsonb)
              from jsonb_array_elements(coalesce(elem->'players', '[]'::jsonb)) as player
            ),
            'officials', (
              select coalesce(jsonb_agg(
                off - 'email' - 'mobile' - 'address'
              ), '[]'::jsonb)
              from jsonb_array_elements(coalesce(elem->'officials', '[]'::jsonb)) as off
            )
          )
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(p->'teams', '[]'::jsonb)) as elem
      )
    );
$$;

-- ── views (owner bypasses RLS; columns are sanitized) ──────
drop view if exists public.profiles_catalog;
create view public.profiles_catalog
with (security_barrier = true, security_invoker = false)
as
select
  p.id,
  p.name,
  p.handle,
  p.visible_id,
  p.role,
  p.roles,
  p.active_role,
  p.avatar,
  p.bio,
  p.city,
  p.region,
  p.country,
  p.status,
  p.created_at,
  public.profile_catalog_content(p.content) as content
from public.profiles p;

drop view if exists public.app_competitions_catalog;
create view public.app_competitions_catalog
with (security_barrier = true, security_invoker = false)
as
select
  c.id,
  c.organizer_id,
  c.name,
  c.updated_at,
  public.sanitize_competition_payload(c.payload) as payload
from public.app_competitions c;

revoke all on public.profiles_catalog from public, anon;
revoke all on public.app_competitions_catalog from public, anon;
grant select on public.profiles_catalog to authenticated;
grant select on public.app_competitions_catalog to authenticated;

-- ── exact email lookup (no ilike directory) ────────────────
create or replace function public.find_profile_by_email(p_email text)
returns table (
  id uuid,
  name text,
  handle text,
  visible_id text,
  email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    return;
  end if;
  begin
    perform public.assert_account_active();
  exception when others then
    return;
  end;
  if normalized = '' or position('@' in normalized) = 0 then
    return;
  end if;

  return query
  select
    p.id,
    p.name,
    p.handle,
    p.visible_id,
    p.email
  from public.profiles p
  where lower(p.email) = normalized
    and coalesce(p.role, '') is distinct from 'superadmin'
    and coalesce(p.active_role, '') is distinct from 'superadmin'
  limit 1;
end;
$$;

revoke all on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;

-- ── table SELECT policies (after views exist) ──────────────
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_app_superadmin());

drop policy if exists "app_competitions_select_auth" on public.app_competitions;
drop policy if exists "app_competitions_select_own" on public.app_competitions;
drop policy if exists "app_competitions_select_admin" on public.app_competitions;

create policy "app_competitions_select_own"
  on public.app_competitions for select
  to authenticated
  using (organizer_id = (auth.uid())::text);

create policy "app_competitions_select_admin"
  on public.app_competitions for select
  to authenticated
  using (public.is_app_superadmin());

notify pgrst, 'reload schema';

select 'F13-P2-02-PROFILES-COMPETITIONS-SELECT applied' as status;
