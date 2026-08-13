import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import {
  Avatar,
  Card,
  LikeButton,
  Muted,
  Title,
} from '@/components/ui';
import { useResponsive } from '@/hooks/useResponsive';
import { useListChrome } from '@/hooks/useListChrome';
import { formatArabicDate } from '@/utils';
import { userHasRole } from '@/utils/roles';
import { useSaveToPrivateSpace } from '@/hooks/useSaveToPrivateSpace';

type MediaFilter = 'all' | 'photos' | 'videos';

const FILTERS: {
  key: MediaFilter;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'all', labelKey: 'screens.all', icon: 'apps-outline', iconActive: 'apps' },
  {
    key: 'photos',
    labelKey: 'screens.photos',
    icon: 'image-outline',
    iconActive: 'image',
  },
  {
    key: 'videos',
    labelKey: 'screens.videos',
    icon: 'videocam-outline',
    iconActive: 'videocam',
  },
];

type PersonalityItem = {
  id: string;
  mediaId: string;
  kind: 'photo' | 'video';
  url: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  handle?: string;
  timestamp: Date;
  likes: string[];
  comments: {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    timestamp: Date | string | number;
  }[];
};

const MediaCard = memo(function MediaCard({
  item,
  liked,
  onLike,
  onPressProfile,
}: {
  item: PersonalityItem;
  liked: boolean;
  onLike: () => void;
  onPressProfile: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <Pressable style={styles.row} onPress={onPressProfile}>
        <Avatar uri={item.authorAvatar} name={item.authorName} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {item.authorName}
          </Text>
          <Muted>
            {item.handle || t('home.freelancerPlayer')} ·{' '}
            {item.kind === 'photo' ? t('common.photo') : t('common.video')} ·{' '}
            {formatArabicDate(item.timestamp)}
          </Muted>
        </View>
      </Pressable>

      {item.kind === 'photo' ? (
        <Image
          source={{ uri: item.url }}
          style={[styles.media, { backgroundColor: theme.colors.surfaceElevated }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <InlineVideoPlayer uri={item.url} />
      )}

      <LikeButton count={item.likes.length} liked={liked} onPress={onLike} />
    </Card>
  );
});

/** شخصية — مخصص لمحتوى اللاعب الحر (صور وفيديوهات) مع إعجاب فعّال. */
export default function PersonalityScreen() {
  const { users, currentUser, toggleMediaLike, addMediaComment } = useTournament();
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { tablet } = useResponsive();
  const listChrome = useListChrome();
  const saveToPrivate = useSaveToPrivateSpace();
  const [filter, setFilter] = useState<MediaFilter>('all');

  const feed = useMemo(() => {
    const items: PersonalityItem[] = [];

    users
      .filter((u) => userHasRole(u, 'freelancer') && u.status === 'active')
      .forEach((u) => {
        (u.media?.photos || []).forEach((photo) => {
          items.push({
            id: `photo-${u.id}-${photo.id}`,
            mediaId: photo.id,
            kind: 'photo',
            url: photo.url,
            authorId: u.id,
            authorName: u.name,
            authorAvatar: u.avatar,
            handle: u.handle,
            timestamp: new Date(photo.timestamp || Date.now()),
            likes: photo.likes,
            comments: photo.comments || [],
          });
        });
        (u.media?.videos || []).forEach((video) => {
          items.push({
            id: `video-${u.id}-${video.id}`,
            mediaId: video.id,
            kind: 'video',
            url: video.url,
            authorId: u.id,
            authorName: u.name,
            authorAvatar: u.avatar,
            handle: u.handle,
            timestamp: new Date(video.timestamp || Date.now()),
            likes: video.likes,
            comments: video.comments || [],
          });
        });
      });

    return items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [users]);

  const filtered = useMemo(() => {
    if (filter === 'photos') return feed.filter((i) => i.kind === 'photo');
    if (filter === 'videos') return feed.filter((i) => i.kind === 'video');
    return feed;
  }, [feed, filter]);

  const counts = useMemo(
    () => ({
      all: feed.length,
      photos: feed.filter((i) => i.kind === 'photo').length,
      videos: feed.filter((i) => i.kind === 'video').length,
    }),
    [feed]
  );

  const freelancersCount = useMemo(
    () => users.filter((u) => userHasRole(u, 'freelancer') && u.status === 'active').length,
    [users]
  );

  const fullScreenData = useMemo<FullScreenContent[]>(
    () =>
      filtered.map((item) => ({
        id: item.id,
        kind: item.kind,
        mediaUrl: item.url,
        authorId: item.authorId,
        authorName: item.authorName,
        authorHandle: item.handle,
        authorAvatar: item.authorAvatar,
        subtitle: `${item.handle || t('home.freelancerPlayer')} · ${
          item.kind === 'photo' ? t('common.photo') : t('common.video')
        }`,
        likes: item.likes,
        liked: !!currentUser && item.likes.includes(currentUser.id),
        comments: (item.comments || []).map((c) => ({
          id: c.id,
          text: c.text,
          authorId: c.authorId,
          authorName: c.authorName,
          authorAvatar: c.authorAvatar,
          timestamp: c.timestamp,
        })),
      })),
    [filtered, currentUser, t]
  );

  const onFullLike = useCallback(
    (item: FullScreenContent) => {
      const source = filtered.find((f) => f.id === item.id);
      if (!source) return;
      toggleMediaLike(source.authorId, source.mediaId, source.kind, 'user');
    },
    [filtered, toggleMediaLike]
  );

  const onFullComment = useCallback(
    (item: FullScreenContent, text: string) => {
      const source = filtered.find((f) => f.id === item.id);
      if (!source) return null;
      const created = addMediaComment(
        source.authorId,
        source.mediaId,
        source.kind,
        text,
        'user'
      );
      if (!created) return null;
      return {
        id: created.id,
        text: created.text,
        authorId: created.authorId,
        authorName: created.authorName,
        authorAvatar: created.authorAvatar,
        timestamp: created.timestamp,
      };
    },
    [filtered, addMediaComment]
  );

  const onPressAuthor = useCallback(
    (item: FullScreenContent) => {
      const source = filtered.find((f) => f.id === item.id);
      if (!source) return;
      router.push(`/(follower)/players/${source.authorId}` as any);
    },
    [filtered, router]
  );

  const filters = (
    <View style={styles.filters}>
      {FILTERS.map((f) => {
        const active = filter === f.key;
        return (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            accessibilityRole="button"
            accessibilityLabel={`${t(f.labelKey)} (${counts[f.key]})`}
            accessibilityState={{ selected: active }}
            style={[
              styles.filterChip,
              {
                backgroundColor: active
                  ? theme.colors.accent
                  : tablet
                    ? theme.colors.inputBg
                    : 'rgba(255,255,255,0.18)',
                borderColor: active
                  ? theme.colors.accent
                  : tablet
                    ? theme.colors.border
                    : 'rgba(255,255,255,0.35)',
              },
            ]}
          >
            <Ionicons
              name={active ? f.iconActive : f.icon}
              size={14}
              color={
                active
                  ? theme.colors.textInverse
                  : tablet
                    ? theme.colors.textMuted
                    : '#fff'
              }
            />
            <Text
              style={{
                color: active
                  ? theme.colors.textInverse
                  : tablet
                    ? theme.colors.textMuted
                    : '#fff',
                fontSize: 11,
                fontWeight: '700',
              }}
              numberOfLines={1}
            >
              {t(f.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: PersonalityItem }) => {
      const liked = !!currentUser && item.likes.includes(currentUser.id);
      return (
        <MediaCard
          item={item}
          liked={liked}
          onLike={() =>
            toggleMediaLike(item.authorId, item.mediaId, item.kind, 'user')
          }
          onPressProfile={() =>
            router.push(`/(follower)/players/${item.authorId}` as any)
          }
        />
      );
    },
    [currentUser, router, toggleMediaLike]
  );

  if (!tablet) {
    return (
      <Screen bleed edges={['left', 'right']}>
        <FullScreenFeed
          data={fullScreenData}
          onLike={onFullLike}
          onComment={onFullComment}
          onPressAuthor={onPressAuthor}
          onDoubleTap={(item) => void saveToPrivate(item)}
          emptyTitle={t('screens.personalityEmpty')}
          emptyDescription={t('screens.personalityEmptyDesc')}
          emptyIcon="star-outline"
          topOverlay={
            <View style={styles.mobileOverlay} pointerEvents="box-none">
              <View style={styles.topBar}>
                <View style={styles.filtersWrap}>{filters}</View>
              </View>
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        {...listChrome}
        contentContainerStyle={[styles.list, listChrome.contentContainerStyle]}
        showsVerticalScrollIndicator
        ListHeaderComponent={
          <View style={styles.header}>
            <Title>{t('home.personalityBanner')}</Title>
            <Muted>
              {t('screens.personalitySubtitle')} · {t('screens.activeFreelancers', { count: freelancersCount })}
            </Muted>
            {filters}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('screens.personalityEmpty')}
            description={t('screens.personalityEmptyDesc')}
            icon="star-outline"
          />
        }
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 12, gap: 12, paddingBottom: 100, flexGrow: 1 },
  header: { gap: 10, marginBottom: 8 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 5,
    alignItems: 'center',
  },
  filterChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mobileOverlay: {
    paddingHorizontal: 8,
    gap: 6,
  },
  topBar: {
    minHeight: 32,

    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filtersWrap: {
    flex: 1,
    minWidth: 0,
  },
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontWeight: '800', textAlign: 'left' },
  media: { width: '100%', aspectRatio: 16 / 9, minHeight: 280, borderRadius: 14 },
});
