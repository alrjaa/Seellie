/* Admin password reset — run in Supabase SQL Editor
   1) Replace YOUR_STRONG_ADMIN_PASSWORD with a new secret before running
   2) Adjust the email if needed
   Never put the live admin password in client toasts or UI placeholders.
*/

create extension if not exists pgcrypto;

update auth.users
set
  encrypted_password = crypt('YOUR_STRONG_ADMIN_PASSWORD', gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where lower(email) = lower('alrjaa.ns@gmail.com');

do $$
begin
  begin
    alter table public.profiles disable trigger profiles_guard_roles_trg;
  exception when undefined_object then
    null;
  end;

  insert into public.profiles (
    id, email, name, handle, visible_id,
    role, roles, active_role, status
  )
  select
    u.id,
    lower(u.email),
    coalesce(u.raw_user_meta_data->>'name', 'Admin'),
    '@admin',
    'ADM-' || floor(1000 + random() * 9000)::int,
    'superadmin',
    array['superadmin']::text[],
    'superadmin',
    'active'
  from auth.users u
  where lower(u.email) = lower('alrjaa.ns@gmail.com')
  on conflict (id) do update set
    email = excluded.email,
    role = 'superadmin',
    roles = array['superadmin']::text[],
    active_role = 'superadmin',
    status = 'active',
    updated_at = now();

  begin
    alter table public.profiles enable trigger profiles_guard_roles_trg;
  exception when undefined_object then
    null;
  end;
end $$;

select
  u.email,
  u.email_confirmed_at is not null as email_ok,
  length(u.encrypted_password) > 20 as password_set,
  p.role as profile_role,
  p.status
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('alrjaa.ns@gmail.com');
