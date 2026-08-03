import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament, type Competition } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, Muted, Subtitle } from '@/components/ui';
import { formatVenueAddress } from '@/utils/competition';

const CompetitionRow = memo(function CompetitionRow({
  item,
  organizerName,
  onPress,
}: {
  item: Competition;
  organizerName: string;
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
            <Muted>
              {t('superadmin.competitions.organizerLine', { name: organizerName })}
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
        <Text style={[styles.open, { color: theme.colors.primary }]}>
          {t('superadmin.competitions.openAdmin')}
        </Text>
      </Card>
    </Pressable>
  );
});

export default function CompetitionsScreen() {
  const { competitions, users } = useTournament();
  const router = useRouter();
  const { t } = useTranslation();

  const organizerMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const renderItem = useCallback(
    ({ item }: { item: Competition }) => (
      <CompetitionRow
        item={item}
        organizerName={
          organizerMap.get(item.organizerId) || t('superadmin.labels.unknown')
        }
        onPress={() => router.push(`/(superadmin)/competitions/${item.id}`)}
      />
    ),
    [organizerMap, router, t]
  );

  return (
    <Screen>
      <FlatList
        data={competitions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.modules.competitions.title')}</Subtitle>
            <Muted>{t('superadmin.competitions.subtitle')}</Muted>
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
