-- Seellie · P2 FIX-09 — block self-elevation to organizer/freelancer
-- Apply on staging/test via: supabase db query --linked -f supabase/P2-RBAC-SECONDARY-ROLE-GUARD.sql
-- Switching activeRole among already-granted roles remains allowed.
-- Granting a NEW secondary role requires is_app_superadmin() (admin console).

create or replace function public.profiles_guard_secondary_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_roles text[];
  new_roles text[];
begin
  if auth.uid() is null
     and current_user in ('postgres', 'supabase_admin')
  then
    return NEW;
  end if;

  if public.is_app_superadmin() then
    return NEW;
  end if;

  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;

  old_roles := coalesce(OLD.roles, array[]::text[]);
  new_roles := coalesce(NEW.roles, array[]::text[]);

  if ('organizer' = any(new_roles) and not ('organizer' = any(old_roles)))
     or ('freelancer' = any(new_roles) and not ('freelancer' = any(old_roles)))
  then
    raise exception 'secondary_role_elevation_denied';
  end if;

  -- Also block primary role flip to organizer/freelancer without prior membership
  if NEW.role in ('organizer', 'freelancer')
     and not (NEW.role = any(old_roles))
     and NEW.role is distinct from OLD.role
  then
    raise exception 'secondary_role_elevation_denied';
  end if;

  return NEW;
end;
$$;

drop trigger if exists profiles_guard_secondary_roles_trg on public.profiles;
create trigger profiles_guard_secondary_roles_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_secondary_roles();

comment on function public.profiles_guard_secondary_roles() is
  'P2 FIX-09: non-admin cannot self-add organizer/freelancer roles';
