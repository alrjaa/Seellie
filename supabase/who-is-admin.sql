-- من هو الأدمن؟ ومن الموجود في السحابة؟

-- 1) كل من في Auth (التسجيل)
select email as "الإيميل", created_at as "تاريخ_التسجيل"
from auth.users
order by created_at desc;

-- 2) كل من في profiles مع الدور
select
  email as "الإيميل",
  role as "الدور",
  name as "الاسم",
  created_at as "تاريخ_الإنشاء"
from public.profiles
order by created_at desc;

-- 3) إيميل الأدمن فقط (إن وُجدت ترقية)
select email as "ايميل_الادمن", role, name
from public.profiles
where role = 'superadmin';
