/* App-wide cloud blobs — run once in SQL Editor (no comment header lines) */

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

drop policy if exists "app_blobs_upsert_auth" on public.app_blobs;
create policy "app_blobs_upsert_auth"
  on public.app_blobs for insert
  to authenticated
  with check (true);

drop policy if exists "app_blobs_update_auth" on public.app_blobs;
create policy "app_blobs_update_auth"
  on public.app_blobs for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "app_blobs_delete_auth" on public.app_blobs;
create policy "app_blobs_delete_auth"
  on public.app_blobs for delete
  to authenticated
  using (true);

do $$
begin
  alter publication supabase_realtime add table public.app_blobs;
exception
  when duplicate_object then null;
end $$;
