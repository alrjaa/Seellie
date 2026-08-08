-- إصلاح دخول الأدمن: alrjaa.ns@gmail.com
-- نفّذ في SQL Editor ثم أعد تعيين كلمة المرور من لوحة Auth إن لزم

-- 1) هل الحساب موجود؟
select id, email, email_confirmed_at, last_sign_in_at, created_at
from auth.users
where lower(email) = lower('alrjaa.ns@gmail.com');

-- 2) تأكيد البريد (مهم إن كان Confirm email مفعّلاً)
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where lower(email) = lower('alrjaa.ns@gmail.com');

-- 3) تأكد أن الـ profile مشرف
insert into public.profiles (
  id, email, name, handle, visible_id,
  role, roles, active_role, status
)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  '@' || left(split_part(u.email, '@', 1), 20),
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
  updated_at = now();

-- 4) تحقق نهائي
select u.email as auth_email,
       u.email_confirmed_at,
       p.role as profile_role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('alrjaa.ns@gmail.com');
