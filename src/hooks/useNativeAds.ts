import { useEffect, useState } from 'react';
import {
  fetchAppBlob,
  subscribeAppBlob,
} from '@/services/supabase-app-blobs';
import {
  NATIVE_ADS_BLOB_KEY,
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
      setAds(sanitizeNativeAdsPayload(res.data));
    };
    void load();
    const stop = subscribeAppBlob(NATIVE_ADS_BLOB_KEY, () => {
      void load();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return ads;
}
