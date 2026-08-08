import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import {
  supabaseConsumeAuthUrl,
  supabaseResetPasswordWithOtp,
  supabaseUpdatePassword,
} from '@/services/supabase-auth';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import {
  clearPendingAuthUrl,
  getAuthCallbackError,
  peekPendingAuthUrl,
  peekPendingResetEmail,
  setPendingResetEmail,
} from '@/services/pending-auth-url';
import { normalizeEmail, isValidEmail } from '@/utils';

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
 * شاشة تعيين كلمة مرور جديدة.
 * المسار الموثوق: رمز من الإيميل (OTP) — روابط البريد غالباً تُستهلك قبل أن يفتحها المستخدم.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState(t('auth.resetWaitingLink'));
  const readyRef = useRef(false);

  useEffect(() => {
    const fromQuery =
      typeof params.email === 'string' ? params.email : undefined;
    const fromStore = peekPendingResetEmail();
    const initial = normalizeEmail(fromQuery || fromStore || '');
    if (initial) setEmail(initial);
  }, [params.email]);

  const markReady = useCallback(() => {
    readyRef.current = true;
    setReady(true);
    setStatus(t('auth.resetReady'));
    clearPendingAuthUrl();
    stripAuthParamsFromWebUrl();
  }, [t]);

  const consume = useCallback(
    async (url: string | null) => {
      if (!url || !isSupabaseConfigured()) return false;
      const err = getAuthCallbackError(url);
      if (err === 'otp_expired') {
        setStatus(t('auth.resetOtpExpired'));
        return false;
      }
      if (err) {
        setStatus(err);
        return false;
      }
      if (!hrefHasAuthParams(url)) return false;
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
    [markReady, t]
  );

  useEffect(() => {
    let active = true;
    const sb = isSupabaseConfigured() ? getSupabase() : null;

    const run = async (url: string | null) => {
      if (!active || !url || readyRef.current) return;
      await consume(url);
    };

    void run(peekPendingAuthUrl());

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
      for (let i = 0; i < 8 && active && !readyRef.current; i++) {
        const { data } = await sb.auth.getSession();
        if (data.session) {
          markReady();
          return;
        }
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const href = window.location.href;
          if (hrefHasAuthParams(href) || peekPendingAuthUrl()) {
            const ok = await consume(href || peekPendingAuthUrl());
            if (ok) return;
          }
        } else {
          const pending = peekPendingAuthUrl();
          if (pending) {
            const ok = await consume(pending);
            if (ok) return;
          }
        }
        await sleep(200);
      }
      if (active && !readyRef.current) {
        setStatus(t('auth.resetUseOtpHint'));
      }
    })();

    return () => {
      active = false;
      linkSub.remove();
      authSub?.data.subscription.unsubscribe();
    };
  }, [consume, markReady, t]);

  const onSaveWithSession = useCallback(async () => {
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
      setPendingResetEmail(null);
      toast({
        variant: 'success',
        title: t('auth.resetSuccess'),
      });
      router.replace('/(auth)/login' as any);
    } finally {
      setBusy(false);
    }
  }, [password, confirm, toast, t, router]);

  const onSaveWithOtp = useCallback(async () => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      toast({
        variant: 'destructive',
        title: t('auth.invalidEmail'),
      });
      return;
    }
    if (otp.replace(/\s+/g, '').length < 6) {
      toast({
        variant: 'destructive',
        title: t('auth.resetOtpShort'),
      });
      return;
    }
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
      setPendingResetEmail(normalized);
      const result = await supabaseResetPasswordWithOtp({
        email: normalized,
        token: otp,
        password,
      });
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: t('auth.resetFailed'),
          description: result.error,
        });
        return;
      }
      setPendingResetEmail(null);
      clearPendingAuthUrl();
      toast({
        variant: 'success',
        title: t('auth.resetSuccess'),
      });
      router.replace('/(auth)/login' as any);
    } finally {
      setBusy(false);
    }
  }, [email, otp, password, confirm, toast, t, router]);

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('auth.forgotPasswordTitle')}</Title>
      <Muted>{status}</Muted>
      <Card style={styles.card}>
        {ready ? (
          <>
            <Subtitle>{t('auth.newPassword')}</Subtitle>
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
              onPress={() => void onSaveWithSession()}
              loading={busy}
            />
          </>
        ) : (
          <>
            <Subtitle>{t('auth.resetOtpSectionTitle')}</Subtitle>
            <Muted>{t('auth.resetOtpSectionHint')}</Muted>
            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              ltr
            />
            <Input
              label={t('auth.resetOtpLabel')}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              placeholder="123456"
              ltr
            />
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
              onPress={() => void onSaveWithOtp()}
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
