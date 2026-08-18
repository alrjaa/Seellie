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

async function fetchAdsFromBlob(): Promise<NativeInFeedAd[]> {
  try {
    const blobRes = await fetchAppBlob<unknown>(NATIVE_ADS_BLOB_KEY);
    return sanitizeNativeAdsPayload(blobRes.data);
  } catch (error) {
    console.warn('[native-ads-feed] blob fetch failed', error);
    return [];
  }
}

async function fetchAdsFromDb(): Promise<NativeInFeedAd[]> {
  try {
    const dbRaw = await fetchPublicNativeAdsFromDb();
    return sanitizeNativeAdsPayload(parseDbAdsRaw(dbRaw));
  } catch (error) {
    console.warn('[native-ads-feed] db fetch failed', error);
    return [];
  }
}

let inflightFetch: Promise<NativeInFeedAd[]> | null = null;

/**
 * Ads catalog only. Must never throw — General/Highlights render organic
 * content from local state and must not wait on this call.
 */
export async function fetchLiveNativeAds(): Promise<NativeInFeedAd[]> {
  if (inflightFetch) return inflightFetch;
  inflightFetch = (async () => {
    const [blobAds, dbAds] = await Promise.all([
      fetchAdsFromBlob(),
      fetchAdsFromDb(),
    ]);
    const seen = new Set<string>();
    const merged: NativeInFeedAd[] = [];
    for (const ad of [...dbAds, ...blobAds]) {
      if (seen.has(ad.id)) continue;
      seen.add(ad.id);
      merged.push(ad);
      if (merged.length >= 40) break;
    }
    return merged;
  })();
  try {
    return await inflightFetch;
  } catch (error) {
    console.warn('[native-ads-feed] merge failed', error);
    return [];
  } finally {
    inflightFetch = null;
  }
}

export function subscribeLiveNativeAds(onChange: () => void): () => void {
  const stopBlob = subscribeAppBlob(NATIVE_ADS_BLOB_KEY, onChange);
  return () => stopBlob?.();
}

export { nativeAdsEqual };
