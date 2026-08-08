import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import {
  supabaseConsumeAuthUrl,
  supabaseUpdatePassword,
} from '@/services/supabase-auth';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { takePendingAuthUrl, getAuthCallbackError } from '@/services/pending-auth-url';

function stripAuthParamsFromWebUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const clean = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, clean);
  } catch {
    // ignore
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function hrefHasAuthParams(href: string): boolean {
  return (
    href.includes('access_token=') ||
    href.includes('refresh_token=') ||
    href.includes('code=') ||
    href.includes('token_hash=') ||
    href.includes('type=recovery')
  );
}

/**
 * شاشة تعيين كلمة مرور جديدة بعد فتح رابط الاستعادة من البريد.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState(t('auth.resetWaitingLink'));
  const readyRef = useRef(false);

  const markReady = useCallback(() => {
    readyRef.current = true;
    setReady(true);
    setStatus(t('auth.resetReady'));
    stripAuthParamsFromWebUrl();
  }, [t]);

  const consume = useCallback(
    async (url: string | null) => {
      if (!url || !isSupabaseConfigured()) return false;
      const result = await supabaseConsumeAuthUrl(url);
      if (result.ok) {
        markReady();
        return true;
      }
      if (result.error && result.error !== 'no_tokens') {
        setStatus(result.error);
      }
      return false;
    },
    [markReady]
  );

  useEffect(() => {
    let active = true;
    const sb = isSupabaseConfigured() ? getSupabase() : null;

    const run = async (url: string | null) => {
      if (!active || !url || readyRef.current) return;
      await consume(url);
    };

    void run(takePendingAuthUrl());

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const href = window.location.href;
      const authErr = getAuthCallbackError(href);
      if (authErr === 'otp_expired') {
        setStatus(t('auth.resetOtpExpired'));
      } else if (authErr) {
        setStatus(authErr);
      } else {
        void run(href);
      }
    }

    void Linking.getInitialURL().then((url) => {
      void run(url);
    });
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      void run(url);
    });

    const authSub = sb?.auth.onAuthStateChange((event, session) => {
      if (!active || !session) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        markReady();
      }
    });

    void (async () => {
      if (!sb) {
        if (active) setStatus(t('auth.resetNoSupabase'));
        return;
      }
      for (let i = 0; i < 12 && active && !readyRef.current; i++) {
        const { data } = await sb.auth.getSession();
        if (data.session) {
          markReady();
          return;
        }
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const href = window.location.href;
          if (hrefHasAuthParams(href)) {
            const ok = await consume(href);
            if (ok) return;
          }
        }
        await sleep(250);
      }
      if (active && !readyRef.current) {
        setStatus(t('auth.resetLinkInvalid'));
      }
    })();

    return () => {
      active = false;
      linkSub.remove();
      authSub?.data.subscription.unsubscribe();
    };
  }, [consume, markReady, t]);

  const onSave = useCallback(async () => {
    if (password.trim().length < 6) {
      toast({
        variant: 'destructive',
        title: t('auth.resetPasswordShort'),
      });
      return;
    }
    if (password !== confirm) {
      toast({
        variant: 'destructive',
        title: t('auth.resetPasswordMismatch'),
      });
      return;
    }
    setBusy(true);
    try {
      const result = await supabaseUpdatePassword(password);
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: t('auth.resetFailed'),
          description: result.error,
        });
        return;
      }
      toast({
        variant: 'success',
        title: t('auth.resetSuccess'),
      });
      router.replace('/(auth)/login' as any);
    } finally {
      setBusy(false);
    }
  }, [password, confirm, toast, t, router]);

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('auth.forgotPasswordTitle')}</Title>
      <Muted>{status}</Muted>
      <Card style={styles.card}>
        <Subtitle>{t('auth.newPassword')}</Subtitle>
        {!ready ? (
          <Muted>{t('auth.resetOpenFromEmail')}</Muted>
        ) : (
          <>
            <Input
              label={t('auth.newPassword')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              ltr
            />
            <Input
              label={t('auth.confirmPassword')}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              ltr
            />
            <Button
              label={t('auth.saveNewPassword')}
              onPress={() => void onSave()}
              loading={busy}
            />
          </>
        )}
        <Button
          label={t('auth.backToLogin')}
          variant="ghost"
          onPress={() => router.replace('/(auth)/login' as any)}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, gap: 14, paddingBottom: 40 },
  card: { gap: 12 },
});
