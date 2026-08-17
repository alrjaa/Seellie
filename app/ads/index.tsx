import { Redirect } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ADS_PORTAL_HOME } from '@/utils/ads-portal';

/** ads.seellie.com hub — login or dashboard */
export default function AdsIndexScreen() {
  const { currentUser, loading } = useTournament();
  if (loading) return <LoadingState />;
  if (currentUser) return <Redirect href={ADS_PORTAL_HOME as any} />;
  return <Redirect href="/ads/login" />;
}
