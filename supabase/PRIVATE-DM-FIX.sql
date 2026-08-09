-- Private DM fix — paste once in SQL Editor (no fancy headers)

-- 1) Message policies: sender can write into recipient inbox
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

-- 3) Send DM to both inboxes (bypasses RLS via security definer)
create or replace function public.send_private_message(
  p_friend_id uuid,
  p_body text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cleaned text := trim(both from coalesce(p_body, ''));
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
  if cleaned = '' then
    return json_build_object('ok', false, 'error', 'empty');
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

  insert into public.private_messages (owner_id, friend_id, sender_id, body)
  values
    (me, p_friend_id, me, cleaned),
    (p_friend_id, me, me, cleaned);

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.send_private_message(uuid, text) from public;
grant execute on function public.send_private_message(uuid, text) to authenticated;

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
