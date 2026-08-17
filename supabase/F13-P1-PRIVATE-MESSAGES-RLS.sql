-- F13-P1 / F13-P2-01 — Harden private_messages INSERT (inbox injection)
-- Idempotent. Dual-copy delivery remains via SECURITY DEFINER send_private_message only.
--
-- HISTORICAL WEAK POLICY (OBSOLETE — DO NOT RUN / DO NOT RECREATE):
--   private_messages_insert_thread
--   with check (auth.uid() = sender_id AND (owner_id = auth.uid() OR friend_id = auth.uid()))
--   → attacker can insert owner_id=<victim>, friend_id=<self>, sender_id=<self>
--
-- AFTER:
--   Client/RLS inserts only into the sender's own inbox (owner_id = auth.uid()).
--   Recipient copy is written exclusively by send_private_message (SECURITY DEFINER).

create or replace function public.private_dm_is_friend(p_friend_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_friend_id is not null
    and auth.uid() is not null
    and p_friend_id <> auth.uid()
    and exists (
      select 1
      from public.private_friends pf
      where pf.owner_id = auth.uid()
        and pf.friend_id = p_friend_id
    );
$$;

revoke all on function public.private_dm_is_friend(uuid) from public;
grant execute on function public.private_dm_is_friend(uuid) to authenticated;

drop policy if exists "private_messages_insert_thread" on public.private_messages;
drop policy if exists "private_messages_insert_own_inbox" on public.private_messages;

create policy "private_messages_insert_own_inbox"
  on public.private_messages for insert
  to authenticated
  with check (
    public.account_is_active()
    and auth.uid() = sender_id
    and auth.uid() = owner_id
    and friend_id is not null
    and friend_id <> auth.uid()
    and public.private_dm_is_friend(friend_id)
  );

-- Ensure RPC remains the only path that may write the peer inbox copy.
-- (SECURITY DEFINER bypasses RLS; keep rate limits / validation from tip.)
-- No change to send_private_message body required if already SECURITY DEFINER.

select 'F13-P1-PRIVATE-MESSAGES-RLS applied' as status;
