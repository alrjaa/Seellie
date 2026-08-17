import { useCallback, useEffect, useState } from 'react';
import { useTournamentCore } from '@/providers/TournamentProvider';
import {
  hideNativeAd,
  loadAdPreferences,
  reportNativeAd,
  setPersonalizedAds,
  subscribeAdPreferences,
  unhideNativeAd,
  type AdPreferences,
} from '@/services/ad-preferences';
import { DEFAULT_AD_PREFERENCES } from '@/services/ad-preferences-core';
import { queueAdEvent } from '@/services/ad-events';

export function useAdPreferences() {
  const { currentUser } = useTournamentCore();
  const userId = currentUser?.id;
  const [prefs, setPrefs] = useState<AdPreferences>(DEFAULT_AD_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) {
      setPrefs(DEFAULT_AD_PREFERENCES);
      setReady(true);
      return;
    }
    let cancelled = false;
    void loadAdPreferences(userId).then((loaded) => {
      if (cancelled) return;
      setPrefs(loaded);
      setReady(true);
    });
    const stop = subscribeAdPreferences(userId, setPrefs);
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId]);

  const hideAd = useCallback(
    async (adId: string, placement?: string) => {
      if (!userId) return;
      await hideNativeAd(userId, adId);
      queueAdEvent({ adId, event: 'hide', placement });
    },
    [userId]
  );

  const reportAd = useCallback(
    async (adId: string, reason: string, placement?: string) => {
      if (!userId) return;
      await reportNativeAd(userId, adId);
      queueAdEvent({
        adId,
        event: 'report',
        placement,
        meta: reason.trim() ? { reason: reason.trim().slice(0, 200) } : undefined,
      });
    },
    [userId]
  );

  const unhideAd = useCallback(
    async (adId: string) => {
      if (!userId) return;
      await unhideNativeAd(userId, adId);
    },
    [userId]
  );

  const setPersonalized = useCallback(
    async (enabled: boolean) => {
      if (!userId) return;
      await setPersonalizedAds(userId, enabled);
    },
    [userId]
  );

  return {
    prefs,
    ready,
    hideAd,
    reportAd,
    unhideAd,
    setPersonalized,
  };
}
