import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card, Muted, Subtitle, Title } from '@/components/ui';
import { formatArabicDate, formatAppNumber } from '@/utils';
import { flowDirection } from '@/theme/direction';

export default function FinancialsScreen() {
  const { giftTransactions, supportLevels, currentUser } = useTournament();
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const align = (isRTL ? 'right' : 'left') as 'left' | 'right';
  const writingDirection = (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr';

  const myTransactions = useMemo(() => {
    if (!currentUser) return [];
    return giftTransactions.filter((g) => g.recipientId === currentUser.id);
  }, [giftTransactions, currentUser]);

  const totalReceived = useMemo(
    () =>
      myTransactions
        .filter((g) => g.status === 'paid')
        .reduce((sum, g) => sum + g.amountPaid, 0),
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
        <Card
          style={[
            styles.summaryCard,
            flowDirection(isRTL),
          ]}
        >
          <Muted>{t('organizer.financials.totalReceived')}</Muted>
          <Text
            {...({ physicalAlign: true } as object)}
            style={[
              styles.amount,
              { color: theme.colors.accent, textAlign: align, writingDirection },
            ]}
          >
            {t('certificates.price', {
              amount: formatAppNumber(totalReceived),
            })}
          </Text>
        </Card>
        <Card
          style={[
            styles.summaryCard,
            flowDirection(isRTL),
          ]}
        >
          <Muted>{t('organizer.financials.giftTransactions')}</Muted>
          <Text
            {...({ physicalAlign: true } as object)}
            style={[
              styles.amount,
              { color: theme.colors.accent, textAlign: align, writingDirection },
            ]}
          >
            {myTransactions.length}
          </Text>
        </Card>
        <Card
          style={[
            styles.summaryCard,
            flowDirection(isRTL),
          ]}
        >
          <Muted>{t('organizer.financials.supportLevels')}</Muted>
          <Text
            {...({ physicalAlign: true } as object)}
            style={[
              styles.amount,
              { color: theme.colors.accent, textAlign: align, writingDirection },
            ]}
          >
            {totalLevels}
          </Text>
        </Card>
        <Card
          style={[
            styles.summaryCard,
            flowDirection(isRTL),
          ]}
        >
          <Muted>{t('organizer.financials.avgPrice')}</Muted>
          <Text
            {...({ physicalAlign: true } as object)}
            style={[
              styles.amount,
              { color: theme.colors.accent, textAlign: align, writingDirection },
            ]}
          >
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
              <Text
                style={[
                  styles.name,
                  { color: theme.colors.text, textAlign: align, writingDirection },
                ]}
              >
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
              <Text
                style={[
                  styles.name,
                  { color: theme.colors.text, textAlign: align, writingDirection },
                ]}
              >
                {g.certificateType} → {g.recipientName}
              </Text>
              <Muted>
                {t('organizer.financials.fromLine', {
                  name: g.gifterName,
                  amount: g.amountPaid,
                })}
                {g.status === 'pending_demo'
                  ? ` · ${t('organizer.financials.pendingDemo')}`
                  : ''}
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '47%',
    maxWidth: '48%',
    minWidth: 0,
    gap: 4,
  },
  amount: { fontSize: 22, fontWeight: '900', width: '100%' },
  card: { gap: 8 },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 2,
  },
  name: { fontWeight: '800' },
});
