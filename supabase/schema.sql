-- Seellie · Supabase schema (run in SQL Editor)
-- Project: https://sjfkdipgvivomllpfnkt.supabase.co

-- 1) Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text not null,
  handle text,
  visible_id text,
  role text not null default 'follower',
  roles text[] not null default array['follower']::text[],
  active_role text not null default 'follower',
  avatar text,
  bio text,
  city text,
  region text,
  country text,
  mobile text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_handle_idx on public.profiles (handle);

-- 2) Share cards
create table if not exists public.share_cards (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('content', 'join_request')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'seen')),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null,
  sender_avatar text,
  sender_handle text,
  sender_role text,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  recipient_name text not null,
  recipient_kind text default 'user',
  title text,
  body text,
  media_url text,
  media_kind text,
  competition_id text,
  competition_name text,
  team_id text,
  team_name text,
  position text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists share_cards_recipient_idx
  on public.share_cards (recipient_id, created_at desc);
create index if not exists share_cards_sender_idx
  on public.share_cards (sender_id, created_at desc);

-- 3) Auto profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, handle, role, roles, active_role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'user'), '@', 1)),
    '@' || left(split_part(coalesce(new.email, 'user'), '@', 1), 20),
    'follower',
    array['follower']::text[],
    'follower'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) RLS
alter table public.profiles enable row level security;
alter table public.share_cards enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "share_cards_select_party" on public.share_cards;
create policy "share_cards_select_party"
  on public.share_cards for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "share_cards_insert_sender" on public.share_cards;
create policy "share_cards_insert_sender"
  on public.share_cards for insert
  to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists "share_cards_update_recipient" on public.share_cards;
create policy "share_cards_update_recipient"
  on public.share_cards for update
  to authenticated
  using (auth.uid() = recipient_id or auth.uid() = sender_id)
  with check (auth.uid() = recipient_id or auth.uid() = sender_id);

-- 5) Storage bucket (public read for shared media URLs)
insert into storage.buckets (id, name, public)
values ('share-media', 'share-media', true)
on conflict (id) do update set public = true;

drop policy if exists "share_media_read" on storage.objects;
create policy "share_media_read"
  on storage.objects for select
  to public
  using (bucket_id = 'share-media');

drop policy if exists "share_media_insert_own" on storage.objects;
create policy "share_media_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'share-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "share_media_update_own" on storage.objects;
create policy "share_media_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'share-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "share_media_delete_own" on storage.objects;
create policy "share_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'share-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6) In-app messages (cross-device)
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
