import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button, Input, Muted } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { useResponsive } from '@/hooks/useResponsive';
import { isValidEmail } from '@/utils';
import { isUuid } from '@/services/supabase-messages';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';
import { DEFAULT_LOGO, DEFAULT_LOGO_MODULE } from '@/theme/brand';
import { cairoText } from '@/theme/fonts';

/** دخول لوحة المشرف فقط — منفصل عن شاشة دخول التطبيق */
export default function AdminLoginScreen() {
  const {
    login,
    logout,
    appLogo,
    appName,
    currentUser,
    loading,
    routeForRole,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { formWidth } = useResponsive();

  const [forgotPassword, setForgotPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [busy, setBusy] = useState(false);

  // www.seellie.com قد يحتفظ بجلسة super.admin@test.com المحلية — امسحها لعرض دخول السحابة
  useEffect(() => {
    if (loading) return;
    if (currentUser && !isUuid(currentUser.id)) {
      logout({ silent: true });
    }
  }, [loading, currentUser, logout]);

  const handleLogin = useCallback(async () => {
    if (!isValidEmail(loginEmail)) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    setEmailError('');
    setBusy(true);
    try {
      await login(loginEmail, loginPassword, { portal: 'admin' });
    } finally {
      setBusy(false);
    }
  }, [login, loginEmail, loginPassword, t]);

  const gradientColors = useMemo(
    () =>
      theme.isDark
        ? (['#0d1a26', '#132433', '#0d1a26'] as const)
        : (['#F3F6F9', '#FFFFFF', '#E8FBFA'] as const),
    [theme.isDark]
  );

  if (loading) return <LoadingState />;

  // إعادة توجيه فقط للمشرف السحابي (UUID) — ليس الحساب التجريبي المحلي
  const isCloudAdmin =
    !!currentUser &&
    isUuid(currentUser.id) &&
    (currentUser.role === 'superadmin' ||
      currentUser.activeRole === 'superadmin');

  if (isCloudAdmin) {
    return (
      <Redirect
        href={
          routeForRole(currentUser.activeRole || currentUser.role) as any
        }
      />
    );
  }

  if (currentUser && !isUuid(currentUser.id)) {
    return <LoadingState />;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={[...gradientColors]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView
        edges={['top']}
        style={styles.topBarSafe}
        pointerEvents="box-none"
      >
        <View style={[styles.topBar, { paddingTop: HEADER_BELOW_STATUS_GAP }]}>
          <ThemeToggle />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.panel,
              {
                width: formWidth,
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.brand}>
              <Image
                source={
                  appLogo && appLogo !== DEFAULT_LOGO
                    ? { uri: appLogo }
                    : DEFAULT_LOGO_MODULE
                }
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel={t('auth.logoA11y')}
              />
              <Text style={[styles.brandEn, { color: theme.colors.accent }]}>
                {(appName || 'Seellie') + ' Admin'}
              </Text>
              <Text style={[styles.tagline, { color: theme.colors.textMuted }]}>
                {t('auth.adminTagline')}
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {forgotPassword
                ? t('auth.forgotPasswordTitle')
                : t('auth.adminLogin')}
            </Text>

            {forgotPassword ? (
              <ForgotPasswordForm
                initialEmail={loginEmail}
                onBack={() => setForgotPassword(false)}
              />
            ) : (
              <View style={styles.form}>
                <Input
                  label={t('auth.email')}
                  value={loginEmail}
                  onChangeText={(v) => {
                    setLoginEmail(v);
                    setEmailError('');
                  }}
                  placeholder="alrjaa.ns@gmail.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  ltr
                  error={emailError}
                />
                <Input
                  label={t('auth.password')}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  ltr
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setForgotPassword(true)}
                  style={styles.forgotWrap}
                >
                  <Text style={[styles.link, { color: theme.colors.accent }]}>
                    {t('auth.forgotPassword')}
                  </Text>
                </Pressable>
                <Muted>
                  دخول المشرف سحابي فقط. أنشئ حساباً من Sign up ثم رقِّه بـ
                  promote-admin.sql، أو استخدم set-admin-password.sql للحساب الحالي.
                </Muted>
                <Muted>{t('auth.adminDemoHint')}</Muted>
                <Button
                  label={t('auth.adminLogin')}
                  onPress={handleLogin}
                  loading={busy}
                  size="md"
                />
              </View>
            )}

            {!forgotPassword ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('auth.appLogin')}
                onPress={() => router.replace('/(auth)/login' as any)}
                style={styles.footerLink}
              >
                <Text style={[styles.link, { color: theme.colors.accent }]}>
                  {t('auth.appLogin')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topBarSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  topBar: {
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  panel: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
    gap: 16,
  },
  brand: { alignItems: 'center', gap: 4, marginBottom: 4 },
  logo: { width: 132, height: 132, marginBottom: 10, borderRadius: 20 },
  brandEn: {
    ...cairoText('extraBold'),
    fontSize: 22,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tagline: {
    ...cairoText('regular'),
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    ...cairoText('bold'),
    fontSize: 16,
    textAlign: 'center',
  },
  form: { gap: 12 },
  forgotWrap: { alignSelf: 'flex-start', marginTop: -4 },
  footerLink: { alignItems: 'center', marginTop: 4 },
  link: {
    ...cairoText('semiBold'),
    fontSize: 13,
    textAlign: 'center',
  },
});
