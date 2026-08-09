import React, { memo, useCallback, useMemo } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  FullScreenFeed,
  type FullScreenContent,
} from '@/components/media/FullScreenFeed';
import { Card, LikeButton, Muted, Subtitle } from '@/components/ui';
import { useResponsive } from '@/hooks/useResponsive';
import { useListChrome } from '@/hooks/useListChrome';
import { useSaveToPrivateSpace } from '@/hooks/useSaveToPrivateSpace';

type MediaItem = {
  id: string;
  /** match id أو competition id حسب المصدر */
  ownerId: string;
  source: 'match' | 'competition';
  url: string;
  type: 'photo' | 'video';
  matchLabel: string;
  likes: string[];
  organizerId?: string;
  organizerName?: string;
  organizerHandle?: string;
};

const MediaRow = memo(function MediaRow({
  item,
  liked,
  onLike,
}: {
  item: MediaItem;
  liked: boolean;
  onLike: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      {item.type === 'photo' ? (
        <Image
          source={{ uri: item.url }}
          style={styles.thumb}
          contentFit="cover"
        />
      ) : (
        <Pressable
          onPress={() => {
            void Linking.openURL(item.url).catch(() => undefined);
          }}
          style={[styles.videoThumb, { backgroundColor: theme.colors.accentSoft }]}
        >
          <Ionicons name="play" size={22} color={theme.colors.accent} />
        </Pressable>
      )}
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {item.matchLabel}
        </Text>
        <Muted>{item.type === 'photo' ? t('common.photo') : t('common.video')}</Muted>
        <LikeButton count={item.likes.length} liked={liked} onPress={onLike} size="sm" />
      </View>
    </Card>
  );
});

export default function HighlightsScreen() {
  const { competitions, currentUser, toggleMediaLike, users } = useTournament();
  const { t } = useTranslation();
  const router = useRouter();
  const { tablet } = useResponsive();
  const listChrome = useListChrome();
  const saveToPrivate = useSaveToPrivateSpace();

  const media = useMemo(() => {
    const items: MediaItem[] = [];
    competitions.forEach((comp) => {
      const organizer = users.find((u) => u.id === comp.organizerId);
      const organizerName = organizer?.name || comp.name;
      const organizerHandle = organizer?.handle;
      (comp.media?.photos || []).forEach((p) => {
        items.push({
          id: p.id,
          ownerId: comp.id,
          source: 'competition',
          url: p.url,
          type: 'photo',
          matchLabel: comp.name,
          likes: p.likes,
          organizerId: comp.organizerId,
          organizerName,
          organizerHandle,
        });
      });
      (comp.media?.videos || []).forEach((v) => {
        items.push({
          id: v.id,
          ownerId: comp.id,
          source: 'competition',
          url: v.url,
          type: 'video',
          matchLabel: comp.name,
          likes: v.likes,
          organizerId: comp.organizerId,
          organizerName,
          organizerHandle,
        });
      });

      comp.matches.forEach((match) => {
        const team1 = comp.teams.find((t) => t.id === match.team1Id)?.name;
        const team2 = comp.teams.find((t) => t.id === match.team2Id)?.name;
        const label = `${team1 || '?'} vs ${team2 || '?'}`;
        match.media?.photos?.forEach((p) => {
          items.push({
            id: p.id,
            ownerId: match.id,
            source: 'match',
            url: p.url,
            type: 'photo',
            matchLabel: label,
            likes: p.likes,
            organizerId: comp.organizerId,
            organizerName,
            organizerHandle,
          });
        });
        match.media?.videos?.forEach((v) => {
          items.push({
            id: v.id,
            ownerId: match.id,
            source: 'match',
            url: v.url,
            type: 'video',
            matchLabel: label,
            likes: v.likes,
            organizerId: comp.organizerId,
            organizerName,
            organizerHandle,
          });
        });
      });
    });
    return items;
  }, [competitions, users]);

  const fullScreenData = useMemo<FullScreenContent[]>(
    () =>
      media.map((item) => ({
        id: `${item.source}-${item.type}-${item.id}`,
        kind: item.type,
        mediaUrl: item.url,
        authorId: item.organizerId,
        authorName: item.organizerName || item.matchLabel,
        authorHandle: item.organizerHandle,
        title: item.matchLabel,
        subtitle:
          item.source === 'competition'
            ? item.type === 'photo'
              ? t('screens.competitionClipPhoto')
              : t('screens.competitionClipVideo')
            : item.type === 'photo'
              ? t('screens.matchClipPhoto')
              : t('screens.matchClipVideo'),
        likes: item.likes,
        liked: !!currentUser && item.likes.includes(currentUser.id),
      })),
    [media, currentUser, t]
  );

  const onFullLike = useCallback(
    (item: FullScreenContent) => {
      const source = media.find(
        (m) => `${m.source}-${m.type}-${m.id}` === item.id
      );
      if (!source) return;
      toggleMediaLike(source.ownerId, source.id, source.type, source.source);
    },
    [media, toggleMediaLike]
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const liked = !!currentUser && item.likes.includes(currentUser.id);
      return (
        <MediaRow
          item={item}
          liked={liked}
          onLike={() =>
            toggleMediaLike(item.ownerId, item.id, item.type, item.source)
          }
        />
      );
    },
    [currentUser, toggleMediaLike]
  );

  if (!tablet) {
    return (
      <Screen bleed edges={['left', 'right']}>
        <FullScreenFeed
          data={fullScreenData}
          onLike={onFullLike}
          onDoubleTap={(item) => void saveToPrivate(item)}
          emptyTitle={t('screens.noHighlights')}
          emptyDescription={t('screens.noHighlightsDesc')}
          emptyIcon="images-outline"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        data={media}
        keyExtractor={(item) => `${item.source}-${item.type}-${item.id}`}
        {...listChrome}
        contentContainerStyle={[styles.list, listChrome.contentContainerStyle]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Subtitle>{t('screens.topHighlights')}</Subtitle>
            <Muted>{t('screens.highlightsHint')}</Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('screens.noHighlights')}
            description={t('screens.noHighlightsDesc')}
            icon="images-outline"
          />
        }
        initialNumToRender={8}
        windowSize={7}
        showsVerticalScrollIndicator
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 12, gap: 10, paddingBottom: 100 },
  header: { gap: 4, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  videoThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700', textAlign: 'left' },
});
