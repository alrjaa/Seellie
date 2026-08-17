import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { Button, Muted, Title } from '@/components/ui';
import { useTranslation } from '@/providers/LanguageProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { cairoText } from '@/theme/fonts';

/** Placeholder for ads.seellie.com — full self-serve portal comes later. */
export default function AdsPortalScreen() {
  const { t, isRTL } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const textDir = {
    textAlign: (isRTL ? 'right' : 'left') as 'left' | 'right',
    writingDirection: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title style={textDir}>{t('adsPortal.title')}</Title>
      <Muted style={textDir}>{t('adsPortal.subtitle')}</Muted>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.lead, textDir, { color: theme.colors.text }, cairoText('semiBold')]}>
          {t('adsPortal.comingSoon')}
        </Text>
        <Muted style={textDir}>{t('adsPortal.comingSoonDesc')}</Muted>
      </View>

      <Button
        label={t('adsPortal.contact')}
        onPress={() => {
          void Linking.openURL('mailto:ads@seellie.com');
        }}
      />
      {Platform.OS === 'web' ? (
        <Button
          label={t('adsPortal.backToApp')}
          variant="outline"
          onPress={() => router.replace('/(auth)/login' as any)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, gap: 16, paddingBottom: 40 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  lead: { fontSize: 16 },
});
