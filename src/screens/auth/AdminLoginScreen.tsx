import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button, Input, Muted } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useResponsive } from '@/hooks/useResponsive';
import { isValidEmail } from '@/utils';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';
import { DEFAULT_LOGO_MODULE } from '@/theme/brand';

/** دخول لوحة المشرف فقط — منفصل عن شاشة دخول التطبيق */
export default function AdminLoginScreen() {
  const { login, appLogo, appName, currentUser, loading, routeForRole } =
    useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { formWidth } = useResponsive();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = useCallback(() => {
    if (!isValidEmail(loginEmail)) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    setEmailError('');
    setBusy(true);
    login(loginEmail, loginPassword, { portal: 'admin' });
    setBusy(false);
  }, [login, loginEmail, loginPassword, t]);

  const gradientColors = useMemo(
    () =>
      theme.isDark
        ? (['#0B1F17', '#102820', '#0B1F17'] as const)
        : (['#E4EFE9', '#F2F6F4', '#D7E8DE'] as const),
    [theme.isDark]
  );

  if (loading) return <LoadingState />;
  if (currentUser) {
    return (
      <Redirect
        href={
          routeForRole(currentUser.activeRole || currentUser.role) as any
        }
      />
    );
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
                  appLogo ? { uri: appLogo } : DEFAULT_LOGO_MODULE
                }
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel={t('auth.logoA11y')}
              />
              <Text style={[styles.brandEn, { color: theme.colors.primary }]}>
                {(appName || 'Seellie') + ' Admin'}
              </Text>
              <Text style={[styles.tagline, { color: theme.colors.textMuted }]}>
                {t('auth.adminTagline')}
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('auth.adminLogin')}
            </Text>

            <View style={styles.form}>
              <Input
                label={t('auth.email')}
                value={loginEmail}
                onChangeText={(v) => {
                  setLoginEmail(v);
                  setEmailError('');
                }}
                placeholder="super.admin@test.com"
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
              <Muted>{t('auth.adminDemoHint')}</Muted>
              <Button
                label={t('auth.adminLogin')}
                onPress={handleLogin}
                loading={busy}
              />
            </View>
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
    gap: 18,
  },
  brand: { alignItems: 'center', gap: 4, marginBottom: 4 },
  logo: { width: 120, height: 120, marginBottom: 10, borderRadius: 16 },
  brandEn: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  tagline: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', textAlign: 'left' },
  form: { gap: 12 },
});
