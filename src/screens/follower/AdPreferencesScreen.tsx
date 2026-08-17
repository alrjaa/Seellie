import React, { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from '@/providers/LanguageProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Screen } from '@/components/layout/Screen';
import { useAdPreferences } from '@/hooks/useAdPreferences';
import { useNativeAds } from '@/hooks/useNativeAds';
import { Card, ListRow, Muted, Subtitle, Title } from '@/components/ui';
import { cairoText } from '@/theme/fonts';

export default function AdPreferencesScreen() {
  const { t, isRTL } = useTranslation();
  const theme = useAppTheme();
  const { prefs, setPersonalized, unhideAd } = useAdPreferences();
  const ads = useNativeAds();

  const textDir = {
    textAlign: (isRTL ? 'right' : 'left') as 'left' | 'right',
    writingDirection: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
  };

  const hiddenAds = useMemo(() => {
    const byId = new Map(ads.map((ad) => [ad.id, ad]));
    return prefs.hiddenAdIds
      .map((id) => {
        const ad = byId.get(id);
        return {
          id,
          label: ad?.advertiserName || ad?.title || id,
        };
      })
      .filter((row) => row.id);
  }, [ads, prefs.hiddenAdIds]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title style={textDir}>{t('settings.adsTitle')}</Title>
      <Muted style={textDir}>{t('settings.adsSubtitle')}</Muted>

      <Card style={styles.card}>
        <Subtitle style={textDir}>{t('settings.adsPersonalization')}</Subtitle>
        <Muted style={textDir}>{t('settings.adsPersonalizationDesc')}</Muted>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, textDir, { color: theme.colors.text }, cairoText('medium')]}>
            {t('settings.adsPersonalizationToggle')}
          </Text>
          <Switch
            value={prefs.personalizedAds}
            onValueChange={(value) => {
              void setPersonalized(value);
            }}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.accent,
            }}
          />
        </View>
        <Muted style={textDir}>{t('settings.adsNoGlobalDisable')}</Muted>
      </Card>

      <Card style={styles.card}>
        <Subtitle style={textDir}>{t('settings.adsHiddenTitle')}</Subtitle>
        <Muted style={textDir}>{t('settings.adsHiddenDesc')}</Muted>
        {hiddenAds.length === 0 ? (
          <Muted style={textDir}>{t('settings.adsHiddenEmpty')}</Muted>
        ) : (
          hiddenAds.map((row) => (
            <ListRow
              key={row.id}
              title={row.label}
              subtitle={t('settings.adsHiddenItem')}
              onPress={() => {
                void unhideAd(row.id);
              }}
            />
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Subtitle style={textDir}>{t('settings.adsReportTitle')}</Subtitle>
        <Muted style={textDir}>{t('settings.adsReportDesc')}</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: { flex: 1, fontSize: 14 },
});
