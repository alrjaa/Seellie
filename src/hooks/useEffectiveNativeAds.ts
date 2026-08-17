import { useMemo } from 'react';
import { useNativeAds } from '@/hooks/useNativeAds';
import { useAdPreferences } from '@/hooks/useAdPreferences';
import { filterHiddenNativeAds, type NativeInFeedAd } from '@/services/native-ads';

/** Native ads minus user-hidden items — keeps TournamentProvider lean. */
export function useEffectiveNativeAds(): NativeInFeedAd[] {
  const ads = useNativeAds();
  const { prefs } = useAdPreferences();
  return useMemo(
    () => filterHiddenNativeAds(ads, prefs.hiddenAdIds),
    [ads, prefs.hiddenAdIds]
  );
}
