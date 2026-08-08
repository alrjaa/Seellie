/* Fix private friends persistence - run once in SQL Editor */

drop policy if exists "private_friends_own" on public.private_friends;
drop policy if exists "private_friends_select_own" on public.private_friends;
drop policy if exists "private_friends_insert_pair" on public.private_friends;
drop policy if exists "private_friends_insert_own" on public.private_friends;
drop policy if exists "private_friends_update_own" on public.private_friends;
drop policy if exists "private_friends_delete_own" on public.private_friends;

create policy "private_friends_select_own"
  on public.private_friends for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "private_friends_insert_own"
  on public.private_friends for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "private_friends_update_own"
  on public.private_friends for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

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
