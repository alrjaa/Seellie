import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  Chip,
  Muted,
  SearchBar,
  StatusBadge,
  Subtitle,
} from '@/components/ui';
import {
  competitionMatchesPlaceQuery,
  formatVenueAddress,
  listCompetitionPlaceOptions,
  selectHomeCompetitions,
  userHasLocation,
} from '@/utils/competition';
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
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [placeFilter, setPlaceFilter] = useState('');
  const listChrome = useListChrome();

  const pinnedIds = currentUser?.pinnedCompetitionIds || [];
  const hasLocation = userHasLocation(currentUser);
  const locationLabel = [currentUser?.city, currentUser?.region, currentUser?.country]
    .filter(Boolean)
    .join(' · ');

  const placeOptions = useMemo(
    () => listCompetitionPlaceOptions(competitions),
    [competitions]
  );

  const isBrowsingElsewhere =
    query.trim().length > 0 || placeFilter.trim().length > 0;

  const localCompetitions = useMemo(
    () => selectHomeCompetitions(competitions, currentUser),
    [competitions, currentUser]
  );

  const filtered = useMemo(() => {
    const active = competitions.filter((c) => c.status === 'active');
    if (!isBrowsingElsewhere) {
      return localCompetitions;
    }

    const q = query.trim();
    const place = placeFilter.trim();
    return active.filter((c) => {
      if (q && !competitionMatchesPlaceQuery(c, q)) return false;
      if (place) {
        const hit =
          competitionMatchesPlaceQuery(c, place) ||
          placesExact(c.venue?.country, place) ||
          placesExact(c.venue?.city, place) ||
          placesExact(c.venue?.region, place);
        if (!hit) return false;
      }
      return true;
    });
  }, [
    competitions,
    isBrowsingElsewhere,
    localCompetitions,
    placeFilter,
    query,
  ]);

  const clearPlace = useCallback(() => setPlaceFilter(''), []);

  const togglePlace = useCallback((value: string) => {
    setPlaceFilter((prev) => (prev === value ? '' : value));
  }, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <Muted>
          {isBrowsingElsewhere
            ? t('screens.competitionsSearchHint')
            : hasLocation
              ? t('screens.competitionsNearYou', { location: locationLabel })
              : t('screens.competitionsSetAddress')}
        </Muted>
        {(placeOptions.countries.length > 0 ||
          placeOptions.cities.length > 0) && (
          <View style={styles.chipsBlock}>
            <Muted>{t('screens.exploreOtherPlaces')}</Muted>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              <Chip
                label={t('screens.allPlaces')}
                active={!placeFilter}
                onPress={clearPlace}
              />
              {placeOptions.countries.map((country) => (
                <Chip
                  key={`c-${country}`}
                  label={
                    language === 'en'
                      ? localizeContentText(country)
                      : country
                  }
                  active={placeFilter === country}
                  onPress={() => togglePlace(country)}
                />
              ))}
              {placeOptions.cities.map((city) => (
                <Chip
                  key={`city-${city}`}
                  label={
                    language === 'en' ? localizeContentText(city) : city
                  }
                  active={placeFilter === city}
                  onPress={() => togglePlace(city)}
                />
              ))}
            </ScrollView>
          </View>
        )}
        <Subtitle>
          {isBrowsingElsewhere
            ? t('screens.competitionsSearchResults')
            : t('screens.competitionsNearTitle')}
        </Subtitle>
      </View>
    ),
    [
      clearPlace,
      hasLocation,
      isBrowsingElsewhere,
      language,
      locationLabel,
      placeFilter,
      placeOptions.cities,
      placeOptions.countries,
      t,
      togglePlace,
    ]
  );

  return (
    <Screen contentStyle={styles.content}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={t('screens.searchCompetitionsPlaces')}
      />
      <View style={styles.belowSearch}>
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item) => item.id}
          {...listChrome}
          contentContainerStyle={[styles.list, listChrome.contentContainerStyle]}
          showsVerticalScrollIndicator
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              title={
                isBrowsingElsewhere
                  ? t('screens.noCompetitionsSearch')
                  : t('screens.noCompetitions')
              }
              description={
                isBrowsingElsewhere
                  ? t('screens.noCompetitionsSearchDesc')
                  : hasLocation
                    ? t('screens.noCompetitionsNearDesc')
                    : t('screens.noCompetitionsDesc')
              }
              icon="trophy-outline"
              actionLabel={
                !isBrowsingElsewhere && !hasLocation
                  ? t('home.editAddress')
                  : undefined
              }
              onAction={
                !isBrowsingElsewhere && !hasLocation
                  ? () =>
                      router.push('/(follower)/settings/account' as any)
                  : undefined
              }
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

function placesExact(a?: string, b?: string): boolean {
  const left = (a || '').trim().toLowerCase();
  const right = (b || '').trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, flex: 1 },
  belowSearch: { flex: 1, gap: 12, minHeight: 0 },
  headerBlock: { gap: 10, marginBottom: 4 },
  chipsBlock: { gap: 8 },
  chipsRow: { gap: 8, paddingVertical: 2, alignItems: 'center' },
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
