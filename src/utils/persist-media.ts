import * as FileSystem from 'expo-file-system/legacy';
import { createId } from '@/utils/id';

const SHARE_DIR = `${FileSystem.documentDirectory || ''}seellie-share/`;

/**
 * ينسخ URI مؤقتاً من الملتقط إلى مجلد دائم داخل التطبيق
 * حتى لا يختفي بعد تنظيف الكاش. المشاركة بين جهازين ما زالت تحتاج رفعاً سحابياً.
 */
export async function persistLocalMediaUri(
  uri: string,
  kind: 'photo' | 'video'
): Promise<string> {
  if (!uri) return uri;
  if (/^https?:\/\//i.test(uri)) return uri;
  if (uri.includes('seellie-share/')) return uri;

  try {
    if (!FileSystem.documentDirectory) return uri;
    const info = await FileSystem.getInfoAsync(SHARE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(SHARE_DIR, { intermediates: true });
    }
    const ext =
      kind === 'video' ? guessExt(uri, 'mp4') : guessExt(uri, 'jpg');
    const dest = `${SHARE_DIR}${createId('media')}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

function guessExt(uri: string, fallback: string): string {
  const clean = uri.split('?')[0] || uri;
  const m = clean.match(/\.([a-zA-Z0-9]+)$/);
  if (!m?.[1]) return fallback;
  const ext = m[1].toLowerCase();
  if (ext.length > 5) return fallback;
  return ext;
}
