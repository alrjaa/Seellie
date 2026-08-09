alter table public.profiles
  add column if not exists content jsonb not null default '{}'::jsonb;

comment on column public.profiles.content is
  'App content payload: posts, media, analysisContent, personalityPhotos';

create index if not exists profiles_content_gin
  on public.profiles using gin (content);

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
  )
  with check (
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
