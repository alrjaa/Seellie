import { Platform } from 'react-native';

/** مسار بوابة المشرف بالكامل — منفصل عن مسارات التطبيق العامة */
export const ADMIN_PORTAL_BASE = '/admin';
export const ADMIN_HOME = '/admin/home';
export const ADMIN_LOGIN = '/admin';

export function adminPath(segment = ''): string {
  const clean = segment.replace(/^\/+/, '');
  return clean ? `${ADMIN_PORTAL_BASE}/${clean}` : ADMIN_PORTAL_BASE;
}

/** مضيف فرعي اختياري: admin.seellie.com */
export function isAdminHostname(hostname?: string): boolean {
  const host =
    hostname ||
    (Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.hostname
      : '');
  if (!host) return false;
  const h = host.toLowerCase();
  return h === 'admin.seellie.com' || h.startsWith('admin.');
}

export function isAdminPathname(pathname?: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname.includes('(console)') ||
    pathname.includes('/admin')
  );
}
