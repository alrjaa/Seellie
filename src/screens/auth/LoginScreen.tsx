import React, { useCallback, useMemo, useState } from 'react';
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

export default function LoginScreen() {
  const {
    login,
    signUp,
    appLogo,
    appName,
    currentUser,
    loading,
    routeForRole,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { formWidth } = useResponsive();

  const [isSigningUp, setIsSigningUp] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = useCallback(() => {
    if (!isValidEmail(loginEmail)) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    setEmailError('');
    setBusy(true);
    login(loginEmail, loginPassword, { portal: 'app' });
    setBusy(false);
  }, [login, loginEmail, loginPassword, t]);

  const handleSignUp = useCallback(() => {
    if (!isValidEmail(signUpEmail)) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    setEmailError('');
    setBusy(true);
    signUp({ name: signUpName, email: signUpEmail }, signUpPassword);
    setBusy(false);
  }, [signUp, signUpName, signUpEmail, signUpPassword, t]);

  const gradientColors = useMemo(
    () =>
      theme.isDark
        ? (['#0B1F17', '#143528', '#0B1F17'] as const)
        : (['#E8F5EE', '#F3F7F5', '#DCEEE4'] as const),
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

      <SafeAreaView edges={['top']} style={styles.topBarSafe} pointerEvents="box-none">
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
                {appName || 'Seellie'}
              </Text>
              <Text style={[styles.tagline, { color: theme.colors.textMuted }]}>
                {t('auth.tagline')}
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {isSigningUp ? t('auth.signUp') : t('auth.login')}
            </Text>

            {isSigningUp ? (
              <View style={styles.form}>
                <Input
                  label={t('auth.fullName')}
                  value={signUpName}
                  onChangeText={setSignUpName}
                  placeholder={t('auth.enterName')}
                />
                <Input
                  label={t('auth.email')}
                  value={signUpEmail}
                  onChangeText={(v) => {
                    setSignUpEmail(v);
                    setEmailError('');
                  }}
                  placeholder="email@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  ltr
                  error={emailError}
                />
                <Input
                  label={t('auth.password')}
                  value={signUpPassword}
                  onChangeText={setSignUpPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  ltr
                />
                <Muted>{t('auth.signUpHint')}</Muted>
                <Button
                  label={t('auth.createFollower')}
                  onPress={handleSignUp}
                  loading={busy}
                />
              </View>
            ) : (
              <View style={styles.form}>
                <Input
                  label={t('auth.email')}
                  value={loginEmail}
                  onChangeText={(v) => {
                    setLoginEmail(v);
                    setEmailError('');
                  }}
                  placeholder="email@example.com"
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
                <Button label={t('auth.login')} onPress={handleLogin} loading={busy} />
              </View>
            )}

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsSigningUp((v) => !v);
                  setEmailError('');
                }}
              >
                <Text style={[styles.link, { color: theme.colors.primary }]}>
                  {isSigningUp ? t('auth.haveAccount') : t('auth.newAccount')}
                </Text>
              </Pressable>
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
    paddingBottom: 20,
  },
  brand: { alignItems: 'center', marginBottom: 22 },
  logo: { width: 120, height: 120, marginBottom: 10, borderRadius: 16 },
  brandEn: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tagline: { fontSize: 12, marginTop: 8, textAlign: 'center' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  form: { gap: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  roles: { flexDirection: 'row', gap: 8 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  link: { fontSize: 13, fontWeight: '700' },
  linkMuted: { fontSize: 13, fontWeight: '600' },
});
