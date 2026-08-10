import { getSupabase } from '@/services/supabase';

const BUCKET = 'share-media';

/**
 * يرفع ملفاً محلياً إلى Supabase Storage ويعيد رابطاً عاماً HTTPS.
 * folder مثل: shares | competitions | matches | users | forums | avatars
 */
export async function uploadAppMedia(
  localUri: string,
  kind: 'photo' | 'video',
  userId: string,
  folder = 'uploads'
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !localUri) return null;
  if (/^https?:\/\//i.test(localUri)) return localUri;

  try {
    const rawExt =
      localUri.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase() ||
      (kind === 'video' ? 'mp4' : 'jpg');
    // على الويب/أندرويد .mov غالباً لا يُشغَّل — نُبقي الامتداد الحقيقي مع نوع محتوى أوضح
    const ext = kind === 'video' && rawExt === 'qt' ? 'mov' : rawExt;
    const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '') || 'uploads';
    const response = await fetch(localUri);
    if (!response.ok) {
      console.warn('[supabase] upload fetch', response.status);
      return null;
    }
    const blob = await response.blob();
    if (!blob || blob.size <= 0) {
      console.warn('[supabase] upload empty blob');
      return null;
    }
    const contentType =
      blob.type && blob.type !== 'application/octet-stream'
        ? blob.type
        : kind === 'video'
          ? ext === 'mov' || ext === 'qt'
            ? 'video/quicktime'
            : ext === 'webm'
              ? 'video/webm'
              : 'video/mp4'
          : ext === 'png'
            ? 'image/png'
            : ext === 'webp'
              ? 'image/webp'
              : 'image/jpeg';

    // على الويب blob بدون امتداد واضح → فرض jpeg/png من نوع المحتوى
    const uploadExt =
      kind === 'photo' && (ext === 'jpg' || ext.length > 4)
        ? contentType.includes('png')
          ? 'png'
          : contentType.includes('webp')
            ? 'webp'
            : 'jpg'
        : ext;
    const uploadPath = `${userId}/${safeFolder}/${Date.now()}.${uploadExt}`;

    const { error } = await sb.storage.from(BUCKET).upload(uploadPath, blob, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });
    if (error) {
      console.warn('[supabase] upload', error.message);
      return null;
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(uploadPath);
    return data.publicUrl || null;
  } catch (e) {
    console.warn('[supabase] upload failed', e);
    return null;
  }
}

/** توافق مع المسارات القديمة (بطاقات المشاركة) */
export async function uploadShareMedia(
  localUri: string,
  kind: 'photo' | 'video',
  userId: string
): Promise<string | null> {
  return uploadAppMedia(localUri, kind, userId, 'shares');
}
