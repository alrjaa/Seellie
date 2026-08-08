-- Seellie · in-app messages (run in SQL Editor)
-- Project: https://sjfkdipgvivomllpfnkt.supabase.co

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null,
  sender_avatar text,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_recipient_idx
  on public.messages (recipient_id, created_at desc);
create index if not exists messages_sender_idx
  on public.messages (sender_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages_select_party" on public.messages;
create policy "messages_select_party"
  on public.messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists "messages_update_party" on public.messages;
create policy "messages_update_party"
  on public.messages for update
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id)
  with check (auth.uid() = sender_id or auth.uid() = recipient_id);

-- بث فوري (إن ظهر خطأ duplicate تجاهله)
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;
