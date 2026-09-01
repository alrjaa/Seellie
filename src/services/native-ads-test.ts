/**
 * TEMPORARY Safe-Test-only native ad.
 * Not a production campaign. Remove after ad-integration retest.
 *
 * TEST_AD_URL_MODE = TEMPORARY
 * TEST_AD_URL_SCOPE = SAFE_TEST_ONLY
 */
import type { NativeInFeedAd } from '@/services/native-ads';

export const TEST_AD_URL = 'https://xxxxx.com';
/** CTA only — not a video source. */
export const TEST_AD_CTA_URL = 'https://www.seellie.com/';
export const TEST_AD_URL_MODE = 'TEMPORARY' as const;
export const TEST_AD_URL_SCOPE = 'SAFE_TEST_ONLY' as const;
export const TEST_AD_ID = 'safe-test-xxxxx';

/** Matches the diagnostic follower account prefix — never all production users. */
export function isSafeTestNativeAdUser(email?: string | null): boolean {
  return /^safetest\.follower\./i.test(String(email || '').trim());
}

export function buildSafeTestNativeAd(): NativeInFeedAd {
  const now = new Date().toISOString();
  return {
    id: TEST_AD_ID,
    status: 'active',
    advertiserName: 'Safe Test',
    title: 'Safe test ad',
    text: 'Temporary test placement',
    hookText: 'Test ad',
    videoUrl: TEST_AD_URL,
    ctaLabel: 'Seellie',
    ctaUrl: TEST_AD_CTA_URL,
    durationSec: 8,
    placements: ['general', 'highlights', 'unique'],
    insertEveryN: 4,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeSafeTestNativeAd(
  ads: NativeInFeedAd[],
  email?: string | null
): NativeInFeedAd[] {
  const list = Array.isArray(ads) ? ads : [];
  if (!isSafeTestNativeAdUser(email)) return list;
  if (list.some((ad) => ad.id === TEST_AD_ID)) return list;
  return [buildSafeTestNativeAd(), ...list];
}
