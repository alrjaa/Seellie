import { useEffect, useState } from 'react';
import {
  fetchLiveNativeAds,
  nativeAdsEqual,
  subscribeLiveNativeAds,
} from '@/services/native-ads-feed';
import type { NativeInFeedAd } from '@/services/native-ads';

export function useNativeAds(): NativeInFeedAd[] {
  const [ads, setAds] = useState<NativeInFeedAd[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await fetchLiveNativeAds();
      if (cancelled) return;
      setAds((prev) => (nativeAdsEqual(prev, next) ? prev : next));
    };
    void load();
    const stop = subscribeLiveNativeAds(() => {
      void load();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return ads;
}
