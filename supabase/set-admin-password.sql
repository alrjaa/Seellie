-- تعيين كلمة مرور جديدة للأدمن بدون زر Reset password
-- بدّل NewPassword123456 إن أردت كلمة أخرى (احتفظ بها للدخول من /admin)

update auth.users
set
  encrypted_password = extensions.crypt(
    'NewPassword123456',
    extensions.gen_salt('bf')
  ),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where lower(email) = lower('alrjaa.ns@gmail.com');

-- تأكيد أن الصف تأثر (يجب 1)
select email, email_confirmed_at, updated_at
from auth.users
where lower(email) = lower('alrjaa.ns@gmail.com');

-- وتأكيد أنه مشرف في profiles
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
  role = 'superadmin',
  roles = array['superadmin']::text[],
  active_role = 'superadmin',
  updated_at = now();
