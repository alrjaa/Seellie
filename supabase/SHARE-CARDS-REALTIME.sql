-- FIX-02: Enable Realtime for share_cards (inbox live updates).
-- Non-destructive / idempotent. Does NOT alter RLS, policies, triggers, or data.
-- Realtime for authenticated clients is filtered by existing RLS:
--   SELECT: auth.uid() = sender_id OR auth.uid() = recipient_id
-- Do NOT add service_role bypass here.

do $$
begin
  if not exists (
    select 1
    from pg_publication p
    where p.pubname = 'supabase_realtime'
  ) then
    raise notice 'supabase_realtime publication missing — skip share_cards';
    return;
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'share_cards'
  ) then
    raise notice 'share_cards already in supabase_realtime — noop';
    return;
  end if;

  alter publication supabase_realtime add table public.share_cards;
  raise notice 'share_cards added to supabase_realtime';
exception
  when duplicate_object then
    raise notice 'share_cards already member (duplicate_object) — noop';
  when others then
    raise exception 'SHARE-CARDS-REALTIME failed: %', SQLERRM;
end $$;

-- Verification helper (read-only):
-- select * from pg_publication_tables
-- where pubname = 'supabase_realtime' and tablename = 'share_cards';
