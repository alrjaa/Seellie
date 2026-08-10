import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTournament, type Competition } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Avatar, Button, Card, Muted, Subtitle } from '@/components/ui';
import { formatVenueAddress } from '@/utils/competition';
import { statusToneColor } from '@/utils/status-tone';
import { isSupabaseConfigured } from '@/services/supabase';
import { confirmDestructive } from '@/utils/confirm';

const CompetitionRow = memo(function CompetitionRow({
  item,
  onPress,
  onDelete,
}: {
  item: Competition;
  onPress: () => void;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const statusColor = statusToneColor(theme.colors, item.status);

  return (
    <Card style={styles.card}>
      <Pressable onPress={onPress} accessibilityRole="button">
        <View
          style={[
            styles.row,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
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
        <Text style={[styles.open, { color: theme.colors.accent }]}>
          {t('organizer.competitions.manageLink')}
        </Text>
      </Pressable>
      <Pressable onPress={onDelete} accessibilityRole="button">
        <Text style={[styles.delete, { color: theme.colors.danger }]}>
          {t('organizer.competitionManage.deleteCompetition')}
        </Text>
      </Pressable>
    </Card>
  );
});

export default function OrganizerCompetitionsScreen() {
  const {
    competitions,
    currentUser,
    deleteCompetition,
    refreshCloudCompetitionRequests,
  } = useTournament();
  const router = useRouter();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!isSupabaseConfigured()) return;
      void refreshCloudCompetitionRequests();
    }, [refreshCloudCompetitionRequests])
  );

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

  const confirmDelete = useCallback(
    async (item: Competition) => {
      const ok = await confirmDestructive({
        title: t('organizer.competitionManage.deleteCompetition'),
        message: t('organizer.competitionManage.deleteCompetitionConfirm'),
        cancelLabel: t('common.cancel'),
        confirmLabel: t('organizer.competitionManage.deleteCompetition'),
      });
      if (!ok) return;
      void deleteCompetition(item.id);
    },
    [deleteCompetition, t]
  );

  const renderItem = useCallback(
    ({ item }: { item: Competition }) => (
      <CompetitionRow
        item={item}
        onPress={() => router.push(`/(organizer)/competitions/${item.id}`)}
        onDelete={() => confirmDelete(item)}
      />
    ),
    [router, confirmDelete]
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
            title={t('organizer.competitions.empty')}
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
  row: { gap: 12, alignItems: 'center' },
  name: { fontWeight: '800', fontSize: 15 },
  status: { fontWeight: '800', fontSize: 12 },
  open: { fontWeight: '800', fontSize: 12 },
  delete: { fontWeight: '800', fontSize: 12, marginTop: 2 },
});
