import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useTournament,
  type Competition,
  type Match,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useListChrome } from '@/hooks/useListChrome';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Avatar,
  Card,
  Muted,
  SearchBar,
  Subtitle,
} from '@/components/ui';
import { formatArabicDate, formatArabicTime } from '@/utils';

type MatchRow = Match & {
  competition: Competition;
  team1Name: string;
  team2Name: string;
  team1Logo?: string;
  team2Logo?: string;
};

function isMatchPlayed(match: Match): boolean {
  const now = Date.now();
  return (
    new Date(match.date).getTime() <= now ||
    match.team1Score > 0 ||
    match.team2Score > 0
  );
}

const MatchCard = memo(function MatchCard({ item }: { item: MatchRow }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const played = isMatchPlayed(item);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/(follower)/matches/${item.id}` as any)}
    >
      <Card style={styles.card}>
        <View style={styles.topRow}>
          <Text style={[styles.competition, { color: theme.colors.textMuted }]}>
            {item.competition.name}
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: played
                  ? theme.colors.primarySoft
                  : theme.colors.inputBg,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color: played ? theme.colors.primary : theme.colors.textMuted,
                },
              ]}
            >
              {played ? t('screens.finished') : t('screens.upcoming')}
            </Text>
          </View>
        </View>
        <View style={styles.teamsRow}>
          <View style={styles.teamCol}>
            <Avatar uri={item.team1Logo} name={item.team1Name} size={44} />
            <Text style={[styles.teamName, { color: theme.colors.text }]}>
              {item.team1Name}
            </Text>
          </View>
          <Text style={[styles.score, { color: theme.colors.text }]}>
            {played ? `${item.team1Score} - ${item.team2Score}` : 'vs'}
          </Text>
          <View style={styles.teamCol}>
            <Avatar uri={item.team2Logo} name={item.team2Name} size={44} />
            <Text style={[styles.teamName, { color: theme.colors.text }]}>
              {item.team2Name}
            </Text>
          </View>
        </View>
        <Muted>{formatArabicDate(item.date)}</Muted>
        <Muted>{formatArabicTime(item.date)}</Muted>
      </Card>
    </Pressable>
  );
});

export default function MatchesScreen() {
  const { competitions } = useTournament();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const listChrome = useListChrome();


  const matches = useMemo(() => {
    const rows: MatchRow[] = [];
    competitions.forEach((comp) => {
      comp.matches.forEach((match) => {
        const team1 = comp.teams.find((t) => t.id === match.team1Id);
        const team2 = comp.teams.find((t) => t.id === match.team2Id);
        if (!team1 || !team2) return;
        rows.push({
          ...match,
          competition: comp,
          team1Name: team1.name,
          team2Name: team2.name,
          team1Logo: team1.logo,
          team2Logo: team2.logo,
        });
      });
    });
    return rows.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [competitions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(
      (m) =>
        m.team1Name.toLowerCase().includes(q) ||
        m.team2Name.toLowerCase().includes(q)
    );
  }, [matches, query]);

  const renderItem = useCallback(
    ({ item }: { item: MatchRow }) => <MatchCard item={item} />,
    []
  );

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        {...listChrome}
        contentContainerStyle={[styles.list, listChrome.contentContainerStyle]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Subtitle>{t('screens.matches')}</Subtitle>
            <Muted>{t('home.matchesSub')}</Muted>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={t('screens.searchMatches')}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={query ? t('common.noResults') : t('screens.noMatches')}
            description={
              query
                ? t('screens.tryOtherTeam')
                : t('screens.noMatchesDesc')
            }
            icon="football-outline"
          />
        }
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 12, gap: 10, paddingBottom: 40 },
  header: { gap: 10, marginBottom: 4 },
  card: { gap: 8 },
  topRow: {
    direction: 'ltr',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  competition: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamCol: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { fontWeight: '700', fontSize: 12, textAlign: 'center' },
  score: { fontSize: 20, fontWeight: '800' },
});
