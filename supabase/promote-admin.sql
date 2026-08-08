/* ترقية حساب موجود إلى مشرف سحابي
   1) سجّل الحساب أولاً من الموقع (Sign up)
   2) بدّل EMAIL_HERE بالإيميل ثم Run في SQL Editor
*/

do $$
begin
  begin
    alter table public.profiles disable trigger profiles_guard_roles_trg;
  exception when undefined_object then
    null;
  end;

  update public.profiles
  set
    role = 'superadmin',
    roles = array['superadmin']::text[],
    active_role = 'superadmin',
    status = 'active',
    updated_at = now()
  where lower(email) = lower('EMAIL_HERE@gmail.com');

  begin
    alter table public.profiles enable trigger profiles_guard_roles_trg;
  exception when undefined_object then
    null;
  end;
end $$;

select id, email, role, active_role, status
from public.profiles
where lower(email) = lower('EMAIL_HERE@gmail.com');
