-- Seellie · إصلاح شامل لمزامنة الطلبات والمسابقات مع Supabase
-- نفّذ هذا الملف كاملاً مرة واحدة في SQL Editor

-- 1) طلبات تنظيم المسابقات
create table if not exists public.competition_requests (
  id text primary key,
  organizer_id text not null,
  name text not null,
  region text not null,
  city text not null,
  neighborhood text not null,
  venue_name text not null default '',
  terms_accepted_at timestamptz not null default now(),
  diligence_pledge boolean not null default true,
  stadium_pledge boolean not null default true,
  min_teams_pledge boolean not null default true,
  first_aid_pledge boolean not null default true,
  order_pledge boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  rejection_reason text,
  competition_id text,
  updated_at timestamptz not null default now()
);

create index if not exists competition_requests_status_idx
  on public.competition_requests (status, requested_at desc);
create index if not exists competition_requests_organizer_idx
  on public.competition_requests (organizer_id, requested_at desc);

alter table public.competition_requests enable row level security;

-- 2) المسابقات المعتمدة (payload JSON كامل للتطبيق)
create table if not exists public.app_competitions (
  id text primary key,
  organizer_id text not null,
  name text not null default '',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists app_competitions_organizer_idx
  on public.app_competitions (organizer_id, updated_at desc);

alter table public.app_competitions enable row level security;

-- 3) دالة مشرف
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

grant execute on function public.is_app_superadmin() to authenticated;
grant execute on function public.is_app_superadmin() to anon;

-- 4) سياسات الطلبات
drop policy if exists "competition_requests_select_auth" on public.competition_requests;
create policy "competition_requests_select_auth"
  on public.competition_requests for select
  to authenticated
  using (true);

drop policy if exists "competition_requests_insert_own" on public.competition_requests;
create policy "competition_requests_insert_own"
  on public.competition_requests for insert
  to authenticated
  with check (organizer_id = auth.uid()::text);

drop policy if exists "competition_requests_update_auth" on public.competition_requests;
drop policy if exists "competition_requests_update_organizer" on public.competition_requests;
drop policy if exists "competition_requests_update_admin" on public.competition_requests;

-- منظم: يعدّل الطلب المعلّق فقط (لا يغيّر status إلى approved/rejected)
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

drop policy if exists "competition_requests_delete_auth" on public.competition_requests;
create policy "competition_requests_delete_auth"
  on public.competition_requests for delete
  to authenticated
  using (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  );

-- 5) سياسات المسابقات
drop policy if exists "app_competitions_select_auth" on public.app_competitions;
create policy "app_competitions_select_auth"
  on public.app_competitions for select
  to authenticated
  using (true);

drop policy if exists "app_competitions_insert_auth" on public.app_competitions;
create policy "app_competitions_insert_auth"
  on public.app_competitions for insert
  to authenticated
  with check (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  );

drop policy if exists "app_competitions_update_auth" on public.app_competitions;
create policy "app_competitions_update_auth"
  on public.app_competitions for update
  to authenticated
  using (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  )
  with check (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  );

drop policy if exists "app_competitions_delete_auth" on public.app_competitions;
create policy "app_competitions_delete_auth"
  on public.app_competitions for delete
  to authenticated
  using (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  );

-- 6) Realtime
do $$
begin
  alter publication supabase_realtime add table public.competition_requests;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.app_competitions;
exception when duplicate_object then null;
end $$;

-- 7) ترقية المشرف (عدّل الإيميل إن لزم)
update public.profiles
set
  role = 'superadmin',
  roles = array['superadmin']::text[],
  active_role = 'superadmin',
  updated_at = now()
where lower(email) = lower('alrjaa.ns@gmail.com');

select 'profiles' as src, id::text, email, role from public.profiles
where lower(email) = lower('alrjaa.ns@gmail.com')
union all
select 'requests', id, organizer_id, status from public.competition_requests
order by 1;
