-- Seellie · SECURITY-PHASE4-HARDENING
-- Paste in SQL Editor AFTER SECURITY-PHASE1 + PHASE2 + PHASE3
--
-- Goals (without breaking organizer/freelancer/follower/admin flows):
-- 1) Block suspended/blocked accounts from writes (server-side)
-- 2) Close forum_comments open UPDATE (likes/status via RPC)
-- 3) Guard messages / share_cards updates (no body/sender forgery)
-- 4) Harden offers blob (RPC instead of full overwrite by any user)
-- 5) Referees writes only via RPC (remove open key from policies)
-- 6) Social merge: non-owners may only toggle own like/follow id
-- 7) Storage size caps + light rate limit + security_events
--
-- Safe to re-run.

-- ═══════════════════════════════════════════════════════════
-- 0a) Status self-change lock (cannot unlock suspended/blocked self)
-- ═══════════════════════════════════════════════════════════

create or replace function public.profiles_guard_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  new_is_admin boolean;
  old_was_admin boolean;
begin
  if auth.uid() is null
     and current_user in ('postgres', 'supabase_admin')
  then
    return NEW;
  end if;

  caller_is_admin := public.is_app_superadmin();

  if caller_is_admin then
    return NEW;
  end if;

  new_is_admin :=
    NEW.role = 'superadmin'
    or coalesce(NEW.active_role, '') = 'superadmin'
    or coalesce(NEW.roles, array[]::text[]) && array['superadmin']::text[];

  old_was_admin :=
    TG_OP = 'UPDATE'
    and (
      OLD.role = 'superadmin'
      or coalesce(OLD.active_role, '') = 'superadmin'
      or coalesce(OLD.roles, array[]::text[]) && array['superadmin']::text[]
    );

  if new_is_admin and not old_was_admin then
    raise exception 'privilege_escalation_denied';
  end if;

  -- Non-admin cannot change own status in any direction (lock or unlock)
  if TG_OP = 'UPDATE'
     and NEW.id = auth.uid()
     and NEW.status is distinct from OLD.status
  then
    raise exception 'status_self_change_denied';
  end if;

  return NEW;
end;
$$;

drop trigger if exists profiles_guard_roles_trg on public.profiles;
create trigger profiles_guard_roles_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_roles();

-- ═══════════════════════════════════════════════════════════
-- 0) Helpers
-- ═══════════════════════════════════════════════════════════

create or replace function public.account_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      -- الموقوف/المحظور فقط يُمنعون؛ warned يبقى قادراً على العمل
      and coalesce(p.status, 'active') not in ('blocked', 'suspended')
  );
$$;

grant execute on function public.account_is_active() to authenticated;

create or replace function public.assert_account_active()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.account_is_active() then
    raise exception 'account_not_active';
  end if;
end;
$$;

grant execute on function public.assert_account_active() to authenticated;

-- Toggle-only likes/followers helper: keep old array; only add/remove `me`
create or replace function public.merge_id_list_toggle(
  old_list jsonb,
  incoming jsonb,
  me text
)
returns jsonb
language plpgsql
immutable
as $$
declare
  base jsonb := coalesce(old_list, '[]'::jsonb);
  inc jsonb := coalesce(incoming, '[]'::jsonb);
  has_old boolean := false;
  has_new boolean := false;
  result jsonb;
begin
  if me is null or me = '' then
    return base;
  end if;
  if jsonb_typeof(base) <> 'array' then
    base := '[]'::jsonb;
  end if;
  if jsonb_typeof(inc) <> 'array' then
    inc := '[]'::jsonb;
  end if;

  select exists (
    select 1 from jsonb_array_elements_text(base) x where x = me
  ) into has_old;
  select exists (
    select 1 from jsonb_array_elements_text(inc) x where x = me
  ) into has_new;

  if has_old = has_new then
    return base;
  end if;

  if has_old and not has_new then
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      into result
    from jsonb_array_elements_text(base) x
    where x <> me;
    return coalesce(result, '[]'::jsonb);
  end if;

  return base || jsonb_build_array(me);
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- 1) Social merge hardening (non-owner path)
-- ═══════════════════════════════════════════════════════════

