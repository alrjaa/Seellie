import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Input, Muted, Title } from '@/components/ui';
import { isValidEmail } from '@/utils';
import { ADS_PORTAL_HOME } from '@/utils/ads-portal';

export default function AdsLoginScreen() {
  const { login } = useTournament();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!isValidEmail(email)) return;
    setBusy(true);
    try {
      const ok = await login(email, password, { portal: 'ads' });
      if (ok) router.replace(ADS_PORTAL_HOME as any);
    } finally {
      setBusy(false);
    }
  }, [email, password, login, router]);

  return (
    <Screen scroll keyboard density="form" contentStyle={styles.content}>
      <Title>{t('adsPortal.loginTitle')}</Title>
      <Muted>{t('adsPortal.loginSubtitle')}</Muted>
      <Input
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        label={t('auth.login')}
        onPress={() => void onSubmit()}
        disabled={busy}
      />
      <View style={styles.links}>
        <Link href="/ads/register" asChild>
          <Button label={t('adsPortal.registerCta')} variant="outline" />
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingTop: 24,
    paddingBottom: 40,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  links: { gap: 10, marginTop: 8 },
});
