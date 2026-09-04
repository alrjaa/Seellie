import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  fetchLiveNativeAds,
  nativeAdsEqual,
  subscribeLiveNativeAds,
} from '@/services/native-ads-feed';
import { filterLiveNativeAds } from '@/services/native-ads';
import { startForegroundInterval } from '@/services/sync-engine';
import type { NativeInFeedAd } from '@/services/native-ads';

const NATIVE_ADS_POLL_MS = 45_000;
/** Re-check schedule windows so ads vanish from the feed as soon as endAt passes. */
const NATIVE_ADS_SCHEDULE_TICK_MS = 30_000;

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
    const pruneExpired = () => {
      setAds((prev) => {
        const next = filterLiveNativeAds(prev);
        return nativeAdsEqual(prev, next) ? prev : next;
      });
    };
    void load();
    const stopBlob = subscribeLiveNativeAds(() => {
      void load();
    });
    const stopPoll = startForegroundInterval(NATIVE_ADS_POLL_MS, () => {
      void load();
    });
    const stopSchedule = startForegroundInterval(
      NATIVE_ADS_SCHEDULE_TICK_MS,
      pruneExpired
    );
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        pruneExpired();
        void load();
      }
    });
    return () => {
      cancelled = true;
      stopBlob?.();
      stopPoll();
      stopSchedule();
      appSub.remove();
    };
  }, []);

  return ads;
}
