import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Avatar,
  Button,
  Card,
  ListRow,
  Muted,
  SectionHeader,
  StatusBadge,
  Title,
} from '@/components/ui';
import {
  computeStandings,
  formatVenueAddress,
} from '@/utils/competition';
import { formatArabicDate, formatArabicTime } from '@/utils';

function isMatchPlayed(match: {
  date: Date;
  team1Score: number;
  team2Score: number;
}): boolean {
  const now = Date.now();
  return (
    new Date(match.date).getTime() <= now ||
    match.team1Score > 0 ||
    match.team2Score > 0
  );
}

export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { competitions, currentUser, togglePinnedCompetition } = useTournament();

  const competition = useMemo(
    () => competitions.find((c) => c.id === id),
    [competitions, id]
  );

  const standings = useMemo(
    () => (competition ? computeStandings(competition) : []),
    [competition]
  );

  const sortedMatches = useMemo(() => {
    if (!competition) return [];
    return [...competition.matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [competition]);

  const pinned = !!competition &&
    (currentUser?.pinnedCompetitionIds || []).includes(competition.id);

  if (!competition) {
    return (
      <Screen contentStyle={styles.content} edges={['left', 'right']}>
        <EmptyState
          title={t('competition.notFound')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
          icon="trophy-outline"
        />
      </Screen>
    );
  }

  const teamName = (teamId: string) =>
    competition.teams.find((t) => t.id === teamId)?.name || '?';

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.titleRow}>
        <Title>{competition.name}</Title>
        <StatusBadge status={competition.status} />
      </View>
      <Muted>{formatVenueAddress(competition)}</Muted>

      {currentUser ? (
        <Button
          label={pinned ? t('screens.removeFromHome') : t('screens.pinHome')}
          variant={pinned ? 'secondary' : 'outline'}
          onPress={() => togglePinnedCompetition(competition.id)}
        />
      ) : null}

      <View style={styles.section}>
        <SectionHeader title={t('competition.teams')} />
        {competition.teams.length === 0 ? (
          <EmptyState title={t('competition.noTeams')} icon="people-outline" />
        ) : (
          competition.teams.map((team) => (
            <Card key={team.id} style={styles.teamCard}>
              <View style={styles.teamRow}>
                <Avatar uri={team.logo} name={team.name} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.teamName, { color: theme.colors.text }]}>
                    {team.name}
                  </Text>
                  <Muted>
                    {t('competition.playersCount', {
                      count: team.players.length,
                    })}
                  </Muted>
                </View>
              </View>
            </Card>
          ))
        )}
      </View>

      {standings.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title={t('competition.standings')} />
          <Card style={styles.tableCard}>
            {standings.map((row, index) => (
              <View
                key={row.teamId}
                style={[
                  styles.standingRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.rank, { color: theme.colors.textMuted }]}>
                  {index + 1}
                </Text>
                <Avatar uri={row.teamLogo} name={row.teamName} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.teamName, { color: theme.colors.text }]}>
                    {row.teamName}
                  </Text>
                  <Muted>
                    {t('competition.standingLine', {
                      played: row.played,
                      points: row.points,
                      goalDiff: `${row.goalDiff > 0 ? '+' : ''}${row.goalDiff}`,
                    })}
                  </Muted>
                </View>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title={t('competition.matches')} />
        {sortedMatches.length === 0 ? (
          <EmptyState
            title={t('competition.noMatches')}
            description={t('competition.noMatchesDesc')}
            icon="football-outline"
          />
        ) : (
          sortedMatches.map((match) => {
            const played = isMatchPlayed(match);
            return (
              <ListRow
                key={match.id}
                title={`${teamName(match.team1Id)} ${t('screens.vs')} ${teamName(match.team2Id)}`}
                subtitle={
                  played
                    ? `${match.team1Score} - ${match.team2Score} · ${formatArabicDate(match.date)}`
                    : `${formatArabicDate(match.date)} · ${formatArabicTime(match.date)}`
                }
                onPress={() =>
                  router.push(`/(follower)/matches/${match.id}` as any)
                }
              />
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 20, paddingBottom: 40 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  section: { gap: 10 },
  teamCard: { gap: 8 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamName: { fontWeight: '800', textAlign: 'left', fontSize: 14 },
  tableCard: { gap: 0, padding: 0, overflow: 'hidden' },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  rank: { width: 20, fontWeight: '800', textAlign: 'center' },
});
