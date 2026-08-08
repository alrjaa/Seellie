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

type MediaItem = {
  id: string;
  matchId: string;
  url: string;
  type: 'photo' | 'video';
  matchLabel: string;
  likes: string[];
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
  const { competitions, currentUser, toggleMediaLike } = useTournament();
  const { t } = useTranslation();
  const { tablet } = useResponsive();
  const listChrome = useListChrome();


  const media = useMemo(() => {
    const items: MediaItem[] = [];
    competitions.forEach((comp) => {
      comp.matches.forEach((match) => {
        const team1 = comp.teams.find((t) => t.id === match.team1Id)?.name;
        const team2 = comp.teams.find((t) => t.id === match.team2Id)?.name;
        const label = `${team1 || '?'} vs ${team2 || '?'}`;
        match.media?.photos?.forEach((p) => {
          items.push({
            id: p.id,
            matchId: match.id,
            url: p.url,
            type: 'photo',
            matchLabel: label,
            likes: p.likes,
          });
        });
        match.media?.videos?.forEach((v) => {
          items.push({
            id: v.id,
            matchId: match.id,
            url: v.url,
            type: 'video',
            matchLabel: label,
            likes: v.likes,
          });
        });
      });
    });
    return items;
  }, [competitions]);

  const fullScreenData = useMemo<FullScreenContent[]>(
    () =>
      media.map((item) => ({
        id: `${item.type}-${item.id}`,
        kind: item.type,
        mediaUrl: item.url,
        authorName: item.matchLabel,
        subtitle: item.type === 'photo' ? t('screens.matchClipPhoto') : t('screens.matchClipVideo'),
        likes: item.likes,
        liked: !!currentUser && item.likes.includes(currentUser.id),
      })),
    [media, currentUser, t]
  );

  const onFullLike = useCallback(
    (item: FullScreenContent) => {
      const source = media.find((m) => `${m.type}-${m.id}` === item.id);
      if (!source) return;
      toggleMediaLike(source.matchId, source.id, source.type, 'match');
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
            toggleMediaLike(item.matchId, item.id, item.type, 'match')
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
        keyExtractor={(item) => `${item.type}-${item.id}`}
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
