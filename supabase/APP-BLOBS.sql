/* App-wide cloud blobs — run once in SQL Editor (no comment header lines) */
/* Writes restricted: see SECURITY-PHASE1.sql for scoped policies */

create table if not exists public.app_blobs (
  key text primary key,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_blobs enable row level security;

drop policy if exists "app_blobs_select_auth" on public.app_blobs;
create policy "app_blobs_select_auth"
  on public.app_blobs for select
  to authenticated
  using (true);

-- Open write policies removed — apply SECURITY-PHASE1.sql
drop policy if exists "app_blobs_upsert_auth" on public.app_blobs;
drop policy if exists "app_blobs_update_auth" on public.app_blobs;
drop policy if exists "app_blobs_delete_auth" on public.app_blobs;

do $$
begin
  alter publication supabase_realtime add table public.app_blobs;
exception
  when duplicate_object then null;
end $$;