create or replace function public.merge_profile_social_json(
  old_content jsonb,
  incoming jsonb,
  actor text default null
)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb;
  old_posts jsonb;
  new_posts jsonb;
  merged_posts jsonb := '[]'::jsonb;
  post jsonb;
  incoming_post jsonb;
  old_media jsonb;
  new_media jsonb;
  photos jsonb;
  videos jsonb;
  merged_photos jsonb := '[]'::jsonb;
  merged_videos jsonb := '[]'::jsonb;
  item jsonb;
  incoming_item jsonb;
  old_analysis jsonb;
  new_analysis jsonb;
  merged_analysis jsonb := '[]'::jsonb;
  analysis jsonb;
  incoming_analysis jsonb;
  old_followers jsonb;
begin
  result := coalesce(old_content, '{}'::jsonb);
  incoming := coalesce(incoming, '{}'::jsonb);

  -- Non-owner: may only toggle own id on target followers — never rewrite following
  if actor is not null and actor <> '' then
    old_followers := coalesce(result->'followers', '[]'::jsonb);
    if incoming ? 'followers' then
      result := jsonb_set(
        result,
        '{followers}',
        public.merge_id_list_toggle(old_followers, incoming->'followers', actor),
        true
      );
    end if;
  end if;

  old_posts := coalesce(result->'posts', '[]'::jsonb);
  new_posts := coalesce(incoming->'posts', '[]'::jsonb);
  for post in select * from jsonb_array_elements(old_posts)
  loop
    incoming_post := null;
    select p into incoming_post
    from jsonb_array_elements(new_posts) p
    where p->>'id' = post->>'id'
    limit 1;
    if incoming_post is not null and incoming_post ? 'likes' and actor is not null then
      post := jsonb_set(
        post,
        '{likes}',
        public.merge_id_list_toggle(post->'likes', incoming_post->'likes', actor),
        true
      );
    end if;
    merged_posts := merged_posts || jsonb_build_array(post);
  end loop;
  result := jsonb_set(result, '{posts}', merged_posts, true);

  old_media := coalesce(result->'media', '{}'::jsonb);
  new_media := coalesce(incoming->'media', '{}'::jsonb);
  photos := coalesce(old_media->'photos', '[]'::jsonb);
  videos := coalesce(old_media->'videos', '[]'::jsonb);

  for item in select * from jsonb_array_elements(photos)
  loop
    incoming_item := null;
    select p into incoming_item
    from jsonb_array_elements(coalesce(new_media->'photos', '[]'::jsonb)) p
    where p->>'id' = item->>'id'
    limit 1;
    if incoming_item is not null and incoming_item ? 'likes' and actor is not null then
      item := jsonb_set(
        item,
        '{likes}',
        public.merge_id_list_toggle(item->'likes', incoming_item->'likes', actor),
        true
      );
    end if;
    merged_photos := merged_photos || jsonb_build_array(item);
  end loop;

  for item in select * from jsonb_array_elements(videos)
  loop
    incoming_item := null;
    select p into incoming_item
    from jsonb_array_elements(coalesce(new_media->'videos', '[]'::jsonb)) p
    where p->>'id' = item->>'id'
    limit 1;
    if incoming_item is not null and incoming_item ? 'likes' and actor is not null then
      item := jsonb_set(
        item,
        '{likes}',
        public.merge_id_list_toggle(item->'likes', incoming_item->'likes', actor),
        true
      );
    end if;
    merged_videos := merged_videos || jsonb_build_array(item);
  end loop;

  result := jsonb_set(
    result,
    '{media}',
    jsonb_build_object('photos', merged_photos, 'videos', merged_videos),
    true
  );

  old_analysis := coalesce(result->'analysisContent', '[]'::jsonb);
  new_analysis := coalesce(incoming->'analysisContent', '[]'::jsonb);
  for analysis in select * from jsonb_array_elements(old_analysis)
  loop
    incoming_analysis := null;
    select a into incoming_analysis
    from jsonb_array_elements(new_analysis) a
    where a->>'id' = analysis->>'id'
    limit 1;
    if incoming_analysis is not null and incoming_analysis ? 'likes' and actor is not null then
      analysis := jsonb_set(
        analysis,
        '{likes}',
        public.merge_id_list_toggle(
          analysis->'likes',
          incoming_analysis->'likes',
          actor
        ),
        true
      );
    end if;
    merged_analysis := merged_analysis || jsonb_build_array(analysis);
  end loop;
  result := jsonb_set(result, '{analysisContent}', merged_analysis, true);

  return result;
