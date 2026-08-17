import { useEffect, useState } from 'react';
import {
  fetchAppBlob,
  subscribeAppBlob,
} from '@/services/supabase-app-blobs';
import {
  NATIVE_ADS_BLOB_KEY,
  nativeAdsEqual,
  sanitizeNativeAdsPayload,
  type NativeInFeedAd,
} from '@/services/native-ads';

export function useNativeAds(): NativeInFeedAd[] {
  const [ads, setAds] = useState<NativeInFeedAd[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetchAppBlob<unknown>(NATIVE_ADS_BLOB_KEY);
      if (cancelled) return;
      const next = sanitizeNativeAdsPayload(res.data);
      setAds((prev) => (nativeAdsEqual(prev, next) ? prev : next));
    };
    void load();
    let stop: (() => void) | null = null;
    try {
      stop = subscribeAppBlob(NATIVE_ADS_BLOB_KEY, () => {
        void load();
      });
    } catch {
      stop = null;
    }
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return ads;
}
