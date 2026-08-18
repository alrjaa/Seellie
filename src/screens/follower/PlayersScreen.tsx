import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useTournament,
  type Player,
  type User,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useListChrome } from '@/hooks/useListChrome';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FreelancerPlayerCard } from '@/components/player/FreelancerPlayerCard';
import {
  Avatar,
  Card,
  Muted,
  SearchBar,
  Subtitle,
} from '@/components/ui';
import { cairoText } from '@/theme/fonts';
import { userHasRole } from '@/utils/roles';

type PlayerRow = {
  id: string;
  name: string;
  avatar?: string;
  teamName: string;
  position?: string;
  jerseyNumber?: number;
  isFreelancer: boolean;
  handle?: string;
  visibleId?: string;
  city?: string;
  bio?: string;
  photosCount?: number;
  videosCount?: number;
  totalLikes?: number;
};

const TeamPlayerRowCard = memo(function TeamPlayerRowCard({
  item,
}: {
  item: PlayerRow;
}) {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/(follower)/players/${item.id}` as any)}
    >
      <Card style={styles.teamCard} padded={false}>
        <View style={styles.teamRow}>
          <Avatar uri={item.avatar} name={item.name} size={48} />
          <View style={styles.textCol}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
              {item.teamName}
              {item.position
                ? `  ·  ${item.position}${
                    item.jerseyNumber ? ` #${item.jerseyNumber}` : ''
                  }`
                : ''}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
});

const PlayerRowCard = memo(function PlayerRowCard({
  item,
}: {
  item: PlayerRow;
}) {
  const router = useRouter();

  if (item.isFreelancer) {
    return (
      <FreelancerPlayerCard
        variant="row"
        name={item.name}
        avatar={item.avatar}
        handle={item.handle}
        visibleId={item.visibleId}
        city={item.city}
        bio={item.bio}
        photosCount={item.photosCount}
        videosCount={item.videosCount}
        totalLikes={item.totalLikes}
        onPress={() => router.push(`/(follower)/players/${item.id}` as any)}
      />
    );
  }

  return <TeamPlayerRowCard item={item} />;
});

export default function PlayersScreen() {
  const { competitions, users } = useTournament();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const listChrome = useListChrome();

  const players = useMemo(() => {
    const rows: PlayerRow[] = [];

    competitions.forEach((comp) => {
      (comp.teams || []).forEach((team) => {
        (team.players || []).forEach((player: Player) => {
          rows.push({
            id: player.id,
            name: player.name,
            avatar: player.avatar,
            teamName: team.name,
            position: player.position,
            jerseyNumber: player.jerseyNumber,
            isFreelancer: false,
          });
        });
      });
    });

    users
      .filter((u) => userHasRole(u, 'freelancer'))
      .forEach((user: User) => {
        const photos = user.media?.photos || [];
        const videos = user.media?.videos || [];
        const totalLikes =
          photos.reduce((s, p) => s + p.likes.length, 0) +
          videos.reduce((s, v) => s + v.likes.length, 0);
        rows.push({
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          teamName: t('home.freelancerPlayer'),
          isFreelancer: true,
          handle: user.handle,
          visibleId: user.visibleId,
          city: user.city,
          bio: user.bio,
          photosCount: photos.length,
          videosCount: videos.length,
          totalLikes,
        });
      });

    return rows.sort((a, b) => {
      if (a.isFreelancer !== b.isFreelancer) return a.isFreelancer ? -1 : 1;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [competitions, users, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q) ||
        (p.handle || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q)
    );
  }, [players, query]);

  const renderItem = useCallback(
    ({ item }: { item: PlayerRow }) => <PlayerRowCard item={item} />,
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
            <Subtitle>{t('screens.players')}</Subtitle>
            <Muted>{t('screens.playersGuide')}</Muted>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={t('screens.searchPlayers')}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={query ? t('common.noResults') : t('screens.noPlayers')}
            description={
              query ? t('screens.tryOtherPlayer') : t('screens.noPlayersDesc')
            }
            icon="people-outline"
          />
        }
        initialNumToRender={10}
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
  teamCard: { overflow: 'hidden' },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  textCol: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    ...cairoText('extraBold'),
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
  },
  meta: {
    ...cairoText('medium'),
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
  },
});
