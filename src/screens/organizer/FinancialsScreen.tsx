import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card, Muted, Subtitle, Title } from '@/components/ui';
import { formatArabicDate, formatAppNumber } from '@/utils';

export default function FinancialsScreen() {
  const { giftTransactions, supportLevels, currentUser } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();

  const myTransactions = useMemo(() => {
    if (!currentUser) return [];
    return giftTransactions.filter((g) => g.recipientId === currentUser.id);
  }, [giftTransactions, currentUser]);

  const totalReceived = useMemo(
    () => myTransactions.reduce((sum, g) => sum + g.amountPaid, 0),
    [myTransactions]
  );

  const totalLevels = supportLevels.length;
  const avgLevelPrice = useMemo(() => {
    if (supportLevels.length === 0) return 0;
    return (
      supportLevels.reduce((s, l) => s + l.price, 0) / supportLevels.length
    );
  }, [supportLevels]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('organizer.financials.title')}</Title>
      <Muted>{t('organizer.financials.subtitle')}</Muted>

      <View style={styles.summaryGrid}>
        <Card style={styles.summaryCard}>
          <Muted>{t('organizer.financials.totalReceived')}</Muted>
          <Text style={[styles.amount, { color: theme.colors.primary }]}>
            {t('certificates.price', {
              amount: formatAppNumber(totalReceived),
            })}
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Muted>{t('organizer.financials.giftTransactions')}</Muted>
          <Text style={[styles.amount, { color: theme.colors.primary }]}>
            {myTransactions.length}
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Muted>{t('organizer.financials.supportLevels')}</Muted>
          <Text style={[styles.amount, { color: theme.colors.primary }]}>
            {totalLevels}
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Muted>{t('organizer.financials.avgPrice')}</Muted>
          <Text style={[styles.amount, { color: theme.colors.primary }]}>
            {t('certificates.price', { amount: avgLevelPrice.toFixed(0) })}
          </Text>
        </Card>
      </View>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.financials.certificateLevels')}</Subtitle>
        {supportLevels.length === 0 ? (
          <EmptyState
            title={t('organizer.financials.noLevels')}
            icon="ribbon-outline"
          />
        ) : (
          supportLevels.map((level) => (
            <View
              key={level.name}
              style={[styles.row, { borderTopColor: theme.colors.border }]}
            >
              <Text style={[styles.name, { color: theme.colors.text }]}>
                {level.name}
              </Text>
              <Muted>
                {t('certificates.price', { amount: level.price })}
              </Muted>
              <Muted>{level.description}</Muted>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.financials.giftLog')}</Subtitle>
        {myTransactions.length === 0 ? (
          <EmptyState
            title={t('organizer.financials.noTransactions')}
            description={t('organizer.financials.noTransactionsDesc')}
            icon="gift-outline"
          />
        ) : (
          myTransactions.map((g) => (
            <View
              key={g.id}
              style={[styles.row, { borderTopColor: theme.colors.border }]}
            >
              <Text style={[styles.name, { color: theme.colors.text }]}>
                {g.certificateType} → {g.recipientName}
              </Text>
              <Muted>
                {t('organizer.financials.fromLine', {
                  name: g.gifterName,
                  amount: g.amountPaid,
                })}
              </Muted>
              <Muted>{formatArabicDate(g.timestamp)}</Muted>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexGrow: 1, minWidth: 140, gap: 4 },
  amount: { fontSize: 22, fontWeight: '900', textAlign: 'left' },
  card: { gap: 8 },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 2,
  },
  name: { fontWeight: '800', textAlign: 'left' },
});
