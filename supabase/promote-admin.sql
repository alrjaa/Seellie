-- Seellie · ربط حساب مشرف حقيقي بالسحابة
-- نفّذ الأوامر واحداً تلو الآخر في SQL Editor

-- A) كل من سجّل في Auth (هنا يظهر إيميل المشرف إن وُجد)
select id, email, created_at, email_confirmed_at
from auth.users
order by created_at desc;

-- B) كل الـ profiles الحالية
select id, email, name, role, created_at
from public.profiles
order by created_at desc;

-- ============================================================
-- الحالة 1: إيميل المشرف يظهر في auth.users لكن ليس في profiles
-- بدّل الإيميل فقط ثم نفّذ:
-- ============================================================
/*
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
where lower(u.email) = lower('ايميل_المشرف@example.com')
on conflict (id) do update set
  email = excluded.email,
  role = 'superadmin',
  roles = array['superadmin']::text[],
  active_role = 'superadmin',
  updated_at = now();
*/

-- ============================================================
-- الحالة 2: إيميل المشرف غير موجود أصلاً في auth.users
-- الحل: من التطبيق → Sign up بهذا الإيميل وكلمة مرور
-- ثم نفّذ الترقية أدناه
-- ============================================================
/*
update public.profiles
set
  role = 'superadmin',
  roles = array['superadmin']::text[],
  active_role = 'superadmin',
  updated_at = now()
where lower(email) = lower('ايميل_المشرف@example.com');
*/

-- C) تأكيد: يجب أن يظهر صف المشرف
-- select id, email, role from public.profiles where role = 'superadmin';
