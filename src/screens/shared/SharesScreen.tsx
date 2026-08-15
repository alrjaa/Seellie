import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createId } from '@/utils/id';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { HeaderBackButton } from '@/components/layout/HeaderBackButton';
import {
  StackTopChrome,
  stackTopChromePad,
} from '@/components/layout/StackTopChrome';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PlayerMediaSection } from '@/components/media/PlayerMediaSection';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import {
  ShareTargetModal,
  TinyShareButton,
  type ContentSharePayload,
} from '@/components/share/ShareTargetModal';
import {
  FullScreenFeed,
  type FullScreenContent,
} from '@/components/media/FullScreenFeed';
import { resolveLocationLabel } from '@/utils/location-label';
import {
  Avatar,
  Button,
  Card,
  Input,
  LikeButton,
  Muted,
  Subtitle,
} from '@/components/ui';
import { useResponsive } from '@/hooks/useResponsive';
import { useListChrome } from '@/hooks/useListChrome';
import { useSaveToPrivateSpace } from '@/hooks/useSaveToPrivateSpace';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatArabicDate } from '@/utils';
import { userHasRole } from '@/utils/roles';

type ShareFilter = 'all' | 'photos' | 'videos' | 'posts';

type ShareItem = {
  id: string;
  mediaId: string;
  kind: 'photo' | 'video' | 'post';
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  teamName?: string;
  text?: string;
  mediaUrl?: string;
  timestamp: Date;
  likes: string[];
  source: 'user' | 'player';
  locationCity?: string;
  locationRegion?: string;
};

const ShareCard = memo(function ShareCard({
  item,
  liked,
  onLike,
  onOpenPlayer,
  onShare,
}: {
  item: ShareItem;
  liked: boolean;
  onLike: () => void;
  onOpenPlayer?: () => void;
  onShare?: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <Pressable
        style={styles.row}
        onPress={onOpenPlayer}
        disabled={!onOpenPlayer}
      >
        <Avatar uri={item.authorAvatar} name={item.authorName} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.author, { color: theme.colors.text }]}>
            {item.authorName}
          </Text>
          <Muted>
            {item.kind === 'photo'
              ? t('common.photo')
              : item.kind === 'video'
                ? t('common.video')
                : t('sharesUi.textShare')}
            {item.teamName ? ` · ${item.teamName}` : ''}
            {' · '}
            {formatArabicDate(item.timestamp)}
          </Muted>
        </View>
        {onShare && item.kind === 'post' ? (
          <TinyShareButton onPress={onShare} />
        ) : null}
        <View
          style={[
            styles.kindBadge,
            { backgroundColor: theme.colors.accentSoft },
          ]}
        >
          <Ionicons
            name={
              item.kind === 'photo'
                ? 'image-outline'
                : item.kind === 'video'
                  ? 'videocam-outline'
                  : 'document-text-outline'
            }
            size={16}
            color={theme.colors.accent}
          />
        </View>
      </Pressable>

      {item.text ? (
        <Text style={[styles.body, { color: theme.colors.text }]}>
          {item.text}
        </Text>
      ) : null}

      {item.kind === 'photo' && item.mediaUrl ? (
        <View style={styles.mediaWrap}>
          <Image
            source={{ uri: item.mediaUrl }}
            style={styles.media}
            contentFit="cover"
            transition={200}
          />
          {onShare ? (
            <View style={styles.mediaShare}>
              <TinyShareButton onPress={onShare} />
            </View>
          ) : null}
        </View>
      ) : null}

      {item.kind === 'video' && item.mediaUrl ? (
        <View style={styles.mediaWrap}>
          <InlineVideoPlayer uri={item.mediaUrl} height={220} />
          {onShare ? (
            <View style={styles.mediaShare}>
              <TinyShareButton onPress={onShare} />
            </View>
          ) : null}
        </View>
      ) : null}

      <LikeButton count={item.likes.length} liked={liked} onPress={onLike} />
    </Card>
  );
});

/**
 * مشاركات اللاعبين: صور + فيديوهات + نصوص.
 * الجميع يشاهد؛ اللاعب الحر فقط ينشر ويدير وسائطه.
 */
