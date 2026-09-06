import { Redirect, usePathname } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import {
  COMPLETE_PROFILE_HREF,
  isAppProfileComplete,
} from '@/utils/profile-completion';

function isProfileCompletionExempt(pathname: string | null | undefined) {
  const path = pathname || '';
  return (
    path.includes('complete-profile') ||
    path.includes('(auth)') ||
    path.includes('/login') ||
    path.includes('/reset-password') ||
    path.includes('/privacy') ||
    path.includes('/terms') ||
    path.includes('/about') ||
    path.startsWith('/admin') ||
    path.includes('/admin') ||
    path.startsWith('/ads') ||
    path.includes('/ads/')
  );
}

/**
 * يمنع الوصول لأي وظيفة في التطبيق قبل إكمال البيانات الإلزامية.
 */
export function ProfileCompletionGuard() {
  const { currentUser, loading } = useTournament();
  const pathname = usePathname();

  if (loading || !currentUser) return null;
  if (isAppProfileComplete(currentUser)) return null;
  if (isProfileCompletionExempt(pathname)) return null;

  return <Redirect href={COMPLETE_PROFILE_HREF as any} />;
}
