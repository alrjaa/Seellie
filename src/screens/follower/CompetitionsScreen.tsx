import React, { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useTournament,
  type Competition,
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
  StatusBadge,
  Subtitle,
} from '@/components/ui';
import { formatVenueAddress } from '@/utils/competition';
import { localizeContentText } from '@/i18n/localize-content';

const CompetitionCard = memo(function CompetitionCard({
  item,
  pinned,
  onTogglePin,
}: {
  item: Competition;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const theme = useAppTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const venue = formatVenueAddress(item);
  const name =
    language === 'en' ? localizeContentText(item.name) : item.name;

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push(`/(follower)/competitions/${item.id}` as any)
        }
      >
        <View style={styles.row}>
          <Avatar uri={item.logo} name={name} size={48} />
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {name}
            </Text>
            <Muted>
              {t('screens.teamsMatches', {
                teams: item.teams.length,
                matches: item.matches.length,
              })}
              {pinned ? ` · ${t('home.pinned')}` : ''}
            </Muted>
            <Muted numberOfLines={2}>
              {venue === t('screens.venueNotSet') || !venue
                ? t('screens.noVenue')
                : venue}
            </Muted>
          </View>
          <StatusBadge status={item.status} />
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pinned ? t('screens.unpin') : t('screens.pinHome')}
        onPress={onTogglePin}
        style={[
          styles.pinRow,
          { borderTopColor: theme.colors.border },
        ]}
      >
        <Muted>{pinned ? t('screens.pinnedHome') : t('screens.pinHome')}</Muted>
      </Pressable>
    </Card>
  );
});

export default function CompetitionsScreen() {
  const { competitions, currentUser, togglePinnedCompetition } = useTournament();
  const { t, language } = useTranslation();
  const [query, setQuery] = useState('');
  const listChrome = useListChrome();

  const pinnedIds = currentUser?.pinnedCompetitionIds || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return competitions;
    return competitions.filter((c) => {
      const name =
        language === 'en' ? localizeContentText(c.name) : c.name;
      const venue = formatVenueAddress(c);
      return (
        name.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.visibleId.toLowerCase().includes(q) ||
        venue.toLowerCase().includes(q) ||
        c.venue?.city?.toLowerCase().includes(q)
      );
    });
  }, [competitions, query, language]);

  return (
    <Screen contentStyle={styles.content}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={t('screens.searchCompetitions')}
      />
      <View style={styles.belowSearch}>
        <Subtitle>{t('screens.competitions')}</Subtitle>
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item) => item.id}
          {...listChrome}
          contentContainerStyle={[styles.list, listChrome.contentContainerStyle]}
          showsVerticalScrollIndicator
          ListEmptyComponent={
            <EmptyState
              title={t('screens.noCompetitions')}
              description={t('screens.noCompetitionsDesc')}
              icon="trophy-outline"
            />
          }
          renderItem={({ item }) => (
            <CompetitionCard
              item={item}
              pinned={pinnedIds.includes(item.id)}
              onTogglePin={() => togglePinnedCompetition(item.id)}
            />
          )}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, flex: 1 },
  belowSearch: { flex: 1, gap: 12, minHeight: 0 },
  list: { gap: 10, paddingBottom: 40 },
  card: { gap: 0, paddingBottom: 10, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textCol: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'left',
  },
  pinRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 10,
    alignItems: 'flex-start',
  },
});
