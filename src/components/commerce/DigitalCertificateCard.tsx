import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card, Muted, Subtitle } from '@/components/ui';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import type { DigitalCertificate } from '@/services/commerce/types';

type Props = {
  item: DigitalCertificate;
  perspective: 'sent' | 'received';
  counterpartyName?: string;
};

export function DigitalCertificateCard({
  item,
  perspective,
  counterpartyName,
}: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const title = isRTL
    ? item.name_ar || item.name_en
    : item.name_en || item.name_ar;

  return (
    <Card style={styles.card}>
      <Subtitle>{title}</Subtitle>
      <Muted>
        {perspective === 'sent'
          ? t('appreciation.toLine', { name: counterpartyName || '—' })
          : t('appreciation.fromLine', { name: counterpartyName || '—' })}
      </Muted>
      <Muted>
        {t('commerce.creditsCost', { count: item.credits_cost })}
      </Muted>
      <Muted>
        {t('appreciation.dateLine', {
          date: new Date(item.issued_at).toLocaleString(),
        })}
      </Muted>
      <Muted>
        {t('appreciation.statusLine', {
          status: t(`commerce.certStatus.${item.status}` as 'commerce.certStatus.issued'),
        })}
      </Muted>
      <Text style={[styles.certNumber, { color: theme.colors.accent }]}>
        {t('certificates.certNumber')}: {item.certificate_number}
      </Text>
      {item.reason ? (
        <Muted>{t('appreciation.reasonLine', { reason: item.reason })}</Muted>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, marginBottom: 8 },
  certNumber: { fontWeight: '800', marginTop: 4 },
});
