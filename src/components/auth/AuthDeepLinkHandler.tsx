import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { usePathname, useRouter } from 'expo-router';
import {
  isAuthCallbackUrl,
  setPendingAuthUrl,
} from '@/services/pending-auth-url';

function currentWebUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.location.href;
}

/**
 * يفتح شاشة التعيين عند وجود رموز استعادة أو خطأ OTP في الرابط.
 */
export function AuthDeepLinkHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const openReset = (url: string | null) => {
      if (!url || !isAuthCallbackUrl(url)) return;
      if (handled.current === url) return;
      handled.current = url;
      setPendingAuthUrl(url);
      if (pathname?.includes('reset-password')) return;
      router.replace('/(auth)/reset-password' as any);
    };

    openReset(currentWebUrl());
    void Linking.getInitialURL().then(openReset);
    const sub = Linking.addEventListener('url', ({ url }) => openReset(url));
    return () => sub.remove();
  }, [router, pathname]);

  return null;
}
