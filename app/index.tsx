import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import {
  captureWebAuthUrlEarly,
  isAuthCallbackUrl,
  peekPendingAuthUrl,
} from '@/services/pending-auth-url';

export default function Index() {
  const { currentUser, loading, routeForRole } = useTournament();
  const [webChecked, setWebChecked] = useState(Platform.OS !== 'web');
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setWebChecked(true);
      return;
    }
    // احفظ الهاش قبل أن يمسحه Redirect إلى /reset-password
    captureWebAuthUrlEarly();
    const href = window.location.href;
    setRecovery(!!isAuthCallbackUrl(href) || !!peekPendingAuthUrl());
    setWebChecked(true);
  }, []);

  if (!webChecked || loading) return <LoadingState />;

  if (recovery) {
    return <Redirect href="/(auth)/reset-password" />;
  }

  if (currentUser) {
    return <Redirect href={routeForRole(currentUser.role) as any} />;
  }
  return <Redirect href="/(auth)/login" />;
}
