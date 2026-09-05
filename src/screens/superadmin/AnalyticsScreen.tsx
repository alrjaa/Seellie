import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { Card, Muted, Subtitle, Title } from '@/components/ui';
import { countReceivedLikes } from '@/utils/social-stats';

export default function AnalyticsScreen() {
  const {
    users,
    competitions,
    messages,
    referees,
    comments,
    offers,
    giftTransactions,
  } = useTournament();
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();

  const stats = useMemo(() => {
    const teams = competitions.reduce((n, c) => n + c.teams.length, 0);
    const matches = competitions.reduce((n, c) => n + c.matches.length, 0);
    const players = competitions.reduce(
      (n, c) => n + c.teams.reduce((tn, team) => tn + team.players.length, 0),
      0
    );
    const totalFollows = users.reduce(
      (n, u) => n + (u.followers?.length || 0),
      0
    );
    const totalLikes = users.reduce((n, u) => n + countReceivedLikes(u), 0);
    const pendingOffers = offers.filter((o) => o.status === 'pending').length;
    const activeComps = competitions.filter(
      (c) => c.status === 'active' || !c.status
    ).length;
    const topFollowed = [...users]
      .sort(
        (a, b) => (b.followers?.length || 0) - (a.followers?.length || 0)
      )
      .slice(0, 3);

    return {
      cards: [
        { label: t('superadmin.analytics.users'), value: users.length },
        {
          label: t('superadmin.analytics.organizers'),
          value: users.filter((u) => u.role === 'organizer').length,
        },
        {
          label: t('superadmin.analytics.followers'),
          value: users.filter((u) => u.role === 'follower').length,
        },
        {
          label: t('superadmin.analytics.freelancers'),
          value: users.filter((u) => u.role === 'freelancer').length,
        },
        {
          label: t('superadmin.analytics.competitions'),
          value: competitions.length,
        },
        {
          label: t('superadmin.analytics.activeCompetitions'),
          value: activeComps,
        },
        { label: t('superadmin.analytics.teams'), value: teams },
        {
          label: t('superadmin.analytics.registeredPlayers'),
          value: players,
        },
        { label: t('superadmin.analytics.matches'), value: matches },
        { label: t('superadmin.analytics.referees'), value: referees.length },
        { label: t('superadmin.analytics.messages'), value: messages.length },
        { label: t('superadmin.analytics.comments'), value: comments.length },
        {
          label: t('superadmin.analytics.totalFollows'),
          value: totalFollows,
        },
        { label: t('superadmin.analytics.totalLikes'), value: totalLikes },
        {
          label: t('superadmin.analytics.pendingOffers'),
          value: pendingOffers,
        },
        {
          label: t('superadmin.analytics.gifts'),
          value: giftTransactions.length,
        },
      ],
      topFollowed,
    };
  }, [
    users,
    competitions,
    messages,
    referees,
    comments,
    offers,
    giftTransactions,
    t,
  ]);

  return (
    <Screen scroll contentStyle={styles.content} density="dashboard">
      <Title>{t('nav.analytics')}</Title>
      <Muted>{t('superadmin.analytics.subtitle')}</Muted>
      <View style={styles.grid}>
        {stats.cards.map((s) => (
          <Card key={s.label} style={styles.card}>
            <Muted>{s.label}</Muted>
            <Text
              style={[
                styles.value,
                {
                  color: theme.colors.accent,
                  textAlign: 'left',
                },
              ]}
            >
              {s.value}
            </Text>
          </Card>
        ))}
      </View>

      <Card style={styles.topCard}>
        <Subtitle>{t('superadmin.analytics.topFollowed')}</Subtitle>
        {stats.topFollowed.map((u, i) => (
          <Muted key={u.id}>
            {i + 1}. {u.name} ({u.handle}) — {u.followers?.length || 0}{' '}
            {t('account.stats.followers')}
          </Muted>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 12, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '47%', flexGrow: 1, minWidth: 140, gap: 4 },
  value: { fontSize: 24, fontWeight: '900' },
  topCard: { gap: 6 },
});
