import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { Card, Muted, Subtitle, Title } from '@/components/ui';

export default function AnalyticsScreen() {
  const { users, competitions, messages, referees, quickComments, comments } =
    useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const teams = competitions.reduce((n, c) => n + c.teams.length, 0);
    const matches = competitions.reduce((n, c) => n + c.matches.length, 0);
    const players = competitions.reduce(
      (n, c) => n + c.teams.reduce((tn, t) => tn + t.players.length, 0),
      0
    );
    return [
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
      { label: t('superadmin.analytics.competitions'), value: competitions.length },
      { label: t('superadmin.analytics.teams'), value: teams },
      { label: t('superadmin.analytics.registeredPlayers'), value: players },
      { label: t('superadmin.analytics.matches'), value: matches },
      { label: t('superadmin.analytics.referees'), value: referees.length },
      { label: t('superadmin.analytics.messages'), value: messages.length },
      { label: t('superadmin.analytics.comments'), value: comments.length },
      { label: t('superadmin.analytics.quickChat'), value: quickComments.length },
    ];
  }, [users, competitions, messages, referees, quickComments, comments, t]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('nav.analytics')}</Title>
      <Muted>{t('superadmin.analytics.subtitle')}</Muted>
      <View style={styles.grid}>
        {stats.map((s) => (
          <Card key={s.label} style={styles.card}>
            <Muted>{s.label}</Muted>
            <Text style={[styles.value, { color: theme.colors.primary }]}>
              {s.value}
            </Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 12, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '47%', flexGrow: 1, minWidth: 140, gap: 4 },
  value: { fontSize: 24, fontWeight: '900', textAlign: 'left' },
});
