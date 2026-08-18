import {
  fetchAppBlob,
  subscribeAppBlob,
} from '@/services/supabase-app-blobs';
import { fetchPublicNativeAdsFromDb } from '@/services/advertiser-platform';
import {
  NATIVE_ADS_BLOB_KEY,
  nativeAdsEqual,
  sanitizeNativeAdsPayload,
  type NativeInFeedAd,
} from '@/services/native-ads';

/** Blob (superadmin legacy) + DB (advertiser platform). */
function parseDbAdsRaw(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return raw ? [raw] : [];
}

export async function fetchLiveNativeAds(): Promise<NativeInFeedAd[]> {
  const [blobRes, dbRaw] = await Promise.all([
    fetchAppBlob<unknown>(NATIVE_ADS_BLOB_KEY),
    fetchPublicNativeAdsFromDb(),
  ]);
  const blobAds = sanitizeNativeAdsPayload(blobRes.data);
  const dbAds = sanitizeNativeAdsPayload(parseDbAdsRaw(dbRaw));
  const seen = new Set<string>();
  const merged: NativeInFeedAd[] = [];
  for (const ad of [...dbAds, ...blobAds]) {
    if (seen.has(ad.id)) continue;
    seen.add(ad.id);
    merged.push(ad);
    if (merged.length >= 40) break;
  }
  return merged;
}

export function subscribeLiveNativeAds(onChange: () => void): () => void {
  const stopBlob = subscribeAppBlob(NATIVE_ADS_BLOB_KEY, onChange);
  return () => stopBlob?.();
}

export { nativeAdsEqual };