export default function SharesScreen() {
  const {
    currentUser,
    loading,
    users,
    competitions,
    updateUser,
    addUserMedia,
    removeUserMedia,
    setUserAvatar,
    togglePostLike,
    toggleMediaLike,
  } = useTournament();
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { tablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const topPad = stackTopChromePad(insets.top);
  const listChrome = useListChrome({ hasTabBar: false });
  const saveToPrivate = useSaveToPrivateSpace();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<ShareFilter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<ContentSharePayload | null>(
    null
  );

  const isPlayer = userHasRole(currentUser, 'freelancer');
  const freelancerLabel = t('home.freelancerPlayer');

  const feed = useMemo(() => {
    const items: ShareItem[] = [];

    users
      .filter((u) => userHasRole(u, 'freelancer'))
      .forEach((u) => {
        u.posts.forEach((p) => {
          items.push({
            id: `post-${p.id}`,
            mediaId: p.id,
            kind: 'post',
            authorId: u.id,
            authorName: u.name,
            authorAvatar: u.avatar,
            teamName: freelancerLabel,
            text: p.text,
            timestamp: new Date(p.timestamp),
            likes: p.likes,
            source: 'user',
            locationCity: u.city,
            locationRegion: u.region,
          });
        });
        (u.media?.photos || []).forEach((photo) => {
          items.push({
            id: `photo-user-${photo.id}`,
            mediaId: photo.id,
            kind: 'photo',
            authorId: u.id,
            authorName: u.name,
            authorAvatar: u.avatar,
            teamName: freelancerLabel,
            mediaUrl: photo.url,
            timestamp: new Date(photo.timestamp || Date.now()),
            likes: photo.likes,
            source: 'user',
            locationCity: u.city,
            locationRegion: u.region,
          });
        });
        (u.media?.videos || []).forEach((video) => {
          items.push({
            id: `video-user-${video.id}`,
            mediaId: video.id,
            kind: 'video',
            authorId: u.id,
            authorName: u.name,
            authorAvatar: u.avatar,
            teamName: freelancerLabel,
            mediaUrl: video.url,
            timestamp: new Date(video.timestamp || Date.now()),
            likes: video.likes,
            source: 'user',
            locationCity: u.city,
            locationRegion: u.region,
          });
        });
      });

    competitions.forEach((comp) => {
      const locationCity = comp.venue?.city;
      const locationRegion = comp.venue?.region;
      comp.teams.forEach((team) => {
        team.players.forEach((player) => {
          (player.media?.photos || []).forEach((photo) => {
            items.push({
              id: `photo-player-${player.id}-${photo.id}`,
              mediaId: photo.id,
              kind: 'photo',
              authorId: player.id,
              authorName: player.name,
              authorAvatar: player.avatar,
              teamName: team.name,
              mediaUrl: photo.url,
              timestamp: new Date(photo.timestamp || Date.now()),
              likes: photo.likes,
              source: 'player',
              locationCity,
              locationRegion,
            });
          });
          (player.media?.videos || []).forEach((video) => {
            items.push({
              id: `video-player-${player.id}-${video.id}`,
              mediaId: video.id,
              kind: 'video',
              authorId: player.id,
              authorName: player.name,
              authorAvatar: player.avatar,
              teamName: team.name,
              mediaUrl: video.url,
              timestamp: new Date(video.timestamp || Date.now()),
              likes: video.likes,
              source: 'player',
              locationCity,
              locationRegion,
            });
          });
        });
      });
    });

    return items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [users, competitions, freelancerLabel]);

  const filtered = useMemo(() => {
    if (filter === 'all') return feed;
    if (filter === 'photos') return feed.filter((i) => i.kind === 'photo');
    if (filter === 'videos') return feed.filter((i) => i.kind === 'video');
    return feed.filter((i) => i.kind === 'post');
  }, [feed, filter]);

  const counts = useMemo(
    () => ({
      all: feed.length,
      photos: feed.filter((i) => i.kind === 'photo').length,
      videos: feed.filter((i) => i.kind === 'video').length,
      posts: feed.filter((i) => i.kind === 'post').length,
    }),
    [feed]
  );

  const publish = useCallback(() => {
    if (!currentUser || !isPlayer) return;
    const value = text.trim();
    if (!value) return;
    updateUser(
      {
        ...currentUser,
        posts: [
          {
            id: createId(),
            text: value,
            timestamp: new Date(),
            likes: [],
          },
          ...currentUser.posts,
        ],
      },
      t('sharesUi.publishPost')
    );
    setText('');
    setComposerOpen(false);
  }, [currentUser, isPlayer, text, updateUser, t]);

  const fullScreenData = useMemo<FullScreenContent[]>(
    () =>
      filtered.map((item) => ({
        id: item.id,
        kind:
          item.kind === 'photo' || item.kind === 'video'
            ? item.kind
            : 'text',
        mediaUrl: item.mediaUrl,
        text: item.text,
        authorId: item.authorId,
        authorName: item.authorName,
        authorAvatar: item.authorAvatar,
        subtitle: `${
          item.kind === 'photo'
            ? t('common.photo')
            : item.kind === 'video'
              ? t('common.video')
              : t('sharesUi.textShare')
        }${item.teamName ? ` · ${item.teamName}` : ''}`,
        likes: item.likes,
        liked: !!currentUser && item.likes.includes(currentUser.id),
        locationLabel: resolveLocationLabel({
          city: item.locationCity,
          region: item.locationRegion,
        }),
      })),
    [filtered, currentUser, t]
  );

  const onFullLike = useCallback(
    (item: FullScreenContent) => {
      const source = filtered.find((f) => f.id === item.id);
      if (!source) return;
      if (source.kind === 'post') {
        togglePostLike(source.authorId, source.mediaId);
      } else {
        toggleMediaLike(
          source.authorId,
          source.mediaId,
          source.kind,
          source.source
        );
      }
    },
    [filtered, togglePostLike, toggleMediaLike]
  );

  const activeRole = currentUser?.activeRole || currentUser?.role;

  const onPressAuthor = useCallback(
    (item: FullScreenContent) => {
      if (activeRole !== 'follower') return;
      const source = filtered.find((f) => f.id === item.id);
      if (!source) return;
      router.push(`/(follower)/players/${source.authorId}` as any);
    },
    [activeRole, filtered, router]
  );

  const renderItem = useCallback(
    ({ item }: { item: ShareItem }) => {
      const liked = !!currentUser && item.likes.includes(currentUser.id);
      const onLike = () => {
        if (item.kind === 'post') {
          togglePostLike(item.authorId, item.mediaId);
        } else {
          toggleMediaLike(
            item.authorId,
            item.mediaId,
            item.kind,
            item.source
          );
        }
      };
      return (
        <ShareCard
          item={item}
          liked={liked}
          onLike={onLike}
          onOpenPlayer={
            activeRole === 'follower'
              ? () => router.push(`/(follower)/players/${item.authorId}` as any)
              : undefined
          }
          onShare={() =>
            setSharePayload({
              kind: 'content',
              title: item.authorName,
              body: item.text,
              mediaUrl: item.mediaUrl,
              mediaKind:
                item.kind === 'photo'
                  ? 'photo'
                  : item.kind === 'video'
                    ? 'video'
                    : 'text',
            })
          }
        />
      );
    },
    [activeRole, currentUser, router, togglePostLike, toggleMediaLike]
  );

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;

  const filterChips = (
    <View style={styles.filters}>
      {(
        [
          {
            key: 'all' as const,
            icon: 'grid-outline' as const,
            label: `${t('screens.all')} (${counts.all})`,
          },
          {
            key: 'photos' as const,
            icon: 'image-outline' as const,
            label: `${t('screens.photos')} (${counts.photos})`,
          },
          {
            key: 'videos' as const,
            icon: 'videocam-outline' as const,
            label: `${t('screens.videos')} (${counts.videos})`,
          },
          {
            key: 'posts' as const,
            icon: 'document-text-outline' as const,
            label: `${t('sharesUi.texts')} (${counts.posts})`,
          },
        ] as const
      ).map((f) => {
        const active = filter === f.key;
        return (
          <Pressable
            key={f.key}
            accessibilityRole="button"
            accessibilityLabel={f.label}
            onPress={() => setFilter(f.key)}
            hitSlop={4}
            style={[
              styles.filterIconBtn,
              {
                backgroundColor: active
                  ? theme.colors.accent
                  : theme.colors.surfaceElevated,
                borderColor: active
                  ? theme.colors.accent
                  : theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name={f.icon}
              size={14}
              color={active ? theme.colors.textInverse : theme.colors.textMuted}
            />
            <Text
              style={{
                color: active ? theme.colors.textInverse : theme.colors.textMuted,
                fontSize: 11,
                fontWeight: '700',
              }}
              numberOfLines={1}
            >
              {f.key === 'all'
                ? t('screens.all')
                : f.key === 'photos'
                  ? t('screens.photos')
                  : f.key === 'videos'
                    ? t('screens.videos')
                    : t('sharesUi.texts')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const header = (
    <View style={styles.header}>
      <Muted>
        {t('sharesUi.subtitleBase')}{' '}
        {isPlayer ? t('sharesUi.subtitleManage') : t('sharesUi.subtitleView')}
      </Muted>

      {isPlayer ? (
        <>
          <Card style={styles.composer}>
            <Subtitle>{t('sharesUi.newPost')}</Subtitle>
            <Input
              label={t('sharesUi.postLabel')}
              value={text}
              onChangeText={setText}
              placeholder={t('sharesUi.postPlaceholder')}
              multiline
            />
            <Button
              label={t('sharesUi.publishPost')}
              onPress={publish}
              disabled={!text.trim()}
            />
          </Card>

          <Card style={styles.composer}>
            <Subtitle>{t('sharesUi.yourMedia')}</Subtitle>
            <Muted>{t('sharesUi.yourMediaHint')}</Muted>
            <PlayerMediaSection
              photos={currentUser.media?.photos || []}
              videos={currentUser.media?.videos || []}
              editable
              currentUserId={currentUser.id}
              onAddPhoto={(url) =>
                addUserMedia('photos', url, t('common.photoAdded'))
              }
              onAddVideo={(url) =>
                addUserMedia('videos', url, t('common.videoAdded'))
              }
              onRemovePhoto={(id) =>
                removeUserMedia('photos', id, t('toasts.t014_3569a8'))
              }
              onRemoveVideo={(id) =>
                removeUserMedia('videos', id, t('toasts.t014_3569a8'))
              }
              onSetAvatar={(url) => setUserAvatar(url)}
              onTogglePhotoLike={(id) =>
                toggleMediaLike(currentUser.id, id, 'photo', 'user')
              }
              onToggleVideoLike={(id) =>
                toggleMediaLike(currentUser.id, id, 'video', 'user')
              }
            />
          </Card>
        </>
      ) : null}
    </View>
  );

  if (!tablet) {
    return (
      <Screen bleed edges={['left', 'right']}>
        <FullScreenFeed
          data={fullScreenData}
          onLike={onFullLike}
          onPressAuthor={
            activeRole === 'follower' ? onPressAuthor : undefined
          }
          onDoubleTap={(item) => void saveToPrivate(item)}
          emptyTitle={t('sharesUi.emptyTitle')}
          emptyDescription={t('sharesUi.emptyDesc')}
          emptyIcon="share-social-outline"
          topOverlaySafeArea
          topOverlay={
            <View style={styles.mobileOverlay} pointerEvents="box-none">
              <View style={styles.topTools}>
                <HeaderBackButton />
                {filterChips}
              </View>
              {isPlayer ? (
                <Button
                  label={t('sharesUi.subtitleManage')}
                  variant="secondary"
                  onPress={() => setComposerOpen(true)}
                />
              ) : null}
            </View>
          }
        />

        <Modal
          visible={composerOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setComposerOpen(false)}
        >
          <Screen scroll keyboard contentStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Subtitle>{t('sharesUi.publishPost')}</Subtitle>
              <Button
                label={t('menu.closeMenu')}
                variant="ghost"
                onPress={() => setComposerOpen(false)}
              />
            </View>
            <Card style={styles.composer}>
              <Input
                label={t('sharesUi.postLabel')}
                value={text}
                onChangeText={setText}
                placeholder={t('sharesUi.postPlaceholder')}
                multiline
              />
              <Button
                label={t('sharesUi.publishPost')}
                onPress={publish}
                disabled={!text.trim()}
              />
            </Card>
            <Card style={styles.composer}>
              <Subtitle>{t('sharesUi.yourMedia')}</Subtitle>
              <PlayerMediaSection
                photos={currentUser.media?.photos || []}
                videos={currentUser.media?.videos || []}
                editable
                currentUserId={currentUser.id}
                onAddPhoto={(url) =>
                  addUserMedia('photos', url, t('common.photoAdded'))
                }
                onAddVideo={(url) =>
                  addUserMedia('videos', url, t('common.videoAdded'))
                }
                onRemovePhoto={(id) =>
                  removeUserMedia('photos', id, t('toasts.t014_3569a8'))
                }
                onRemoveVideo={(id) =>
                  removeUserMedia('videos', id, t('toasts.t014_3569a8'))
                }
                onSetAvatar={(url) => setUserAvatar(url)}
                onTogglePhotoLike={(id) =>
                  toggleMediaLike(currentUser.id, id, 'photo', 'user')
                }
                onToggleVideoLike={(id) =>
                  toggleMediaLike(currentUser.id, id, 'video', 'user')
                }
              />
            </Card>
          </Screen>
        </Modal>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StackTopChrome>{filterChips}</StackTopChrome>
      <Screen>
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item) => item.id}
          {...listChrome}
          contentContainerStyle={[
            styles.list,
            listChrome.contentContainerStyle,
            { paddingTop: topPad },
          ]}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              title={t('sharesUi.emptyTitle')}
              description={t('sharesUi.emptyDesc')}
              icon="share-social-outline"
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          renderItem={renderItem}
        />
      </Screen>
      <ShareTargetModal
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 12, gap: 10, paddingBottom: 120, flexGrow: 1 },
  header: { gap: 12, marginBottom: 8 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 6,

  },
  filterIconBtn: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mobileOverlay: {
    paddingHorizontal: 12,
    gap: 8,
  },
  topTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,

  },
  modalContent: { paddingTop: 12, gap: 12, paddingBottom: 40 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composer: { gap: 10 },
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { fontWeight: '800' },
  body: {
    lineHeight: 22,
  },
  mediaWrap: { position: 'relative' },
  media: { width: '100%', height: 220, borderRadius: 14 },
  mediaShare: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  videoBox: {
    height: 160,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  kindBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
