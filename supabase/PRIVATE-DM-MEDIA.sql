-- Private DM media — paste once in SQL Editor after PRIVATE-DM-FIX.sql

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

-- Replace text-only RPC with text and/or media
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
