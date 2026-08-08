-- هل الرسالة وصلت؟ ولمن؟
-- نفّذ في SQL Editor

-- 1) آخر الرسائل + إيميل المرسل والمستلم
select
  m.subject,
  m.body,
  m.created_at,
  s.email as sender_email,
  r.email as recipient_email,
  m.read
from public.messages m
left join public.profiles s on s.id = m.sender_id
left join public.profiles r on r.id = m.recipient_id
order by m.created_at desc
limit 10;

-- 2) حسابات profiles (للمقارنة مع جوال المتابع)
select email, role, id from public.profiles order by created_at desc;
