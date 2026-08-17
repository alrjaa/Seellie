-- Seellie · Fix private DMs so both parties see the same conversation
-- Run once in SQL Editor (after private-space.sql).
--
-- F13-P2-01: Dual-inbox client INSERT is OBSOLETE / insecure.
-- Peer inbox writes must go through send_private_message (SECURITY DEFINER).
-- Tip INSERT RLS: F13-P1-PRIVATE-MESSAGES-RLS.sql
-- OBSOLETE — DO NOT recreate private_messages_insert_thread
--   with (owner_id = auth.uid() OR friend_id = auth.uid()).

drop policy if exists "private_messages_own" on public.private_messages;

drop policy if exists "private_messages_select_own" on public.private_messages;
create policy "private_messages_select_own"
  on public.private_messages for select
  to authenticated
  using (auth.uid() = owner_id);

-- F13-P2-01: drop weak INSERT only — do not recreate insert_thread.
drop policy if exists "private_messages_insert_thread" on public.private_messages;

drop policy if exists "private_messages_delete_own" on public.private_messages;
create policy "private_messages_delete_own"
  on public.private_messages for delete
  to authenticated
  using (auth.uid() = owner_id);

-- صداقة ثنائية عند الإضافة من أحد الطرفين (اختياري عبر الـ app أيضاً)
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
