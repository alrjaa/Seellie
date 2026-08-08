-- Seellie · Private space (friends, DMs, saved content)
-- Run in Supabase SQL Editor once.

create table if not exists public.private_friends (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);

create index if not exists private_friends_owner_idx
  on public.private_friends (owner_id, created_at desc);

create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists private_messages_thread_idx
  on public.private_messages (owner_id, friend_id, created_at asc);

create table if not exists public.private_saved (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  source_id text not null,
  kind text not null check (kind in ('photo', 'video', 'text')),
  media_url text,
  title text,
  body text,
  author_id text,
  author_name text not null default '',
  author_handle text,
  saved_at timestamptz not null default now(),
  unique (owner_id, source_id)
);

create index if not exists private_saved_owner_idx
  on public.private_saved (owner_id, saved_at desc);

alter table public.private_friends enable row level security;
alter table public.private_messages enable row level security;
alter table public.private_saved enable row level security;

drop policy if exists "private_friends_own" on public.private_friends;
drop policy if exists "private_friends_select_own" on public.private_friends;
create policy "private_friends_select_own"
  on public.private_friends for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "private_friends_insert_pair" on public.private_friends;
create policy "private_friends_insert_pair"
  on public.private_friends for insert
  to authenticated
  with check (
    auth.uid() = owner_id
    or auth.uid() = friend_id
  );

drop policy if exists "private_friends_delete_own" on public.private_friends;
create policy "private_friends_delete_own"
  on public.private_friends for delete
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "private_messages_own" on public.private_messages;
drop policy if exists "private_messages_select_own" on public.private_messages;
create policy "private_messages_select_own"
  on public.private_messages for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "private_messages_insert_thread" on public.private_messages;
create policy "private_messages_insert_thread"
  on public.private_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and (
      owner_id = auth.uid()
      or friend_id = auth.uid()
    )
  );

drop policy if exists "private_messages_delete_own" on public.private_messages;
create policy "private_messages_delete_own"
  on public.private_messages for delete
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "private_saved_own" on public.private_saved;
create policy "private_saved_own"
  on public.private_saved for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

