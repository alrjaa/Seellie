import { getSupabase } from '@/services/supabase';

const BUCKET = 'share-media';

/**
 * يرفع ملفاً محلياً إلى Supabase Storage ويعيد رابطاً عاماً HTTPS.
 */
export async function uploadShareMedia(
  localUri: string,
  kind: 'photo' | 'video',
  userId: string
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !localUri) return null;
  if (/^https?:\/\//i.test(localUri)) return localUri;

  try {
    const ext =
      kind === 'video'
        ? (localUri.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || 'mp4')
        : (localUri.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || 'jpg');
    const path = `${userId}/${Date.now()}.${ext.toLowerCase()}`;
    const response = await fetch(localUri);
    const blob = await response.blob();
    const contentType =
      blob.type ||
      (kind === 'video'
        ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}`
        : `image/${ext === 'png' ? 'png' : 'jpeg'}`);

    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType,
      upsert: false,
    });
    if (error) {
      console.warn('[supabase] upload', error.message);
      return null;
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch (e) {
    console.warn('[supabase] upload failed', e);
    return null;
  }
}
