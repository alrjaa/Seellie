import { getSupabase } from '@/services/supabase';

const BUCKET = 'share-media';

const ALLOWED_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
const ALLOWED_VIDEO_EXT = new Set(['mp4', 'mov', 'webm']);

/** حدود حجم تقريبية على العميل (الخادم: bucket 100MB في PHASE4) */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function normalizeExt(ext: string, kind: 'photo' | 'video'): string {
  if (kind === 'video' && ext === 'qt') return 'mov';
  if (ext === 'jpeg') return 'jpg';
  return ext;
}

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
  if (!userId || userId.includes('..') || userId.includes('/')) {
    console.warn('[supabase] upload refused: bad userId');
    return null;
  }

  try {
    const rawExt =
      localUri.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase() ||
      (kind === 'video' ? 'mp4' : 'jpg');
    const ext = normalizeExt(rawExt, kind);
    const allowExt = kind === 'video' ? ALLOWED_VIDEO_EXT : ALLOWED_IMAGE_EXT;
    if (!allowExt.has(ext)) {
      console.warn('[supabase] upload refused: extension', ext);
      return null;
    }
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
    const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    if (blob.size > maxBytes) {
      console.warn('[supabase] upload refused: size', blob.size);
      return null;
    }
    const contentType =
      blob.type && blob.type !== 'application/octet-stream'
        ? blob.type
        : kind === 'video'
          ? ext === 'mov'
            ? 'video/quicktime'
            : ext === 'webm'
              ? 'video/webm'
              : 'video/mp4'
          : ext === 'png'
            ? 'image/png'
            : ext === 'webp'
              ? 'image/webp'
              : 'image/jpeg';

    const mimeOk =
      (kind === 'photo' && contentType.startsWith('image/')) ||
      (kind === 'video' && contentType.startsWith('video/'));
    if (!mimeOk) {
      console.warn('[supabase] upload refused: mime', contentType);
      return null;
    }

    const uploadExt =
      kind === 'photo'
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
