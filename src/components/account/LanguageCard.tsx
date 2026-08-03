import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Muted, Subtitle } from '@/components/ui';
import { useLanguage } from '@/providers/LanguageProvider';

/** بطاقة اختيار اللغة — عربية / English */
function LanguageCardComponent() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <Card style={styles.card}>
      <Subtitle style={styles.title}>{t('settings.language')}</Subtitle>
      <Muted style={styles.hint}>{t('settings.languageHint')}</Muted>
      <View style={styles.row}>
        <Button
          label={t('settings.arabic')}
          variant={language === 'ar' ? 'primary' : 'outline'}
          onPress={() => {
            void setLanguage('ar');
          }}
          style={{ flex: 1 }}
        />
        <Button
          label={t('settings.english')}
          variant={language === 'en' ? 'primary' : 'outline'}
          onPress={() => {
            void setLanguage('en');
          }}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

export const LanguageCard = memo(LanguageCardComponent);

const styles = StyleSheet.create({
  card: { gap: 8 },
  title: { fontSize: 14 },
  hint: { fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
});
