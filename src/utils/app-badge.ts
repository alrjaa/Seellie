import { Platform } from 'react-native';

const DEFAULT_TITLE = 'Seellie';
let baseTitle = DEFAULT_TITLE;

type NavigatorBadge = Navigator & {
  setAppBadge?: (count: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function webNavigator(): NavigatorBadge | undefined {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return undefined;
  return navigator as NavigatorBadge;
}

/** يحفظ عنوان الصفحة الأصلي مرة واحدة (ويب). */
export function rememberAppDocumentTitle(title = DEFAULT_TITLE) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const clean = (title || DEFAULT_TITLE).replace(/^\(\d+\)\s+/, '').trim();
  baseTitle = clean || DEFAULT_TITLE;
  document.title = baseTitle;
}

/**
 * شارة أيقونة التطبيق عبر Badging API فقط.
 * لا نعدّل document.title — تجنّباً لـ "Seellie (1)" في التبويب ونتائج البحث.
 */
export function setAppIconBadgeCount(count: number) {
  const safe = Math.max(0, Math.floor(count));
  const nav = webNavigator();

  if (safe <= 0) {
    clearAppIconBadge();
    return;
  }

  if (nav?.setAppBadge) {
    void nav.setAppBadge(safe).catch(() => undefined);
  }

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // أبقِ العنوان نظيفاً دائماً (بدون عدّاد)
    if (document.title !== baseTitle) {
      document.title = baseTitle;
    }
  }
}

export function clearAppIconBadge() {
  const nav = webNavigator();
  if (nav?.clearAppBadge) {
    void nav.clearAppBadge().catch(() => undefined);
  }
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.title = baseTitle;
  }
}
