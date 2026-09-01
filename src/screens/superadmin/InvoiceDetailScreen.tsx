import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { type t as translateFn } from '@/i18n';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card, Muted, Subtitle, Title } from '@/components/ui';
import { formatArabicDate } from '@/utils';

export type InvoiceItem = {
  id: string;
  title: string;
  party: string;
  amount: number;
  status: string;
  timestamp?: Date;
  certificateType?: string;
  recipientName?: string;
  competitionName?: string;
};

export function buildInvoices(
  giftTransactions: ReturnType<typeof useTournament>['giftTransactions'],
  supportLevels: ReturnType<typeof useTournament>['supportLevels'],
  t: typeof translateFn
): InvoiceItem[] {
  if (giftTransactions.length > 0) {
    return giftTransactions.map((g) => ({
      id: g.id,
      title: t('superadmin.invoices.invoiceTitle', { type: g.certificateType }),
      party: g.gifterName,
      amount: g.amountPaid,
      status: t('superadmin.invoices.paid'),
      timestamp: g.timestamp,
      certificateType: g.certificateType,
      recipientName: g.recipientName,
      competitionName: g.competitionName,
    }));
  }
  return supportLevels.map((level, index) => ({
    id: `preview-${index}`,
    title: t('superadmin.invoices.previewTitle', { name: level.name }),
    party: t('superadmin.invoices.systemTemplate'),
    amount: level.price,
    status: t('superadmin.invoices.draft'),
    certificateType: level.name,
  }));
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { giftTransactions, supportLevels } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();

  const invoice = useMemo(() => {
    const all = buildInvoices(giftTransactions, supportLevels, t);
    return all.find((inv) => inv.id === id);
  }, [id, giftTransactions, supportLevels, t]);

  if (!invoice) {
    return (
      <Screen contentStyle={styles.content}>
        <EmptyState title={t('superadmin.invoices.notFound')} icon="document-text-outline" />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{invoice.title}</Title>
      <Muted>{t('superadmin.invoices.detailsLine', { id: invoice.id })}</Muted>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Subtitle>{t('superadmin.invoices.statusLabel')}</Subtitle>
          <Text style={[styles.value, { color: theme.colors.accent }]}>
            {invoice.status}
          </Text>
        </View>
        <View style={styles.field}>
          <Muted>{t('superadmin.invoices.partyLabel')}</Muted>
          <Text style={[styles.value, { color: theme.colors.text }]}>
            {invoice.party}
          </Text>
        </View>
        <View style={styles.field}>
          <Muted>{t('superadmin.invoices.amountLabel')}</Muted>
          <Text style={[styles.amount, { color: theme.colors.accent }]}>
            {t('superadmin.invoices.amountCurrency', { amount: invoice.amount })}
          </Text>
        </View>
        {invoice.certificateType ? (
          <View style={styles.field}>
            <Muted>{t('superadmin.invoices.certificateTypeLabel')}</Muted>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {invoice.certificateType}
            </Text>
          </View>
        ) : null}
        {invoice.recipientName ? (
          <View style={styles.field}>
            <Muted>{t('superadmin.invoices.recipientLabel')}</Muted>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {invoice.recipientName}
            </Text>
          </View>
        ) : null}
        {invoice.competitionName ? (
          <View style={styles.field}>
            <Muted>{t('superadmin.invoices.competitionLabel')}</Muted>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {invoice.competitionName}
            </Text>
          </View>
        ) : null}
        {invoice.timestamp ? (
          <View style={styles.field}>
            <Muted>{t('superadmin.invoices.dateLabel')}</Muted>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {formatArabicDate(invoice.timestamp)}
            </Text>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  field: { gap: 4 },
  value: { fontWeight: '700', textAlign: 'left', fontSize: 15 },
  amount: { fontWeight: '900', textAlign: 'left', fontSize: 22 },
});
