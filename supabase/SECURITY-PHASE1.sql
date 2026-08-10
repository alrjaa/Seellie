-- Seellie · SECURITY-PHASE1
-- Paste in SQL Editor AFTER FIX-CLOUD-SYNC.sql, CONTENT-CLOUD-RPC.sql, APP-BLOBS.sql, SECURITY-HARDENING.sql
-- 1) Harden replace_profile_content
-- 2) Restrict app_blobs writes

-- Requires public.is_app_superadmin() from FIX-CLOUD-SYNC.sql

create or replace function public.merge_profile_social_json(
  old_content jsonb,
  incoming jsonb
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
begin
  result := coalesce(old_content, '{}'::jsonb);
  incoming := coalesce(incoming, '{}'::jsonb);

  -- following / followers: allow mirror updates from social actions
  if incoming ? 'following' then
    result := jsonb_set(result, '{following}', coalesce(incoming->'following', '[]'::jsonb), true);
  end if;
  if incoming ? 'followers' then
    result := jsonb_set(result, '{followers}', coalesce(incoming->'followers', '[]'::jsonb), true);
  end if;

  -- posts: merge likes by id only
  old_posts := coalesce(result->'posts', '[]'::jsonb);
  new_posts := coalesce(incoming->'posts', '[]'::jsonb);
  for post in select * from jsonb_array_elements(old_posts)
  loop
    incoming_post := null;
    select p into incoming_post
    from jsonb_array_elements(new_posts) p
    where p->>'id' = post->>'id'
    limit 1;
    if incoming_post is not null and incoming_post ? 'likes' then
      post := jsonb_set(post, '{likes}', coalesce(incoming_post->'likes', '[]'::jsonb), true);
    end if;
    merged_posts := merged_posts || jsonb_build_array(post);
  end loop;
  result := jsonb_set(result, '{posts}', merged_posts, true);

  -- media photos/videos: merge likes by id
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
    if incoming_item is not null and incoming_item ? 'likes' then
      item := jsonb_set(item, '{likes}', coalesce(incoming_item->'likes', '[]'::jsonb), true);
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
    if incoming_item is not null and incoming_item ? 'likes' then
      item := jsonb_set(item, '{likes}', coalesce(incoming_item->'likes', '[]'::jsonb), true);
    end if;
    merged_videos := merged_videos || jsonb_build_array(item);
  end loop;

  result := jsonb_set(
    result,
    '{media}',
    jsonb_build_object('photos', merged_photos, 'videos', merged_videos),
    true
  );

  -- analysisContent: merge likes (+ status only for admin path uses full replace)
  old_analysis := coalesce(result->'analysisContent', '[]'::jsonb);
  new_analysis := coalesce(incoming->'analysisContent', '[]'::jsonb);
  for analysis in select * from jsonb_array_elements(old_analysis)
  loop
    incoming_analysis := null;
    select a into incoming_analysis
    from jsonb_array_elements(new_analysis) a
    where a->>'id' = analysis->>'id'
    limit 1;
    if incoming_analysis is not null and incoming_analysis ? 'likes' then
      analysis := jsonb_set(
        analysis,
        '{likes}',
        coalesce(incoming_analysis->'likes', '[]'::jsonb),
        true
      );
    end if;
    merged_analysis := merged_analysis || jsonb_build_array(analysis);
  end loop;
  result := jsonb_set(result, '{analysisContent}', merged_analysis, true);

  -- analyst object: allow status updates mirrored from admin via full replace only;
  -- non-admin social path leaves analyst untouched

  return result;
end;
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

  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'profile not found';
  end if;

  -- Owner or superadmin: full replace
  if auth.uid() = p_id or public.is_app_superadmin() then
    update public.profiles
    set
      content = coalesce(p_content, '{}'::jsonb),
      updated_at = now()
    where id = p_id;
    return;
  end if;

  -- Other authenticated users: social merge only (likes / follow mirrors)
  select content into old_content
  from public.profiles
  where id = p_id
  for update;

  merged := public.merge_profile_social_json(old_content, p_content);

  update public.profiles
  set
    content = merged,
    updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.merge_profile_social_json(jsonb, jsonb) to authenticated;
grant execute on function public.replace_profile_content(uuid, jsonb) to authenticated;

-- Restrict app_blobs writes
-- Remaining open keys (`offers`, `gift_transactions`): any authenticated user can
-- overwrite the shared blob. Mitigate gifts with SECURITY-PHASE2-BLOBS.sql
-- (append_gift_transaction RPC). Offers stay open so organizers can send and
-- freelancers can accept/decline without breaking the purchase flow.
drop policy if exists "app_blobs_upsert_auth" on public.app_blobs;
drop policy if exists "app_blobs_update_auth" on public.app_blobs;
drop policy if exists "app_blobs_delete_auth" on public.app_blobs;
drop policy if exists "app_blobs_insert_scoped" on public.app_blobs;
drop policy if exists "app_blobs_update_scoped" on public.app_blobs;
drop policy if exists "app_blobs_delete_scoped" on public.app_blobs;

create policy "app_blobs_insert_scoped"
  on public.app_blobs for insert
  to authenticated
  with check (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
    or key in ('offers', 'gift_transactions')
  );

create policy "app_blobs_update_scoped"
  on public.app_blobs for update
  to authenticated
  using (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
    or key in ('offers', 'gift_transactions')
  )
  with check (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
    or key in ('offers', 'gift_transactions')
  );

create policy "app_blobs_delete_scoped"
  on public.app_blobs for delete
  to authenticated
  using (
    public.is_app_superadmin()
    or key = 'announcements:' || auth.uid()::text
    or key = 'prizes:' || auth.uid()::text
  );
