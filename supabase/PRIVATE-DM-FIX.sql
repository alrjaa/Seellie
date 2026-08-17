-- Private DM fix: paste once in SQL Editor
--
-- F13-P2-01: weak dual-inbox INSERT removed.
-- OBSOLETE — DO NOT recreate private_messages_insert_thread with
--   (owner_id = auth.uid() OR friend_id = auth.uid()).
-- Own-inbox INSERT RLS tip: F13-P1-PRIVATE-MESSAGES-RLS.sql (also in PHASE4).
-- Peer inbox copy remains via send_private_message (SECURITY DEFINER) below.

-- 1) Message policies: select/delete own. INSERT owned by F13-P1 tip.
drop policy if exists "private_messages_own" on public.private_messages;
drop policy if exists "private_messages_select_own" on public.private_messages;
create policy "private_messages_select_own"
  on public.private_messages for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "private_messages_insert_thread" on public.private_messages;

drop policy if exists "private_messages_delete_own" on public.private_messages;
create policy "private_messages_delete_own"
  on public.private_messages for delete
  to authenticated
  using (auth.uid() = owner_id);

-- 2) Friends: keep select/delete own + RPC for mutual add
drop policy if exists "private_friends_own" on public.private_friends;
drop policy if exists "private_friends_select_own" on public.private_friends;
create policy "private_friends_select_own"
  on public.private_friends for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "private_friends_insert_pair" on public.private_friends;
drop policy if exists "private_friends_insert_own" on public.private_friends;
create policy "private_friends_insert_own"
  on public.private_friends for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "private_friends_delete_own" on public.private_friends;
create policy "private_friends_delete_own"
  on public.private_friends for delete
  to authenticated
  using (auth.uid() = owner_id);

create or replace function public.add_private_friend(p_friend_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_friend_id is null then
    return json_build_object('ok', false, 'error', 'missing_friend');
  end if;
  if p_friend_id = me then
    return json_build_object('ok', false, 'error', 'self');
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_friend_id) then
    return json_build_object('ok', false, 'error', 'friend_not_in_profiles');
  end if;

  insert into public.private_friends (owner_id, friend_id)
  values (me, p_friend_id)
  on conflict do nothing;

  insert into public.private_friends (owner_id, friend_id)
  values (p_friend_id, me)
  on conflict do nothing;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.add_private_friend(uuid) from public;
grant execute on function public.add_private_friend(uuid) to authenticated;

-- 3) Media columns on messages
alter table public.private_messages
  add column if not exists media_url text;

alter table public.private_messages
  add column if not exists media_kind text;

do $$
begin
  alter table public.private_messages
    drop constraint if exists private_messages_media_kind_check;
  alter table public.private_messages
    add constraint private_messages_media_kind_check
    check (media_kind is null or media_kind in ('photo', 'video'));
exception
  when others then null;
end $$;

alter table public.private_messages
  alter column body set default '';

-- 3b) Send DM to both inboxes (text and/or media)
drop function if exists public.send_private_message(uuid, text);
drop function if exists public.send_private_message(uuid, text, text, text);

create or replace function public.send_private_message(
  p_friend_id uuid,
  p_body text default null,
  p_media_url text default null,
  p_media_kind text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cleaned text := trim(both from coalesce(p_body, ''));
  media text := nullif(trim(both from coalesce(p_media_url, '')), '');
  kind text := nullif(trim(both from coalesce(p_media_kind, '')), '');
begin
  if me is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_friend_id is null then
    return json_build_object('ok', false, 'error', 'missing_friend');
  end if;
  if p_friend_id = me then
    return json_build_object('ok', false, 'error', 'self');
  end if;
  if cleaned = '' and media is null then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  if media is not null and (kind is null or kind not in ('photo', 'video')) then
    return json_build_object('ok', false, 'error', 'bad_media_kind');
  end if;
  if media is null then
    kind := null;
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_friend_id) then
    return json_build_object('ok', false, 'error', 'friend_not_in_profiles');
  end if;

  insert into public.private_friends (owner_id, friend_id)
  values (me, p_friend_id)
  on conflict do nothing;

  insert into public.private_friends (owner_id, friend_id)
  values (p_friend_id, me)
  on conflict do nothing;

  insert into public.private_messages (
    owner_id, friend_id, sender_id, body, media_url, media_kind
  )
  values
    (me, p_friend_id, me, cleaned, media, kind),
    (p_friend_id, me, me, cleaned, media, kind);

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.send_private_message(uuid, text, text, text) from public;
grant execute on function public.send_private_message(uuid, text, text, text) to authenticated;

-- 4) حذف صديق + محادثة الطرفين
create or replace function public.remove_private_friend(p_friend_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_friend_id is null then
    return json_build_object('ok', false, 'error', 'missing_friend');
  end if;

  delete from public.private_messages
  where (owner_id = me and friend_id = p_friend_id)
     or (owner_id = p_friend_id and friend_id = me);

  delete from public.private_friends
  where (owner_id = me and friend_id = p_friend_id)
     or (owner_id = p_friend_id and friend_id = me);

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.remove_private_friend(uuid) from public;
grant execute on function public.remove_private_friend(uuid) to authenticated;

-- 5) مسح محادثة عندي فقط (يبقى الصديق)
create or replace function public.clear_private_chat(p_friend_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_friend_id is null then
    return json_build_object('ok', false, 'error', 'missing_friend');
  end if;

  delete from public.private_messages
  where owner_id = me and friend_id = p_friend_id;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.clear_private_chat(uuid) from public;
grant execute on function public.clear_private_chat(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.private_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.private_friends;
exception
  when duplicate_object then null;
end $$;
