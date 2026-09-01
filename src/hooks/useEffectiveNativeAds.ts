import { useMemo } from 'react';
import { useNativeAds } from '@/hooks/useNativeAds';
import { useAdPreferences } from '@/hooks/useAdPreferences';
import { useTournamentCore } from '@/providers/TournamentProvider';
import { filterHiddenNativeAds, type NativeInFeedAd } from '@/services/native-ads';
import { mergeSafeTestNativeAd } from '@/services/native-ads-test';

/** Native ads minus user-hidden items — keeps TournamentProvider lean. */
export function useEffectiveNativeAds(): NativeInFeedAd[] {
  const ads = useNativeAds();
  const { prefs } = useAdPreferences();
  const { currentUser } = useTournamentCore();
  return useMemo(
    () =>
      mergeSafeTestNativeAd(
        filterHiddenNativeAds(ads, prefs.hiddenAdIds),
        currentUser?.email
      ),
    [ads, prefs.hiddenAdIds, currentUser?.email]
  );
}
