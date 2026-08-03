import { Redirect } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { LoadingState } from '@/components/feedback/LoadingState';

export default function Index() {
  const { currentUser, loading, routeForRole } = useTournament();

  if (loading) return <LoadingState />;
  if (currentUser) {
    return <Redirect href={routeForRole(currentUser.role) as any} />;
  }
  return <Redirect href="/(auth)/login" />;
}
