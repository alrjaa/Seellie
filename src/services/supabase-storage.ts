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

function extFromUriOrMime(
  localUri: string,
  kind: 'photo' | 'video',
  mime?: string
): string {
  // blob:/data: على الويب غالباً بلا امتداد
  if (/^(blob:|data:)/i.test(localUri)) {
    if (mime?.includes('png')) return 'png';
    if (mime?.includes('webp')) return 'webp';
    if (mime?.includes('webm')) return 'webm';
    if (mime?.includes('quicktime') || mime?.includes('mov')) return 'mov';
    return kind === 'video' ? 'mp4' : 'jpg';
  }
  const raw =
    localUri.match(/\.([a-z0-9]+)(?:\?|#|$)/i)?.[1]?.toLowerCase() ||
    (kind === 'video' ? 'mp4' : 'jpg');
  return normalizeExt(raw, kind);
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
    const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '') || 'uploads';
    const response = await fetch(localUri);
    // بعض متصفحات الويب لا تضع status صحيحاً لـ blob:
    if (!response.ok && !/^(blob:|data:)/i.test(localUri)) {
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
          ? 'video/mp4'
          : 'image/jpeg';

    const mimeOk =
      (kind === 'photo' &&
        (contentType.startsWith('image/') || !blob.type)) ||
      (kind === 'video' &&
        (contentType.startsWith('video/') || !blob.type));
    if (!mimeOk) {
      console.warn('[supabase] upload refused: mime', contentType);
      return null;
    }

    const ext = extFromUriOrMime(localUri, kind, contentType);
    const allowExt = kind === 'video' ? ALLOWED_VIDEO_EXT : ALLOWED_IMAGE_EXT;
    if (!allowExt.has(ext)) {
      console.warn('[supabase] upload refused: extension', ext);
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
      contentType:
        kind === 'photo'
          ? uploadExt === 'png'
            ? 'image/png'
            : uploadExt === 'webp'
              ? 'image/webp'
              : 'image/jpeg'
          : contentType,
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

/**
 * يستخرج مسار الكائن داخل bucket من رابط عام HTTPS.
 * لا يحذف إلا مسارات مملوكة للمستخدم الحالي (أو مشرف عبر RLS).
 */
export function storagePathFromPublicUrl(url: string): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx < 0) return null;
    const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0] || '');
    if (!path || path.includes('..')) return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * حذف ملف من share-media عند حذف مرجع DB (MEDIA-03).
 * يعتمد على ownership عبر RLS — لا تخمين مسارات عشوائية.
 */
export async function deleteAppMediaByUrl(
  url: string,
  expectedUserId?: string
): Promise<{ ok: boolean; error?: string }> {
  const path = storagePathFromPublicUrl(url);
  if (!path) return { ok: true }; // ليس ملف سحابة — لا شيء لحذفه
  if (expectedUserId && !path.startsWith(`${expectedUserId}/`)) {
    return { ok: false, error: 'path_ownership_mismatch' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { error } = await sb.storage.from(BUCKET).remove([path]);
  if (error) {
    console.warn('[supabase] storage delete', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
