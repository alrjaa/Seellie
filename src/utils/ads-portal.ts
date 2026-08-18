import { Platform } from 'react-native';

/** Future advertiser portal — separate from user app routes. */
export const ADS_PORTAL_BASE = '/ads';
export const ADS_PORTAL_HOME = '/ads/home';

export function adsPath(segment = ''): string {
  const clean = segment.replace(/^\/+/, '');
  return clean ? `${ADS_PORTAL_BASE}/${clean}` : ADS_PORTAL_BASE;
}

/** Optional subdomain: ads.seellie.com */
export function isAdsHostname(hostname?: string): boolean {
  const host =
    hostname ||
    (Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.hostname
      : '');
  if (!host) return false;
  const h = host.toLowerCase();
  return h === 'ads.seellie.com' || h.startsWith('ads.');
}

export function isAdsPathname(pathname?: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/ads' || pathname.startsWith('/ads/');
}
