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
  baseTitle = title || DEFAULT_TITLE;
}

/** شارة على أيقونة التطبيق / عنوان التبويب عند توفر Badging API. */
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
    document.title = `(${safe}) ${baseTitle}`;
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
