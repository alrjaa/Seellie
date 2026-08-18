import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  fetchLiveNativeAds,
  nativeAdsEqual,
  subscribeLiveNativeAds,
} from '@/services/native-ads-feed';
import { startForegroundInterval } from '@/services/sync-engine';
import type { NativeInFeedAd } from '@/services/native-ads';

const NATIVE_ADS_POLL_MS = 45_000;

export function useNativeAds(): NativeInFeedAd[] {
  const [ads, setAds] = useState<NativeInFeedAd[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchLiveNativeAds();
        if (cancelled) return;
        setAds((prev) => (nativeAdsEqual(prev, next) ? prev : next));
      } catch (error) {
        console.warn('[useNativeAds] fetch failed', error);
      }
    };
    void load();
    const stopBlob = subscribeLiveNativeAds(() => {
      void load();
    });
    const stopPoll = startForegroundInterval(NATIVE_ADS_POLL_MS, () => {
      void load();
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      cancelled = true;
      stopBlob?.();
      stopPoll();
      appSub.remove();
    };
  }, []);

  return ads;
}
