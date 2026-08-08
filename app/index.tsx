import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { isPasswordRecoveryUrl } from '@/services/pending-auth-url';

function webHref(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.location.href;
}

export default function Index() {
  const { currentUser, loading, routeForRole } = useTournament();

  // استعادة كلمة المرور من البريد تصل غالباً إلى الجذر (Site URL)
  // — لا نحوّلها لصفحة الدخول قبل شاشة تعيين كلمة المرور
  const href = webHref();
  if (href && isPasswordRecoveryUrl(href)) {
    return <Redirect href="/(auth)/reset-password" />;
  }

  if (loading) return <LoadingState />;
  if (currentUser) {
    return <Redirect href={routeForRole(currentUser.role) as any} />;
  }
  return <Redirect href="/(auth)/login" />;
}
