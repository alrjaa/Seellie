import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card, Muted, Subtitle, Title } from '@/components/ui';
import { computeStandings } from '@/utils/competition';

export default function StatsScreen() {
  const { competitions, currentUser } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();

  const list = useMemo(() => {
    if (!currentUser) return [];
    return competitions.filter((c) => c.organizerId === currentUser.id);
  }, [competitions, currentUser]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('organizer.statistics.title')}</Title>
      <Muted>{t('organizer.statistics.subtitle')}</Muted>

      {list.length === 0 ? (
        <EmptyState
          title={t('superadmin.competitions.empty')}
          icon="bar-chart-outline"
        />
      ) : (
        list.map((comp) => {
          const standings = computeStandings(comp);
          return (
            <Card key={comp.id} style={styles.card}>
              <Subtitle>{comp.name}</Subtitle>
              {standings.length === 0 ? (
                <Muted>{t('organizer.statistics.noResults')}</Muted>
              ) : (
                <>
                  <View
                    style={[
                      styles.tableHead,
                      { borderBottomColor: theme.colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.th,
                        { color: theme.colors.textMuted, flex: 1.6 },
                      ]}
                    >
                      {t('organizer.statistics.columns.team')}
                    </Text>
                    <Text style={[styles.th, { color: theme.colors.textMuted }]}>
                      {t('organizer.statistics.columns.played')}
                    </Text>
                    <Text style={[styles.th, { color: theme.colors.textMuted }]}>
                      {t('organizer.statistics.columns.won')}
                    </Text>
                    <Text style={[styles.th, { color: theme.colors.textMuted }]}>
                      {t('organizer.statistics.columns.drawn')}
                    </Text>
                    <Text style={[styles.th, { color: theme.colors.textMuted }]}>
                      {t('organizer.statistics.columns.lost')}
                    </Text>
                    <Text style={[styles.th, { color: theme.colors.textMuted }]}>
                      {t('organizer.statistics.columns.goalDiff')}
                    </Text>
                    <Text style={[styles.th, { color: theme.colors.textMuted }]}>
                      {t('organizer.statistics.columns.points')}
                    </Text>
                  </View>
                  {standings.map((row, index) => (
                    <View
                      key={row.teamId}
                      style={[
                        styles.tableRow,
                        { borderBottomColor: theme.colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.td,
                          { color: theme.colors.text, flex: 1.6, textAlign: 'left' },
                        ]}
                        numberOfLines={1}
                      >
                        {index + 1}. {row.teamName}
                      </Text>
                      <Text style={[styles.td, { color: theme.colors.text }]}>
                        {row.played}
                      </Text>
                      <Text style={[styles.td, { color: theme.colors.text }]}>
                        {row.won}
                      </Text>
                      <Text style={[styles.td, { color: theme.colors.text }]}>
                        {row.drawn}
                      </Text>
                      <Text style={[styles.td, { color: theme.colors.text }]}>
                        {row.lost}
                      </Text>
                      <Text style={[styles.td, { color: theme.colors.text }]}>
                        {row.goalDiff}
                      </Text>
                      <Text
                        style={[
                          styles.td,
                          { color: theme.colors.primary, fontWeight: '900' },
                        ]}
                      >
                        {row.points}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 8 },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 6,
    marginTop: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    alignItems: 'center',
  },
  th: { flex: 0.55, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  td: { flex: 0.55, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
