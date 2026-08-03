import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card, Muted, Title } from '@/components/ui';
import { buildInvoices } from '@/screens/superadmin/InvoiceDetailScreen';

export default function InvoicesScreen() {
  const { giftTransactions, supportLevels } = useTournament();
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const invoices = useMemo(
    () => buildInvoices(giftTransactions, supportLevels, t),
    [giftTransactions, supportLevels, t]
  );

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('superadmin.modules.invoices.title')}</Title>
      <Muted>{t('superadmin.invoices.subtitle')}</Muted>

      {invoices.length === 0 ? (
        <EmptyState title={t('superadmin.invoices.empty')} icon="document-text-outline" />
      ) : (
        invoices.map((inv) => (
          <Pressable
            key={inv.id}
            onPress={() =>
              router.push(`/(superadmin)/invoices/${inv.id}` as any)
            }
          >
            <Card style={styles.card}>
              <Text style={[styles.invTitle, { color: theme.colors.text }]}>
                {inv.title}
              </Text>
              <Muted>{inv.party}</Muted>
              <View style={styles.meta}>
                <Text style={[styles.amount, { color: theme.colors.primary }]}>
                  {t('superadmin.invoices.amountCurrency', { amount: inv.amount })}
                </Text>
                <Muted>{inv.status}</Muted>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 12, paddingBottom: 40 },
  card: { gap: 4 },
  invTitle: { fontWeight: '800', textAlign: 'left' },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  amount: { fontWeight: '900', fontSize: 16 },
});