end;
$$;

-- Keep 2-arg overload for compatibility
create or replace function public.merge_profile_social_json(
  old_content jsonb,
  incoming jsonb
)
returns jsonb
language sql
immutable
as $$
  select public.merge_profile_social_json(old_content, incoming, null);
$$;

create or replace function public.replace_profile_content(
  p_id uuid,
  p_content jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_content jsonb;
  merged jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();

  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'profile not found';
  end if;

  if auth.uid() = p_id or public.is_app_superadmin() then
    update public.profiles
    set
      content = coalesce(p_content, '{}'::jsonb),
      updated_at = now()
    where id = p_id;
    return;
  end if;

  select content into old_content
  from public.profiles
  where id = p_id
  for update;

  merged := public.merge_profile_social_json(
    old_content,
    p_content,
    auth.uid()::text
  );

  update public.profiles
  set
    content = merged,
    updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.replace_profile_content(uuid, jsonb) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 2) Forum comments — close open UPDATE
-- ═══════════════════════════════════════════════════════════

drop policy if exists "forum_comments_update_auth" on public.forum_comments;
drop policy if exists "forum_comments_update_none" on public.forum_comments;
-- No direct UPDATE policy for authenticated: mutations via RPC only

drop policy if exists "forum_comments_insert_own" on public.forum_comments;
create policy "forum_comments_insert_own"
  on public.forum_comments for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and public.account_is_active()
  );

drop policy if exists "forum_comments_delete_own" on public.forum_comments;
create policy "forum_comments_delete_own"
  on public.forum_comments for delete
  to authenticated
  using (
    auth.uid() = author_id
    or public.is_app_superadmin()
  );

create or replace function public.toggle_forum_comment_like(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  current uuid[];
  next_likes uuid[];
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  perform public.assert_account_active();
  if p_comment_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_id');
  end if;

  select coalesce(likes, '{}'::uuid[]) into current
  from public.forum_comments
  where id = p_comment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if me = any (current) then
    next_likes := array_remove(current, me);
  else
    next_likes := current || me;
  end if;

  update public.forum_comments
  set likes = next_likes
  where id = p_comment_id;

  return jsonb_build_object('ok', true, 'likes', to_jsonb(next_likes));
end;
$$;

revoke all on function public.toggle_forum_comment_like(uuid) from public;
grant execute on function public.toggle_forum_comment_like(uuid) to authenticated;

create or replace function public.set_forum_comment_status(
  p_comment_id uuid,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if not public.is_app_superadmin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_status is null or p_status not in ('active', 'warned', 'suspended', 'blocked') then
    return jsonb_build_object('ok', false, 'error', 'bad_status');
  end if;

  update public.forum_comments
  set
    status = p_status,
    status_reason = nullif(trim(both from coalesce(p_reason, '')), '')
  where id = p_comment_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_forum_comment_status(uuid, text, text) from public;
grant execute on function public.set_forum_comment_status(uuid, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 3) Messages / share_cards update guards
-- ═══════════════════════════════════════════════════════════

create or replace function public.messages_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.sender_id is distinct from OLD.sender_id
     or NEW.recipient_id is distinct from OLD.recipient_id
     or NEW.subject is distinct from OLD.subject
     or NEW.body is distinct from OLD.body
     or NEW.sender_name is distinct from OLD.sender_name
     or NEW.created_at is distinct from OLD.created_at
  then
    raise exception 'message_mutate_denied';
  end if;
  -- only `read` may change
  return NEW;
end;
$$;

drop trigger if exists messages_guard_update_trg on public.messages;
create trigger messages_guard_update_trg
  before update on public.messages
  for each row execute function public.messages_guard_update();

create or replace function public.share_cards_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.sender_id is distinct from OLD.sender_id
     or NEW.recipient_id is distinct from OLD.recipient_id
     or NEW.kind is distinct from OLD.kind
     or NEW.title is distinct from OLD.title
     or NEW.body is distinct from OLD.body
     or NEW.media_url is distinct from OLD.media_url
     or NEW.created_at is distinct from OLD.created_at
  then
    -- allow status / read changes for parties; block content forgery
    if NEW.status is not distinct from OLD.status
       and NEW.read is not distinct from OLD.read
    then
      raise exception 'share_card_mutate_denied';
    end if;
    -- restore immutable fields
    NEW.sender_id := OLD.sender_id;
    NEW.recipient_id := OLD.recipient_id;
    NEW.kind := OLD.kind;
    NEW.title := OLD.title;
    NEW.body := OLD.body;
    NEW.media_url := OLD.media_url;
    NEW.media_kind := OLD.media_kind;
    NEW.created_at := OLD.created_at;
    NEW.sender_name := OLD.sender_name;
    NEW.competition_id := OLD.competition_id;
    NEW.team_id := OLD.team_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists share_cards_guard_update_trg on public.share_cards;
create trigger share_cards_guard_update_trg
  before update on public.share_cards
  for each row execute function public.share_cards_guard_update();

-- Active account on message / share insert
drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and public.account_is_active()
  );

drop policy if exists "share_cards_insert_sender" on public.share_cards;
create policy "share_cards_insert_sender"
  on public.share_cards for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and public.account_is_active()
  );

