-- إصلاح موافقة/رفض طلبات المسابقات من حساب المشرف
-- السبب: upsert يحتاج INSERT والمنظم فقط مسموح له بالإدخال
-- نفّذ في SQL Editor ثم أعد قبول الطلب من التطبيق

create or replace function public.is_app_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'superadmin'
        or p.active_role = 'superadmin'
        or coalesce(p.roles, array[]::text[]) && array['superadmin']::text[]
      )
  );
$$;

drop policy if exists "competition_requests_update_auth" on public.competition_requests;
create policy "competition_requests_update_auth"
  on public.competition_requests for update
  to authenticated
  using (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  )
  with check (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  );

-- تأكيد أن حساب المشرف فعلاً superadmin في profiles
-- (بدّل الإيميل إن لزم)
update public.profiles
set
  role = 'superadmin',
  roles = array['superadmin']::text[],
  active_role = 'superadmin',
  updated_at = now()
where lower(email) = lower('alrjaa.ns@gmail.com');

select id, email, role, roles, active_role
from public.profiles
where lower(email) = lower('alrjaa.ns@gmail.com');
