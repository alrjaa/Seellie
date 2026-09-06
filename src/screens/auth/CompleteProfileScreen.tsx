import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Chip, Input, Muted, Subtitle, Title } from '@/components/ui';
import { isValidEmail, normalizeEmail } from '@/utils';
import { isAppProfileComplete } from '@/utils/profile-completion';
import { cairoText } from '@/theme/fonts';

/**
 * إكمال بيانات الحساب الإلزامية قبل الدخول لوظائف التطبيق.
 *
 * قسم الإشعارات هنا = إشعارات اكتشاف من التطبيق فقط
 * (محتوى جديد / أحداث / مسابقات جديدة) — بلا أي صلة
 * بإشعارات المنظمين أو اللاعبين أو المتابعين أو الإعلام التنظيمي.
 */
export default function CompleteProfileScreen() {
  const { currentUser, updateUser, loading, routeForRole, logout } =
    useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [mobile, setMobile] = useState(currentUser?.mobile || '');
  const [country, setCountry] = useState(currentUser?.country || '');
  const [region, setRegion] = useState(currentUser?.region || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [privacyAccepted, setPrivacyAccepted] = useState(
    !!currentUser?.privacyAcceptedAt
  );
  const [termsAccepted, setTermsAccepted] = useState(
    !!currentUser?.termsAcceptedAt
  );
  const [notificationsConsent, setNotificationsConsent] = useState<
    boolean | null
  >(
    typeof currentUser?.notificationsConsent === 'boolean'
      ? currentUser.notificationsConsent
      : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const alreadyComplete = useMemo(
    () => isAppProfileComplete(currentUser),
    [currentUser]
  );

  if (loading) return null;
  if (!currentUser) {
    return <Redirect href="/(auth)/login" />;
  }
  if (alreadyComplete) {
    return (
      <Redirect
        href={
          routeForRole(currentUser.activeRole || currentUser.role) as any
        }
      />
    );
  }

  const validate = (): string | null => {
    if (name.trim().length < 2) return t('onboarding.errName');
    if (!isValidEmail(normalizeEmail(email))) return t('onboarding.errEmail');
    if (mobile.replace(/\D/g, '').length < 8) return t('onboarding.errMobile');
    if (!country.trim()) return t('onboarding.errCountry');
    if (!region.trim()) return t('onboarding.errRegion');
    if (!city.trim()) return t('onboarding.errCity');
    if (!privacyAccepted) return t('onboarding.errPrivacy');
    if (!termsAccepted) return t('onboarding.errTerms');
    if (notificationsConsent === null) return t('onboarding.errNotifications');
    return null;
  };

  const onSave = () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    if (!currentUser) return;
    setSaving(true);
    setError('');
    const now = new Date();
    updateUser(
      {
        ...currentUser,
        name: name.trim(),
        email: normalizeEmail(email),
        mobile: mobile.trim(),
        country: country.trim(),
        region: region.trim(),
        city: city.trim(),
        privacyAcceptedAt: privacyAccepted
          ? currentUser.privacyAcceptedAt || now
          : currentUser.privacyAcceptedAt,
        termsAcceptedAt: termsAccepted
          ? currentUser.termsAcceptedAt || now
          : currentUser.termsAcceptedAt,
        notificationsConsent: notificationsConsent as boolean,
      },
      t('onboarding.saved')
    );
    setSaving(false);
    router.replace(
      routeForRole(currentUser.activeRole || currentUser.role) as any
    );
  };

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('onboarding.title')}</Title>
      <Muted>{t('onboarding.subtitle')}</Muted>

      <Card style={styles.card}>
        <Subtitle>{t('onboarding.personalSection')}</Subtitle>
        <Input
          label={t('settings.name')}
          value={name}
          onChangeText={setName}
        />
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label={t('account.mobile')}
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          placeholder={t('onboarding.mobilePlaceholder')}
        />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('onboarding.addressSection')}</Subtitle>
        <Muted>{t('onboarding.addressHint')}</Muted>
        <Input
          label={t('account.country')}
          value={country}
          onChangeText={setCountry}
        />
        <Input
          label={t('account.region')}
          value={region}
          onChangeText={setRegion}
        />
        <Input label={t('account.city')} value={city} onChangeText={setCity} />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('onboarding.legalSection')}</Subtitle>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: privacyAccepted }}
          onPress={() => setPrivacyAccepted((v) => !v)}
          style={styles.checkRow}
        >
          <Chip
            label={privacyAccepted ? t('onboarding.accepted') : t('onboarding.accept')}
            active={privacyAccepted}
            onPress={() => setPrivacyAccepted((v) => !v)}
          />
          <Pressable onPress={() => router.push('/privacy' as any)}>
            <Text style={[styles.link, { color: theme.colors.accent }, cairoText('semiBold')]}>
              {t('legal.privacyTitle')}
            </Text>
          </Pressable>
        </Pressable>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          onPress={() => setTermsAccepted((v) => !v)}
          style={styles.checkRow}
        >
          <Chip
            label={termsAccepted ? t('onboarding.accepted') : t('onboarding.accept')}
            active={termsAccepted}
            onPress={() => setTermsAccepted((v) => !v)}
          />
          <Pressable onPress={() => router.push('/terms' as any)}>
            <Text style={[styles.link, { color: theme.colors.accent }, cairoText('semiBold')]}>
              {t('legal.termsTitle')}
            </Text>
          </Pressable>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('onboarding.notificationsSection')}</Subtitle>
        <Muted>{t('onboarding.notificationsHint')}</Muted>
        <View style={styles.chips}>
          <Chip
            label={t('onboarding.notificationsAccept')}
            active={notificationsConsent === true}
            onPress={() => setNotificationsConsent(true)}
          />
          <Chip
            label={t('onboarding.notificationsRefuse')}
            active={notificationsConsent === false}
            onPress={() => setNotificationsConsent(false)}
          />
        </View>
      </Card>

      {error ? (
        <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
      ) : null}

      <Button
        label={t('onboarding.continue')}
        onPress={onSave}
        disabled={saving}
      />
      <Button
        label={t('common.logout')}
        variant="ghost"
        onPress={() => void logout()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 14, paddingBottom: 48 },
  card: { gap: 10 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  link: { fontSize: 14, textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 13, textAlign: 'left' },
});
