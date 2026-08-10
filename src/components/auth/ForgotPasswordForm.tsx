import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Button, Input, Muted } from '@/components/ui';
import { isValidEmail, normalizeEmail } from '@/utils';
import { supabaseRequestPasswordReset } from '@/services/supabase-auth';
import { isSupabaseConfigured } from '@/services/supabase';
import { setPendingResetEmail } from '@/services/pending-auth-url';
import { cairoText } from '@/theme/fonts';

type Props = {
  initialEmail?: string;
  onBack: () => void;
};

/** نموذج نسيت كلمة المرور — يرسل رابط استعادة عبر Supabase */
export function ForgotPasswordForm({ initialEmail = '', onBack }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSend = useCallback(async () => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    if (!isSupabaseConfigured()) {
      toast({
        variant: 'destructive',
        title: t('auth.resetFailed'),
        description: t('auth.adminSupabaseMissingDesc'),
      });
      return;
    }
    setEmailError('');
    setBusy(true);
    try {
      const result = await supabaseRequestPasswordReset(normalized);
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: t('auth.resetFailed'),
          description:
            result.error === 'not_configured'
              ? t('auth.resetNoSupabase')
              : result.error || t('auth.resetOpenFromEmail'),
        });
        return;
      }
      setPendingResetEmail(normalized);
      toast({
        variant: 'success',
        title: t('auth.resetSentTitle'),
        description: t('auth.resetSentDesc'),
      });
      router.replace({
        pathname: '/(auth)/reset-password',
        params: { email: normalized },
      } as any);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: t('auth.resetFailed'),
        description:
          e instanceof Error ? e.message : t('auth.adminNetworkHint'),
      });
    } finally {
      setBusy(false);
    }
  }, [email, t, toast, router]);

  return (
    <View style={styles.form}>
      <Muted>{t('auth.forgotPasswordHint')}</Muted>
      <Input
        label={t('auth.email')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setEmailError('');
        }}
        placeholder="email@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        ltr
        error={emailError}
      />
      <Button
        label={t('auth.sendResetLink')}
        onPress={() => void onSend()}
        loading={busy}
        size="md"
      />
      <Pressable accessibilityRole="button" onPress={onBack}>
        <Text style={[styles.link, { color: theme.colors.accent }]}>
          {t('auth.backToLogin')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  link: {
    ...cairoText('semiBold'),
    fontSize: 13,
    textAlign: 'center',
  },
});
