-- تشخيص الرسائل بين الجوالات (SQL Editor)

-- 1) الحسابات السحابية
select id, email, role, created_at from public.profiles order by created_at desc;

-- 2) هل جدول الرسائل موجود؟
select count(*) as messages_count from public.messages;

-- 3) آخر الرسائل
select id, sender_name, subject, sender_id, recipient_id, created_at
from public.messages
order by created_at desc
limit 20;
