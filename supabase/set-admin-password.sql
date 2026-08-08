-- ============================================================
-- تعيين كلمة مرور الأدمن فوراً (بدون إيميل)
-- نفّذ في: Supabase → SQL Editor → Run
-- ثم ادخل من: https://seellie.com/admin
-- ============================================================
-- البريد: alrjaa.ns@gmail.com
-- كلمة المرور: SeellieAdmin2026!
-- ============================================================

create extension if not exists pgcrypto;

-- أ) كلمة المرور في auth (هذا يكفي للدخول)
update auth.users
set
  encrypted_password = crypt('SeellieAdmin2026!', gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where lower(email) = lower('alrjaa.ns@gmail.com');

-- ب) إصلاح الـ profile مع تجاوز حماية الترقية مؤقتاً
-- (الـ trigger يرفض أي صف فيه role=superadmin إن لم تكن جلسة مشرف)
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

-- ج) تحقق
select
  u.email,
  u.email_confirmed_at is not null as email_ok,
  length(u.encrypted_password) > 20 as password_set,
  p.role as profile_role,
  p.status
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('alrjaa.ns@gmail.com');
