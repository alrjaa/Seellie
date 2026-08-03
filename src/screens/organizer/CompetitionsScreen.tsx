import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament, type Competition } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Avatar, Button, Card, Muted, Subtitle } from '@/components/ui';
import { formatVenueAddress } from '@/utils/competition';

const CompetitionRow = memo(function CompetitionRow({
  item,
  onPress,
}: {
  item: Competition;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const statusColor =
    item.status === 'active'
      ? theme.colors.primary
      : item.status === 'suspended'
        ? theme.colors.danger
        : theme.colors.warning;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar uri={item.logo} name={item.name} size={48} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {item.name}
            </Text>
            <Muted numberOfLines={2}>{formatVenueAddress(item)}</Muted>
            <Muted>
              {t('superadmin.competitions.statsLine', {
                teams: item.teams.length,
                matches: item.matches.length,
                referees: item.refereeIds.length,
              })}
            </Muted>
            <Text style={[styles.status, { color: statusColor }]}>
              {t(`superadmin.competitionStatus.${item.status}`)}
            </Text>
          </View>
        </View>
        <Text style={[styles.open, { color: theme.colors.primary }]}>
          {t('organizer.competitions.manageLink')}
        </Text>
      </Card>
    </Pressable>
  );
});

export default function OrganizerCompetitionsScreen() {
  const { competitions, currentUser } = useTournament();
  const router = useRouter();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    if (!currentUser) return [];
    return competitions.filter((c) => c.organizerId === currentUser.id);
  }, [competitions, currentUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.visibleId.toLowerCase().includes(q)
    );
  }, [list, query]);

  const renderItem = useCallback(
    ({ item }: { item: Competition }) => (
      <CompetitionRow
        item={item}
        onPress={() => router.push(`/(organizer)/competitions/${item.id}`)}
      />
    ),
    [router]
  );

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <Subtitle>{t('organizer.competitions.title')}</Subtitle>
            <Muted>{t('organizer.competitions.subtitle')}</Muted>
            <Button
              label={t('organizer.competitions.requestNew')}
              onPress={() => router.push('/(organizer)/request-competition')}
            />
            <SearchBar value={query} onChangeText={setQuery} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('superadmin.competitions.empty')}
            icon="trophy-outline"
          />
        }
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  name: { fontWeight: '800', textAlign: 'left', fontSize: 15 },
  status: { fontWeight: '800', textAlign: 'left', fontSize: 12 },
  open: { fontWeight: '800', textAlign: 'left', fontSize: 12 },
});
