-- طلبات تنظيم المسابقات (تظهر للمشرف عبر الأجهزة)
-- نفّذ في Supabase → SQL Editor

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

do $$
begin
  alter publication supabase_realtime add table public.competition_requests;
exception
  when duplicate_object then null;
end $$;
