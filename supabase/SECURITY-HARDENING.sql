-- Seellie · تشديد أمان RLS (نفّذ مرة واحدة في SQL Editor)
-- لا يعطّل الميزات: تفعيل منظم/لاعب حر يبقى متاحاً للمستخدم
-- يمنع فقط: ترقية ذاتية لمشرف، وموافقة المنظم على طلبه بنفسه

-- 1) منع تعيين superadmin ذاتياً + السماح بتبديل الأدوار العادية
create or replace function public.profiles_guard_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  caller_is_admin := public.is_app_superadmin();

  if caller_is_admin then
    return NEW;
  end if;

  -- لا يحق لغير المشرف منح أو الإبقاء على صلاحية مشرف عبر التحديث
  if NEW.role = 'superadmin'
     or coalesce(NEW.active_role, '') = 'superadmin'
     or coalesce(NEW.roles, array[]::text[]) && array['superadmin']::text[]
  then
    raise exception 'privilege_escalation_denied';
  end if;

  -- لا يحق لغير المشرف تعديل حالة حسابه إلى محظور/موقوف عبر التلاعب
  -- (المشرف يحدّث عبر سياسة profiles_update_admin)
  if TG_OP = 'UPDATE'
     and NEW.id = auth.uid()
     and NEW.status is distinct from OLD.status
     and NEW.status in ('suspended', 'blocked')
  then
    raise exception 'status_self_lock_denied';
  end if;

  return NEW;
end;
$$;

drop trigger if exists profiles_guard_roles_trg on public.profiles;
create trigger profiles_guard_roles_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_roles();

-- 2) المشرف يحدّث أي ملف (حالة، أدوار، …)
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_app_superadmin())
  with check (public.is_app_superadmin());

-- 3) سياسات تحديث الطلبات: منظم يعدّل طلباً معلّقاً فقط دون تغيير الحالة
drop policy if exists "competition_requests_update_auth" on public.competition_requests;
drop policy if exists "competition_requests_update_organizer" on public.competition_requests;
drop policy if exists "competition_requests_update_admin" on public.competition_requests;

create policy "competition_requests_update_organizer"
  on public.competition_requests for update
  to authenticated
  using (
    organizer_id = auth.uid()::text
    and status = 'pending'
  )
  with check (
    organizer_id = auth.uid()::text
    and status = 'pending'
    and competition_id is null
  );

create policy "competition_requests_update_admin"
  on public.competition_requests for update
  to authenticated
  using (public.is_app_superadmin())
  with check (public.is_app_superadmin());

-- تحقق سريع
select
  pol.polname as policy,
  rel.relname as table
from pg_policy pol
join pg_class rel on rel.oid = pol.polrelid
where rel.relname in ('profiles', 'competition_requests')
order by 2, 1;
