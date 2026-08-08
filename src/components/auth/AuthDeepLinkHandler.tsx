import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import {
  isPasswordRecoveryUrl,
  setPendingAuthUrl,
} from '@/services/pending-auth-url';

/**
 * يستقبل رابط استعادة كلمة المرور ويفتح شاشة التعيين داخل التطبيق
 * بدل ترك المتصفح على صفحة فارغة.
 */
export function AuthDeepLinkHandler() {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const openReset = (url: string | null) => {
      if (!url || !isPasswordRecoveryUrl(url)) return;
      if (handled.current === url) return;
      handled.current = url;
      setPendingAuthUrl(url);
      router.push('/(auth)/reset-password' as any);
    };

    void Linking.getInitialURL().then(openReset);
    const sub = Linking.addEventListener('url', ({ url }) => openReset(url));
    return () => sub.remove();
  }, [router]);

  return null;
}
