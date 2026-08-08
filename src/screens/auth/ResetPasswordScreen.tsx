import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { isSupabaseConfigured } from '@/services/supabase';
import { takePendingAuthUrl } from '@/services/pending-auth-url';

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

  const consume = useCallback(
    async (url: string | null) => {
      if (!url || !isSupabaseConfigured()) return;
      const result = await supabaseConsumeAuthUrl(url);
      if (result.ok) {
        setReady(true);
        setStatus(t('auth.resetReady'));
      } else if (result.error && result.error !== 'no_tokens') {
        setStatus(result.error);
      }
    },
    [t]
  );

  useEffect(() => {
    let active = true;

    const run = async (url: string | null) => {
      if (!active || !url) return;
      await consume(url);
    };

    // رابط محفوظ من معالج الروابط العميقة
    void run(takePendingAuthUrl());

    void Linking.getInitialURL().then((url) => {
      void run(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      void run(url);
    });

    // إن فُتحت الشاشة بعد جلسة استعادة قائمة
    void (async () => {
      if (!isSupabaseConfigured()) return;
      const { getSupabase } = await import('@/services/supabase');
      const sb = getSupabase();
      const { data } = await sb!.auth.getSession();
      if (active && data.session) {
        setReady(true);
        setStatus(t('auth.resetReady'));
      }
    })();

    return () => {
      active = false;
      sub.remove();
    };
  }, [consume, t]);

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
      <Title>{t('auth.forgotPassword')}</Title>
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
