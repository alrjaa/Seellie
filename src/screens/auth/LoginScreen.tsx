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
import { Redirect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button, Input, Muted } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { useResponsive } from '@/hooks/useResponsive';
import { isValidEmail } from '@/utils';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';
import { DEFAULT_LOGO, DEFAULT_LOGO_MODULE } from '@/theme/brand';
import { cairoText } from '@/theme/fonts';
import Constants from 'expo-constants';
import { ADMIN_LOGIN, isAdminHostname } from '@/utils/admin-portal';

function webBuildLabel(): string {
  const extra = Constants.expoConfig?.extra as { buildId?: string } | undefined;
  const id = extra?.buildId?.trim();
  const ver = Constants.expoConfig?.version || '';
  if (id && ver) return `${ver} · ${id}`;
  return ver || id || '';
}

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
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const { formWidth, desktop } = useResponsive();
  const buildLabel = useMemo(() => webBuildLabel(), []);

  const [isSigningUp, setIsSigningUp] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!isValidEmail(loginEmail)) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    setEmailError('');
    setBusy(true);
    try {
      await login(loginEmail, loginPassword, { portal: 'app' });
    } finally {
      setBusy(false);
    }
  }, [login, loginEmail, loginPassword, t]);

  const handleSignUp = useCallback(async () => {
    if (!isValidEmail(signUpEmail)) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    setEmailError('');
    setBusy(true);
    try {
      await signUp({ name: signUpName, email: signUpEmail }, signUpPassword);
    } finally {
      setBusy(false);
    }
  }, [signUp, signUpName, signUpEmail, signUpPassword, t]);

  const gradientColors = useMemo(
    () =>
      theme.isDark
        ? (['#0d1a26', '#132433', '#0d1a26'] as const)
        : (['#F3F6F9', '#FFFFFF', '#E8FBFA'] as const),
    [theme.isDark]
  );

  if (loading) return <LoadingState />;

  // على مضيف المشرف لا تُعرض شاشة دخول التطبيق
  if (Platform.OS === 'web' && isAdminHostname()) {
    return <Redirect href={ADMIN_LOGIN as any} />;
  }

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

      <SafeAreaView edges={['top', 'bottom']} style={styles.topBarSafe} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: HEADER_BELOW_STATUS_GAP }]}>
          <LanguageToggle />
          <ThemeToggle />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            desktop && styles.scrollDesktop,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {desktop ? (
            <View
              style={[
                styles.desktopStage,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.desktopHero,
                  { backgroundColor: theme.isDark ? '#071018' : '#0d1a26' },
                ]}
              >
                <Image
                  source={
                    appLogo && appLogo !== DEFAULT_LOGO
                      ? { uri: appLogo }
                      : DEFAULT_LOGO_MODULE
                  }
                  style={styles.desktopHeroLogo}
                  resizeMode="contain"
                  accessibilityLabel={t('auth.logoA11y')}
                />
                <Text style={[styles.desktopHeroTitle, { color: theme.colors.accent }]}>
                  {appName || 'Seellie'}
                </Text>
                <Text style={[styles.desktopHeroTag, { color: 'rgba(255,255,255,0.72)' }]}>
                  {t('auth.tagline')}
                </Text>
              </View>
              <View style={styles.desktopFormCol}>
                <View
                  style={[
                    styles.panel,
                    styles.desktopPanel,
                    {
                      width: formWidth,
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {forgotPassword
                      ? t('auth.forgotPasswordTitle')
                      : isSigningUp
                        ? t('auth.signUp')
                        : t('auth.login')}
                  </Text>

                  {forgotPassword ? (
                    <ForgotPasswordForm
                      initialEmail={loginEmail}
                      onBack={() => setForgotPassword(false)}
                    />
                  ) : isSigningUp ? (
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
                        size="md"
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
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('auth.forgotPassword')}
                        onPress={() => setForgotPassword(true)}
                        style={[
                          styles.forgotWrap,
                          { alignSelf: isRTL ? 'flex-end' : 'flex-start' },
                        ]}
                      >
                        <Text
                          style={[styles.linkMuted, { color: theme.colors.accent }]}
                        >
                          {t('auth.forgotPassword')}
                        </Text>
                      </Pressable>
                      <Button
                        label={t('auth.login')}
                        onPress={handleLogin}
                        loading={busy}
                        size="md"
                      />
                    </View>
                  )}

                  {!forgotPassword ? (
                    <View style={styles.footer}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          isSigningUp ? t('auth.haveAccount') : t('auth.newAccount')
                        }
                        onPress={() => {
                          setIsSigningUp((v) => !v);
                          setEmailError('');
                        }}
                      >
                        <Text style={[styles.link, { color: theme.colors.accent }]}>
                          {isSigningUp ? t('auth.haveAccount') : t('auth.newAccount')}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ) : (
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
                  {appName || 'Seellie'}
                </Text>
                <Text style={[styles.tagline, { color: theme.colors.textMuted }]}>
                  {t('auth.tagline')}
                </Text>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {forgotPassword
                  ? t('auth.forgotPasswordTitle')
                  : isSigningUp
                    ? t('auth.signUp')
                    : t('auth.login')}
              </Text>

              {forgotPassword ? (
                <ForgotPasswordForm
                  initialEmail={loginEmail}
                  onBack={() => setForgotPassword(false)}
                />
              ) : isSigningUp ? (
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
                    size="md"
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.forgotPassword')}
                    onPress={() => setForgotPassword(true)}
                    style={[
                      styles.forgotWrap,
                      { alignSelf: isRTL ? 'flex-end' : 'flex-start' },
                    ]}
                  >
                    <Text
                      style={[styles.linkMuted, { color: theme.colors.accent }]}
                    >
                      {t('auth.forgotPassword')}
                    </Text>
                  </Pressable>
                  <Button
                    label={t('auth.login')}
                    onPress={handleLogin}
                    loading={busy}
                    size="md"
                  />
                </View>
              )}

              {!forgotPassword ? (
                <View style={styles.footer}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isSigningUp ? t('auth.haveAccount') : t('auth.newAccount')
                    }
                    onPress={() => {
                      setIsSigningUp((v) => !v);
                      setEmailError('');
                    }}
                  >
                    <Text style={[styles.link, { color: theme.colors.accent }]}>
                      {isSigningUp ? t('auth.haveAccount') : t('auth.newAccount')}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
          {buildLabel ? (
            <Muted style={styles.buildStamp}>{buildLabel}</Muted>
          ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  scrollDesktop: {
    paddingVertical: 28,
    paddingHorizontal: 28,
  },
  desktopStage: {
    width: '100%',
    maxWidth: 1080,
    minHeight: 620,
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  desktopHero: {
    flex: 1.05,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 10,
  },
  desktopHeroLogo: {
    width: 168,
    height: 168,
    borderRadius: 28,
    marginBottom: 8,
  },
  desktopHeroTitle: {
    ...cairoText('extraBold'),
    fontSize: 34,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  desktopHeroTag: {
    ...cairoText('regular'),
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
  desktopFormCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 28,
  },
  desktopPanel: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingTop: 0,
    paddingBottom: 0,
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
  brand: { alignItems: 'center', marginBottom: 8, gap: 4 },
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
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    ...cairoText('bold'),
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  form: { gap: 12 },
  forgotWrap: { marginTop: -4 },
  fieldLabel: {
    ...cairoText('semiBold'),
    fontSize: 12,
  },
  roles: { flexDirection: 'row', gap: 8 },
  footer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  link: { ...cairoText('bold'), fontSize: 13 },
  linkMuted: { ...cairoText('semiBold'), fontSize: 13 },
  buildStamp: {
    ...cairoText('regular'),
    fontSize: 10,
    textAlign: 'center',
    opacity: 0.45,
    marginTop: 8,
    marginBottom: 16,
  },
});
