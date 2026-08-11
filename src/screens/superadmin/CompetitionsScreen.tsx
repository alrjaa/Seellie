import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTournament, type Competition } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, Muted, SearchBar, Subtitle } from '@/components/ui';
import { formatVenueAddress } from '@/utils/competition';
import { matchesSearchQuery } from '@/utils/search';
import { statusToneColor } from '@/utils/status-tone';
import { isSupabaseConfigured } from '@/services/supabase';
import { confirmDestructive } from '@/utils/confirm';

const CompetitionRow = memo(function CompetitionRow({
  item,
  organizerName,
  onPress,
  onDelete,
}: {
  item: Competition;
  organizerName: string;
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
            <Muted>
              {t('superadmin.competitions.organizerLine', {
                name: organizerName,
              })}
            </Muted>
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
          {t('superadmin.competitions.openAdmin')}
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

export default function CompetitionsScreen() {
  const {
    competitions,
    users,
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

  const organizerMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const data = useMemo(
    () =>
      competitions.filter((c) =>
        matchesSearchQuery(
          query,
          c.name,
          c.id,
          c.visibleId,
          c.status,
          organizerMap.get(c.organizerId),
          formatVenueAddress(c)
        )
      ),
    [competitions, organizerMap, query]
  );

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
        organizerName={
          organizerMap.get(item.organizerId) || t('superadmin.labels.unknown')
        }
        onPress={() => router.push(`/admin/competitions/${item.id}` as any)}
        onDelete={() => confirmDelete(item)}
      />
    ),
    [organizerMap, router, t, confirmDelete]
  );

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.modules.competitions.title')}</Subtitle>
            <Muted>{t('superadmin.competitions.subtitle')}</Muted>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={t('superadmin.searchPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              query.trim()
                ? t('superadmin.noSearchResults')
                : t('superadmin.competitions.empty')
            }
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
  name: { fontWeight: '800', fontSize: 13 },
  status: { fontWeight: '800', fontSize: 11 },
  open: { fontWeight: '800', fontSize: 11 },
  delete: {
    fontWeight: '800',
    fontSize: 12,
    marginTop: 4,
  },
});
