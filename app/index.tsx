import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { isPasswordRecoveryUrl, getAuthCallbackError } from '@/services/pending-auth-url';

export default function Index() {
  const { currentUser, loading, routeForRole } = useTournament();
  const [webChecked, setWebChecked] = useState(Platform.OS !== 'web');
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setWebChecked(true);
      return;
    }
    const href = window.location.href;
    setRecovery(
      !!isPasswordRecoveryUrl(href) || !!getAuthCallbackError(href)
    );
    setWebChecked(true);
  }, []);

  if (!webChecked || loading) return <LoadingState />;

  // رجوع من بريد الاستعادة إلى الجذر → شاشة كلمة المرور (وليس الدخول)
  if (recovery) {
    return <Redirect href="/(auth)/reset-password" />;
  }

  if (currentUser) {
    return <Redirect href={routeForRole(currentUser.role) as any} />;
  }
  return <Redirect href="/(auth)/login" />;
}