-- ═══════════════════════════════════════════════════════════
-- 4) Offers — RPC instead of open blob overwrite
-- ═══════════════════════════════════════════════════════════

create or replace function public.upsert_offer_in_blob(p_offer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing jsonb;
  list jsonb;
  oid text;
  rid text;
  found boolean := false;
  i int;
  item jsonb;
  next_list jsonb := '[]'::jsonb;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  perform public.assert_account_active();
  if p_offer is null or jsonb_typeof(p_offer) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_offer');
  end if;

  rid := coalesce(p_offer->>'id', '');
  oid := coalesce(p_offer->>'organizerId', '');
  if rid = '' or oid = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;
  if oid <> me::text and not public.is_app_superadmin() then
    return jsonb_build_object('ok', false, 'error', 'not_organizer');
  end if;

  select payload into existing from public.app_blobs where key = 'offers' for update;
  list := coalesce(existing, '[]'::jsonb);
  if jsonb_typeof(list) <> 'array' then
    list := '[]'::jsonb;
  end if;

  for i in 0 .. greatest(jsonb_array_length(list) - 1, -1) loop
    item := list -> i;
    if item->>'id' = rid then
      if item->>'organizerId' is distinct from oid and not public.is_app_superadmin() then
        return jsonb_build_object('ok', false, 'error', 'offer_owner_mismatch');
      end if;
      -- organizer may refresh message while pending; do not let them forge accepted for others
      if coalesce(p_offer->>'status', 'pending') not in ('pending', 'accepted', 'declined') then
        return jsonb_build_object('ok', false, 'error', 'bad_status');
      end if;
      item := item || p_offer;
      next_list := next_list || jsonb_build_array(item);
      found := true;
    else
      next_list := next_list || jsonb_build_array(item);
    end if;
  end loop;

  if not found then
    if coalesce(p_offer->>'status', 'pending') <> 'pending'
       and not public.is_app_superadmin()
    then
      return jsonb_build_object('ok', false, 'error', 'new_must_be_pending');
    end if;
    next_list := next_list || jsonb_build_array(p_offer);
  end if;

  insert into public.app_blobs (key, payload, updated_at)
  values ('offers', next_list, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(next_list));
end;
$$;

revoke all on function public.upsert_offer_in_blob(jsonb) from public;
grant execute on function public.upsert_offer_in_blob(jsonb) to authenticated;

create or replace function public.set_offer_status(
  p_offer_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing jsonb;
  list jsonb;
  found boolean := false;
  i int;
  item jsonb;
  next_list jsonb := '[]'::jsonb;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  perform public.assert_account_active();
  if p_offer_id is null or p_offer_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_id');
  end if;
  if p_status is null or p_status not in ('accepted', 'declined', 'pending') then
    return jsonb_build_object('ok', false, 'error', 'bad_status');
  end if;

  select payload into existing from public.app_blobs where key = 'offers' for update;
  list := coalesce(existing, '[]'::jsonb);
  if jsonb_typeof(list) <> 'array' then
    list := '[]'::jsonb;
  end if;

  for i in 0 .. greatest(jsonb_array_length(list) - 1, -1) loop
    item := list -> i;
    if item->>'id' = p_offer_id then
      if item->>'freelancerId' <> me::text
         and item->>'organizerId' <> me::text
         and not public.is_app_superadmin()
      then
        return jsonb_build_object('ok', false, 'error', 'forbidden');
      end if;
      -- freelancers accept/decline; organizers may withdraw (declined) their own
      if item->>'freelancerId' = me::text and p_status not in ('accepted', 'declined') then
        return jsonb_build_object('ok', false, 'error', 'freelancer_status');
      end if;
      item := jsonb_set(item, '{status}', to_jsonb(p_status));
      next_list := next_list || jsonb_build_array(item);
      found := true;
    else
      next_list := next_list || jsonb_build_array(item);
    end if;
  end loop;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.app_blobs (key, payload, updated_at)
  values ('offers', next_list, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_offer_status(text, text) from public;
grant execute on function public.set_offer_status(text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 5) app_blobs policies — offers/referees via RPC only
-- ═══════════════════════════════════════════════════════════

drop policy if exists "app_blobs_insert_scoped" on public.app_blobs;
drop policy if exists "app_blobs_update_scoped" on public.app_blobs;
drop policy if exists "app_blobs_delete_scoped" on public.app_blobs;

create policy "app_blobs_insert_scoped"
  on public.app_blobs for insert
  to authenticated
  with check (
    public.is_app_superadmin()
    or (
      public.account_is_active()
      and (
        key = 'announcements:' || auth.uid()::text
        or key = 'prizes:' || auth.uid()::text
      )
    )
  );

create policy "app_blobs_update_scoped"
  on public.app_blobs for update
  to authenticated
  using (
    public.is_app_superadmin()
    or (
      public.account_is_active()
      and (
        key = 'announcements:' || auth.uid()::text
        or key = 'prizes:' || auth.uid()::text
      )
    )
  )
  with check (
    public.is_app_superadmin()
    or (
      public.account_is_active()
      and (
        key = 'announcements:' || auth.uid()::text
        or key = 'prizes:' || auth.uid()::text
      )
    )
  );

create policy "app_blobs_delete_scoped"
  on public.app_blobs for delete
  to authenticated
  using (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
  );

-- Gate existing RPCs with active account
create or replace function public.upsert_referee_in_blob(p_referee jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing jsonb;
  list jsonb;
  rid text;
  found boolean := false;
  i int;
  item jsonb;
  prev_avatar text;
  next_avatar text;
  next_list jsonb := '[]'::jsonb;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  perform public.assert_account_active();
  if p_referee is null or jsonb_typeof(p_referee) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_referee');
  end if;

  rid := coalesce(p_referee->>'id', '');
  if rid = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_id');
  end if;

  select payload into existing from public.app_blobs where key = 'referees';
  list := coalesce(existing, '[]'::jsonb);
  if jsonb_typeof(list) <> 'array' then
    list := '[]'::jsonb;
  end if;

  for i in 0 .. greatest(jsonb_array_length(list) - 1, -1) loop
    item := list -> i;
    if item->>'id' = rid then
      prev_avatar := nullif(item->>'avatar', '');
      item := item || p_referee;
      next_avatar := nullif(item->>'avatar', '');
      if next_avatar is null and prev_avatar is not null then
        item := jsonb_set(item, '{avatar}', to_jsonb(prev_avatar));
      end if;
      next_list := next_list || jsonb_build_array(item);
      found := true;
    else
      next_list := next_list || jsonb_build_array(item);
    end if;
  end loop;

  if not found then
    next_list := next_list || jsonb_build_array(p_referee);
  end if;

  insert into public.app_blobs (key, payload, updated_at)
  values ('referees', next_list, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = now();

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(next_list));
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- 6) Rate limit + security events (light)
-- ═══════════════════════════════════════════════════════════

create table if not exists public.security_events (
  id bigserial primary key,
  user_id uuid,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_events_action_idx
  on public.security_events (action, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists "security_events_select_admin" on public.security_events;
create policy "security_events_select_admin"
  on public.security_events for select
  to authenticated
  using (public.is_app_superadmin());

-- no direct insert from clients; use RPC

create or replace function public.log_security_event(
  p_action text,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_action is null or length(trim(p_action)) < 2 then
    return;
  end if;
  -- strip accidental secrets from meta
  p_meta := coalesce(p_meta, '{}'::jsonb) - 'password' - 'token' - 'access_token' - 'refresh_token';
  insert into public.security_events (user_id, action, meta)
  values (auth.uid(), left(trim(p_action), 80), p_meta);
end;
$$;

revoke all on function public.log_security_event(text, jsonb) from public;
grant execute on function public.log_security_event(text, jsonb) to authenticated;
grant execute on function public.log_security_event(text, jsonb) to anon;

create or replace function public.check_rate_limit(
  p_action text,
  p_max int default 30,
  p_window_seconds int default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cnt int;
begin
  if me is null then
    return false;
  end if;
  select count(*)::int into cnt
  from public.security_events
  where user_id = me
    and action = p_action
    and created_at > now() - make_interval(secs => greatest(p_window_seconds, 1));

  if cnt >= greatest(p_max, 1) then
    return false;
  end if;

  insert into public.security_events (user_id, action, meta)
  values (me, p_action, jsonb_build_object('kind', 'rate'));
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to authenticated;

-- Wrap DM send with active + mild rate limit
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
  begin
    perform public.assert_account_active();
  exception when others then
    return json_build_object('ok', false, 'error', 'account_not_active');
  end;
  if not public.check_rate_limit('dm_send', 60, 60) then
    return json_build_object('ok', false, 'error', 'rate_limited');
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
  if length(cleaned) > 4000 then
    return json_build_object('ok', false, 'error', 'too_long');
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

-- Gift append: require active account
create or replace function public.append_gift_transaction(p_gift jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing jsonb;
  gifter text;
  gift_id text;
  next_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_account_active();

  if p_gift is null or jsonb_typeof(p_gift) <> 'object' then
    raise exception 'invalid gift payload';
  end if;

  gifter := coalesce(p_gift->>'gifterId', '');
  gift_id := coalesce(p_gift->>'id', '');

  if gift_id = '' then
    raise exception 'gift id required';
  end if;

  if gifter <> auth.uid()::text then
    raise exception 'gifter must match authenticated user';
  end if;

  if not public.check_rate_limit('gift_append', 20, 60) then
    raise exception 'rate_limited';
  end if;

  select payload into existing
  from public.app_blobs
  where key = 'gift_transactions'
  for update;

  if existing is null then
    existing := '[]'::jsonb;
  elsif jsonb_typeof(existing) <> 'array' then
    existing := '[]'::jsonb;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(existing) e
    where e->>'id' = gift_id
  ) then
    return existing;
  end if;

  next_payload := jsonb_build_array(p_gift) || existing;

  insert into public.app_blobs (key, payload, updated_at)
  values ('gift_transactions', next_payload, now())
  on conflict (key) do update
    set payload = excluded.payload,
        updated_at = excluded.updated_at;

  return next_payload;
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- 7) Storage — size cap (100MB) keeps abuse bounded
-- ═══════════════════════════════════════════════════════════

update storage.buckets
set file_size_limit = 104857600
where id = 'share-media';

-- Competition writes require active account
drop policy if exists "app_competitions_insert_auth" on public.app_competitions;
create policy "app_competitions_insert_auth"
  on public.app_competitions for insert
  to authenticated
  with check (
    public.account_is_active()
    and (
      organizer_id = auth.uid()::text
      or public.is_app_superadmin()
    )
  );

drop policy if exists "app_competitions_update_auth" on public.app_competitions;
create policy "app_competitions_update_auth"
  on public.app_competitions for update
  to authenticated
  using (
    public.account_is_active()
    and (
      organizer_id = auth.uid()::text
      or public.is_app_superadmin()
    )
  )
  with check (
    public.account_is_active()
    and (
      organizer_id = auth.uid()::text
      or public.is_app_superadmin()
    )
  );

-- Private message insert (F13-P2-01 / F13-P1):
-- OBSOLETE — DO NOT recreate private_messages_insert_thread with
--   (owner_id = auth.uid() OR friend_id = auth.uid()) — inbox injection.
-- Own-inbox client INSERT only; peer inbox via send_private_message (SECURITY DEFINER).
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

select 'SECURITY-PHASE4-HARDENING applied' as status;
