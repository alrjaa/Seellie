-- FIX-01 · Storage notes (idempotent, non-destructive)
-- share-media remains public-read by product design (share cards / feed URLs).
-- Write/delete already scoped to auth.uid() folder prefix (see schema.sql / CONTENT-CLOUD.sql).

-- Re-assert size + public read (safe to re-run)
update storage.buckets
set file_size_limit = 104857600,
    public = true
where id = 'share-media';

-- Optional: restrict allowed MIME types at bucket level when supported
-- (Dashboard → Storage → share-media → Allowed MIME types)
-- Suggested:
--   image/jpeg, image/png, image/webp, video/mp4, video/webm, video/quicktime

-- Orphan strategy (application-enforced):
-- 1) On media/post/analysis delete, client calls storage.remove for URL path under {auth.uid()}/...
-- 2) Do NOT delete by guessing paths.
-- 3) Periodic admin audit: list objects whose path user_id has no profiles row (ops script, not auto-delete).

-- Ensure delete policy exists (idempotent)
drop policy if exists "share_media_delete_own" on storage.objects;
create policy "share_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'share-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
