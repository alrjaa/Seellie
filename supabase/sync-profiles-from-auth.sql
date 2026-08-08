-- إن وُجد مستخدم في Authentication → Users بدون صف في public.profiles
-- (لذلك لا يظهر في إدارة المستخدمين بعد المزامنة)

insert into public.profiles (
  id, email, name, handle, visible_id,
  role, roles, active_role, status
)
select
  u.id,
  lower(u.email),
  coalesce(
    nullif(u.raw_user_meta_data->>'name', ''),
    split_part(u.email, '@', 1)
  ),
  '@' || left(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), 20),
  'FLW-' || floor(1000 + random() * 9000)::int,
  'follower',
  array['follower']::text[],
  'follower',
  'active'
from auth.users u
where u.email is not null
  and not exists (
    select 1 from public.profiles p where p.id = u.id
  );

-- تحقق: كل auth.users يجب أن يظهر هنا
select
  u.email as auth_email,
  p.email as profile_email,
  p.role,
  p.id
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
