import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Input, Muted, Title } from '@/components/ui';
import { isValidEmail } from '@/utils';
import { ensureAdvertiserAccount } from '@/services/advertiser-platform';
import { ADS_PORTAL_HOME } from '@/utils/ads-portal';

export default function AdsRegisterScreen() {
  const { signUp } = useTournament();
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const [contactName, setContactName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!contactName.trim() || !businessName.trim() || !isValidEmail(email)) return;
    setBusy(true);
    try {
      const ok = await signUp(
        { name: contactName.trim(), email },
        password,
        { portal: 'ads' }
      );
      if (!ok) return;
      const account = await ensureAdvertiserAccount({
        contactName: contactName.trim(),
        businessName: businessName.trim(),
        country: country.trim(),
        region: region.trim(),
        city: city.trim(),
      });
      if (!account) {
        toast({
          variant: 'destructive',
          title: t('adsPortal.registerFailed'),
          description: t('adsPortal.registerFailedDesc'),
        });
        return;
      }
      router.replace(ADS_PORTAL_HOME as any);
    } finally {
      setBusy(false);
    }
  }, [
    businessName,
    city,
    contactName,
    country,
    email,
    password,
    region,
    router,
    signUp,
    t,
    toast,
  ]);

  return (
    <Screen scroll keyboard>
      <ScrollView contentContainerStyle={styles.content}>
        <Title>{t('adsPortal.registerTitle')}</Title>
        <Muted>{t('adsPortal.registerSubtitle')}</Muted>
        <Input label={t('adsPortal.contactName')} value={contactName} onChangeText={setContactName} maxLength={80} />
        <Input label={t('adsPortal.businessName')} value={businessName} onChangeText={setBusinessName} maxLength={80} />
        <Input label={t('adsPortal.country')} value={country} onChangeText={setCountry} maxLength={80} />
        <Input label={t('adsPortal.region')} value={region} onChangeText={setRegion} maxLength={80} />
        <Input label={t('adsPortal.city')} value={city} onChangeText={setCity} maxLength={80} />
        <Input label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Input label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry />
        <Muted>{t('adsPortal.registerRegionHint')}</Muted>
        <Button label={t('adsPortal.createAccount')} onPress={() => void onSubmit()} disabled={busy} />
        <Button label={t('auth.login')} variant="outline" onPress={() => router.replace('/ads/login' as any)} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingTop: 24, paddingBottom: 40, maxWidth: 480, alignSelf: 'center', width: '100%' },
});
