import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card, Muted, SearchBar, Title } from '@/components/ui';
import { buildInvoices } from '@/screens/superadmin/InvoiceDetailScreen';
import { matchesSearchQuery } from '@/utils/search';

export default function InvoicesScreen() {
  const { giftTransactions, supportLevels } = useTournament();
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const invoices = useMemo(
    () => buildInvoices(giftTransactions, supportLevels, t),
    [giftTransactions, supportLevels, t]
  );

  const filtered = useMemo(
    () =>
      invoices.filter((inv) =>
        matchesSearchQuery(
          query,
          inv.title,
          inv.party,
          inv.id,
          inv.status,
          inv.amount,
          inv.recipientName,
          inv.competitionName,
          inv.certificateType
        )
      ),
    [invoices, query]
  );

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('superadmin.modules.invoices.title')}</Title>
      <Muted>{t('superadmin.invoices.subtitle')}</Muted>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={t('superadmin.searchPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={
            query.trim()
              ? t('superadmin.noSearchResults')
              : t('superadmin.invoices.empty')
          }
          icon="document-text-outline"
        />
      ) : (
        filtered.map((inv) => (
          <Pressable
            key={inv.id}
            accessibilityRole="button"
            hitSlop={4}
            onPress={() =>
              router.push(`/admin/invoices/${inv.id}` as any)
            }
          >
            <Card style={styles.card}>
              <Text style={[styles.invTitle, { color: theme.colors.text }]}>
                {inv.title}
              </Text>
              <Muted>{inv.party}</Muted>
              <View style={styles.meta}>
                <Text style={[styles.amount, { color: theme.colors.accent }]}>
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
