import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  ScrollView,
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
  Button,
  Card,
  Input,
  LikeButton,
  Muted,
} from '@/components/ui';
import { useResponsive } from '@/hooks/useResponsive';
import { useListChrome } from '@/hooks/useListChrome';
import { formatArabicDate } from '@/utils';
import { userHasRole } from '@/utils/roles';
import { AccountHeaderButton } from '@/components/layout/AccountHeaderButton';
import { useSaveToPrivateSpace } from '@/hooks/useSaveToPrivateSpace';

type FeedFilter = 'all' | 'media' | 'discussions' | 'posts';

type FeedItem = {
  id: string;
  type: 'post' | 'analysis' | 'photo' | 'video' | 'discussion';
  authorId: string;
  authorName: string;
  authorHandle?: string;
  authorAvatar?: string;
  title?: string;
  text?: string;
  mediaUrl?: string;
  mediaId?: string;
  likes: string[];
  timestamp: Date;
  mediaSource?: 'user' | 'player' | 'match' | 'competition';
  subtitle?: string;
};

const FILTERS: {
  key: FeedFilter;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'all', labelKey: 'screens.all', icon: 'apps-outline', iconActive: 'apps' },
  {
    key: 'media',
    labelKey: 'screens.photosVideos',
    icon: 'images-outline',
    iconActive: 'images',
  },
  {
    key: 'discussions',
    labelKey: 'screens.forums',
    icon: 'chatbubbles-outline',
    iconActive: 'chatbubbles',
  },
  {
    key: 'posts',
    labelKey: 'screens.posts',
    icon: 'newspaper-outline',
    iconActive: 'newspaper',
  },
];

const TYPE_LABEL_KEYS: Record<FeedItem['type'], string> = {
  post: 'screens.typePost',
  analysis: 'screens.typeAnalysis',
  photo: 'common.photo',
  video: 'common.video',
  discussion: 'screens.typeDiscussion',
};

const FeedCard = memo(function FeedCard({
  item,
  liked,
  onLike,
  onPress,
  onOpenMedia,
  onPressHandle,
}: {
  item: FeedItem;
  liked: boolean;
  onLike?: () => void;
  onPress?: () => void;
  onOpenMedia?: () => void;
  onPressHandle?: () => void;
}) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const handleLabel = item.authorHandle;
  // textAlign:'left' هنا = بداية السطر؛ الـ shim يحوّله فيزيائياً حسب اللغة
  const textDir = {
    width: '100%' as const,
    textAlign: 'left' as const,
    writingDirection: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
  };

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={styles.card}>
        {handleLabel ? (
          <Pressable
            onPress={onPressHandle}
            disabled={!onPressHandle}
            style={styles.handleRow}
            accessibilityRole="button"
            accessibilityLabel={t('screens.openHandle', { handle: handleLabel })}
          >
            <Text style={[styles.handle, textDir, { color: theme.colors.accent }]}>
              {handleLabel}
            </Text>
          </Pressable>
        ) : null}

        <Muted style={textDir}>
          {t(TYPE_LABEL_KEYS[item.type])}
          {item.subtitle ? ` · ${item.subtitle}` : ''}
          {' · '}
          {formatArabicDate(item.timestamp)}
        </Muted>

        {item.title ? (
          <Text style={[styles.title, textDir, { color: theme.colors.text }]}>
            {item.title}
          </Text>
        ) : null}

        {item.text ? (
          <Text style={[styles.body, textDir, { color: theme.colors.text }]}>
            {item.text}
          </Text>
        ) : null}

        {item.type === 'photo' && item.mediaUrl ? (
          <Pressable onPress={onOpenMedia}>
            <Image
              source={{ uri: item.mediaUrl }}
              style={styles.media}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        ) : null}

        {item.type === 'video' && item.mediaUrl ? (
          <InlineVideoPlayer uri={item.mediaUrl} />
        ) : null}

        <LikeButton
          count={item.likes.length}
          liked={liked}
          onPress={onLike}
        />
      </Card>
    </Pressable>
  );
});

export default function GeneralFeedScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { tablet } = useResponsive();
  const listChrome = useListChrome();
  const saveToPrivate = useSaveToPrivateSpace();
  const {
    users,
    competitions,
    comments,
    quickComments,
    currentUser,
    toggleCommentLike,
    togglePostLike,
    toggleAnalysisLike,
    toggleMediaLike,
    addComment,
  } = useTournament();

  const [filter, setFilter] = useState<FeedFilter>('discussions');
  const [discussionText, setDiscussionText] = useState('');
  const [discussionOpen, setDiscussionOpen] = useState(false);

  const feed = useMemo(() => {
    const items: FeedItem[] = [];

    users.forEach((user) => {
      if (userHasRole(user, 'freelancer')) {
        user.posts.forEach((p) => {
          items.push({
            id: `post-${p.id}`,
            type: 'post',
            authorId: user.id,
            authorName: user.name,
            authorHandle: user.handle,
            authorAvatar: user.avatar,
            text: p.text,
            likes: p.likes,
            timestamp: new Date(p.timestamp),
          });
        });

        (user.media?.photos || []).forEach((photo) => {
          items.push({
            id: `photo-user-${photo.id}`,
            type: 'photo',
            authorId: user.id,
            authorName: user.name,
            authorHandle: user.handle,
            authorAvatar: user.avatar,
            mediaUrl: photo.url,
            mediaId: photo.id,
            likes: photo.likes,
            timestamp: new Date(photo.timestamp || Date.now()),
            mediaSource: 'user',
            subtitle: t('home.freelancerPlayer'),
          });
        });

        (user.media?.videos || []).forEach((video) => {
          items.push({
            id: `video-user-${video.id}`,
            type: 'video',
            authorId: user.id,
            authorName: user.name,
            authorHandle: user.handle,
            authorAvatar: user.avatar,
            mediaUrl: video.url,
            mediaId: video.id,
            likes: video.likes,
            timestamp: new Date(video.timestamp || Date.now()),
            mediaSource: 'user',
            subtitle: t('home.freelancerPlayer'),
          });
        });
      }

      user.analysisContent.forEach((a) => {
        if (a.status === 'blocked' || a.status === 'suspended') return;
        items.push({
          id: `analysis-${a.id}`,
          type: 'analysis',
          authorId: user.id,
          authorName: user.name,
          authorHandle: user.handle,
          authorAvatar: user.avatar,
          title: a.title,
          text: a.content,
          likes: a.likes,
          timestamp: new Date(a.timestamp),
        });
      });
    });

    competitions.forEach((comp) => {
      (comp.media?.photos || []).forEach((photo) => {
        items.push({
          id: `photo-comp-${photo.id}`,
          type: 'photo',
          authorId: comp.id,
          authorName: comp.name,
          authorAvatar: comp.logo,
          mediaUrl: photo.url,
          mediaId: photo.id,
          likes: photo.likes,
          timestamp: new Date(photo.timestamp || Date.now()),
          mediaSource: 'competition',
          subtitle: t('screens.competitionMedia'),
        });
      });
      (comp.media?.videos || []).forEach((video) => {
        items.push({
          id: `video-comp-${video.id}`,
          type: 'video',
          authorId: comp.id,
          authorName: comp.name,
          authorAvatar: comp.logo,
          mediaUrl: video.url,
          mediaId: video.id,
          likes: video.likes,
          timestamp: new Date(video.timestamp || Date.now()),
          mediaSource: 'competition',
          subtitle: t('screens.competitionMedia'),
        });
      });

      comp.teams.forEach((team) => {
        team.players.forEach((player) => {
          (player.media?.photos || []).forEach((photo) => {
            items.push({
              id: `photo-player-${player.id}-${photo.id}`,
              type: 'photo',
              authorId: player.id,
              authorName: player.name,
              authorAvatar: player.avatar,
              mediaUrl: photo.url,
              mediaId: photo.id,
              likes: photo.likes,
              timestamp: new Date(photo.timestamp || Date.now()),
              mediaSource: 'player',
              subtitle: team.name,
            });
          });
          (player.media?.videos || []).forEach((video) => {
            items.push({
              id: `video-player-${player.id}-${video.id}`,
              type: 'video',
              authorId: player.id,
              authorName: player.name,
              authorAvatar: player.avatar,
              mediaUrl: video.url,
              mediaId: video.id,
              likes: video.likes,
              timestamp: new Date(video.timestamp || Date.now()),
              mediaSource: 'player',
              subtitle: team.name,
            });
          });
        });
      });

      comp.matches.forEach((match) => {
        const t1 = comp.teams.find((t) => t.id === match.team1Id)?.name || '?';
        const t2 = comp.teams.find((t) => t.id === match.team2Id)?.name || '?';
        const label = `${t1} ${t('screens.vs')} ${t2}`;
        (match.media?.photos || []).forEach((photo) => {
          items.push({
            id: `photo-match-${photo.id}`,
            type: 'photo',
            authorId: match.id,
            authorName: label,
            authorAvatar: photo.url,
            mediaUrl: photo.url,
            mediaId: photo.id,
            likes: photo.likes,
            timestamp: new Date(photo.timestamp || match.date),
            mediaSource: 'match',
            subtitle: comp.name,
          });
        });
        (match.media?.videos || []).forEach((video) => {
          items.push({
            id: `video-match-${video.id}`,
            type: 'video',
            authorId: match.id,
            authorName: label,
            authorAvatar: comp.logo,
            mediaUrl: video.url,
            mediaId: video.id,
            likes: video.likes,
            timestamp: new Date(video.timestamp || match.date),
            mediaSource: 'match',
            subtitle: comp.name,
          });
        });
      });
    });

    comments.forEach((c) => {
      if (c.status === 'blocked' || c.status === 'suspended') return;
      const author = users.find((u) => u.id === c.authorId);
      items.push({
        id: `discussion-${c.id}`,
        type: 'discussion',
        authorId: c.authorId,
        authorName: c.authorName,
        authorHandle: author?.handle,
        authorAvatar: c.authorAvatar,
        text: c.text,
        likes: c.likes,
        timestamp: new Date(c.timestamp),
        subtitle: t('screens.publicForum'),
      });
    });

    // نقاشات سريعة (أرشيف الدردشة السابق) تظهر مع الساحة
    quickComments.forEach((c) => {
      if (c.status === 'blocked' || c.status === 'suspended') return;
      const author = users.find((u) => u.id === c.authorId);
      items.push({
        id: `discussion-${c.id}`,
        type: 'discussion',
        authorId: c.authorId,
        authorName: c.authorName,
        authorHandle: author?.handle,
        authorAvatar: c.authorAvatar,
        text: c.text,
        likes: c.likes,
        timestamp: new Date(c.timestamp),
        subtitle: t('screens.quickDiscuss'),
      });
    });

    return items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [users, competitions, comments, quickComments, t]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'media':
        return feed.filter((i) => i.type === 'photo' || i.type === 'video');
      case 'discussions':
        return feed.filter((i) => i.type === 'discussion');
      case 'posts':
        return feed.filter((i) => i.type === 'post' || i.type === 'analysis');
      default:
        return feed;
    }
  }, [feed, filter]);

  const counts = useMemo(
    () => ({
      all: feed.length,
      media: feed.filter((i) => i.type === 'photo' || i.type === 'video').length,
      discussions: feed.filter((i) => i.type === 'discussion').length,
      posts: feed.filter((i) => i.type === 'post' || i.type === 'analysis')
        .length,
    }),
    [feed]
  );

  const onLike = useCallback(
    (item: FeedItem) => {
      if (!currentUser) return;
      if (item.type === 'discussion') {
        toggleCommentLike(item.id.replace(/^discussion-/, ''));
        return;
      }
      if (item.type === 'post') {
        togglePostLike(item.authorId, item.id.replace(/^post-/, ''));
        return;
      }
      if (item.type === 'analysis') {
        toggleAnalysisLike(item.authorId, item.id.replace(/^analysis-/, ''));
        return;
      }
      if (item.type === 'photo' || item.type === 'video') {
        if (!item.mediaId) return;
        toggleMediaLike(
          item.authorId,
          item.mediaId,
          item.type,
          item.mediaSource || 'user'
        );
      }
    },
    [
      currentUser,
      toggleCommentLike,
      togglePostLike,
      toggleAnalysisLike,
      toggleMediaLike,
    ]
  );

  const openHandleProfile = useCallback(
    (authorId?: string, authorHandle?: string) => {
      if (!authorId && !authorHandle) return;
      router.push(
        `/(follower)/profile/${authorId || authorHandle}` as any
      );
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      const liked = currentUser ? item.likes.includes(currentUser.id) : false;
      return (
        <FeedCard
          item={item}
          liked={liked}
          onLike={() => onLike(item)}
          onPressHandle={
            item.authorHandle
              ? () => openHandleProfile(item.authorId, item.authorHandle)
              : undefined
          }
          onOpenMedia={
            item.mediaUrl
              ? () => {
                  void Linking.openURL(item.mediaUrl!).catch(() => undefined);
                }
              : undefined
          }
        />
      );
    },
    [currentUser, onLike, openHandleProfile]
  );

  const fullScreenData = useMemo<FullScreenContent[]>(
    () =>
      filtered.map((item) => ({
        id: item.id,
        kind:
          item.type === 'photo' || item.type === 'video'
            ? item.type
            : 'text',
        mediaUrl: item.mediaUrl,
        title: item.title,
        text: item.text,
        authorId: item.authorId,
        authorName: item.authorHandle || item.authorName || '',
        authorHandle: item.authorHandle,
        authorAvatar: undefined,
        subtitle: undefined,
        likes: item.likes,
        liked: !!currentUser && item.likes.includes(currentUser.id),
      })),
    [filtered, currentUser]
  );

  const onFullLike = useCallback(
    (item: FullScreenContent) => {
      const source = filtered.find((f) => f.id === item.id);
      if (source) onLike(source);
    },
    [filtered, onLike]
  );

  const onPressAuthor = useCallback(
    (item: FullScreenContent) => {
      const source = filtered.find((f) => f.id === item.id);
      if (!source?.authorHandle) return;
      openHandleProfile(source.authorId, source.authorHandle);
    },
    [filtered, openHandleProfile]
  );

  const filterBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
    >
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
                  : 'rgba(255,255,255,0.18)',
                borderColor: active
                  ? theme.colors.accent
                  : 'rgba(255,255,255,0.35)',
              },
            ]}
          >
            <Ionicons
              name={active ? f.iconActive : f.icon}
              size={14}
              color={active ? theme.colors.textInverse : '#fff'}
            />
            <Text
              style={{
                color: active ? theme.colors.textInverse : '#fff',
                fontSize: 10,
                fontWeight: '700',
              }}
              numberOfLines={1}
            >
              {t(f.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const header = (
    <View style={styles.header}>
      <Muted>{t('screens.generalSubtitle')}</Muted>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
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
                    : theme.colors.inputBg,
                  borderColor: active
                    ? theme.colors.accent
                    : theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name={active ? f.iconActive : f.icon}
                size={14}
                color={
                  active ? theme.colors.textInverse : theme.colors.textMuted
                }
              />
              <Text
                style={{
                  color: active
                    ? theme.colors.textInverse
                    : theme.colors.textMuted,
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
      </ScrollView>

      {(filter === 'all' || filter === 'discussions') && currentUser ? (
        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('screens.quickDiscuss')}
            onPress={() => setDiscussionOpen((v) => !v)}
            style={[
              styles.quickToggle,
              {
                backgroundColor: theme.colors.accentSoft,
                borderColor: theme.colors.accent,
              },
            ]}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={14}
              color={theme.colors.accent}
            />
            <Text
              style={[styles.quickToggleLabel, { color: theme.colors.accent }]}
            >
              {t('screens.quickDiscuss')}
            </Text>
          </Pressable>
          {discussionOpen ? (
            <Card style={styles.composerBody}>
              <Muted>{t('screens.discussHint')}</Muted>
              <Input
                label={t('screens.discussLabel')}
                value={discussionText}
                onChangeText={setDiscussionText}
                placeholder={t('screens.discussPlaceholder')}
                multiline
              />
              <View style={styles.composerActions}>
                <Button
                  label={t('screens.publishForum')}
                  onPress={() => {
                    const value = discussionText.trim();
                    if (!value) return;
                    addComment(value, undefined, { type: 'general' });
                    setDiscussionText('');
                    setFilter('discussions');
                    setDiscussionOpen(false);
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t('screens.openForums')}
                  variant="outline"
                  onPress={() => router.push('/forums')}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (!tablet) {
    return (
      <Screen bleed edges={['left', 'right']}>
        <FullScreenFeed
          data={fullScreenData}
          onLike={onFullLike}
          onPressAuthor={onPressAuthor}
          onDoubleTap={(item) => void saveToPrivate(item)}
          authorPresentation="handleOnly"
          emptyTitle={t('screens.generalEmpty')}
          emptyDescription={t('screens.generalEmptyDesc')}
          emptyIcon="newspaper-outline"
          topOverlay={
            <View style={styles.mobileOverlay} pointerEvents="box-none">
              <View style={styles.topBar}>
                <View style={styles.filtersWrap}>{filterBar}</View>
                <AccountHeaderButton
                  accountHref="/(follower)/settings/account"
                  settingsHref="/(follower)/settings"
                  compact
                />
              </View>
              {(filter === 'all' || filter === 'discussions') && currentUser ? (
                <View style={styles.mobileComposer}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('screens.quickDiscuss')}
                    onPress={() => setDiscussionOpen((v) => !v)}
                    style={[
                      styles.quickToggle,
                      {
                        backgroundColor: 'rgba(37, 244, 238, 0.22)',
                        borderColor: theme.colors.accent,
                      },
                    ]}
                  >
                    <Ionicons
                      name="chatbubbles-outline"
                      size={14}
                      color={theme.colors.accent}
                    />
                    <Text
                      style={[
                        styles.quickToggleLabel,
                        { color: theme.colors.accent },
                      ]}
                    >
                      {t('screens.quickDiscuss')}
                    </Text>
                  </Pressable>
                  {discussionOpen ? (
                    <View
                      style={[
                        styles.mobileComposerBody,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Input
                        value={discussionText}
                        onChangeText={setDiscussionText}
                        placeholder={t('screens.shareOpinion')}
                        multiline
                      />
                      <Button
                        label={t('screens.publish')}
                        onPress={() => {
                          const value = discussionText.trim();
                          if (!value) return;
                          addComment(value, undefined, { type: 'general' });
                          setDiscussionText('');
                          setFilter('discussions');
                          setDiscussionOpen(false);
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        style={styles.listFlex}
        data={filtered}
        keyExtractor={(item) => item.id}
        {...listChrome}
        contentContainerStyle={[styles.list, listChrome.contentContainerStyle]}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title={t('screens.generalEmpty')}
            description={t('screens.generalEmptyDesc')}
            icon="newspaper-outline"
          />
        }
        initialNumToRender={8}
        windowSize={8}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        nestedScrollEnabled
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listFlex: { flex: 1 },
  list: { paddingTop: 12, gap: 10, paddingBottom: 100, flexGrow: 1 },
  header: { gap: 10, marginBottom: 8 },
  filters: { gap: 5, paddingVertical: 2, paddingHorizontal: 2, alignItems: 'center' },
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
    // LTR ثابت: الفلاتر يسار · المعرّف يمين
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filtersWrap: {
    flex: 1,
    minWidth: 0,
  },
  mobileComposer: {
    gap: 6,
    alignItems: 'flex-end',
  },
  mobileComposerBody: {
    gap: 8,
    width: '100%',
    padding: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickToggle: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickToggleLabel: {
    fontWeight: '700',
    fontSize: 11,
  },
  composer: { gap: 8 },
  composerBody: { gap: 10 },
  composerActions: { flexDirection: 'row', gap: 8 },
  card: { gap: 10 },
  handleRow: {
    width: '100%',
    alignItems: 'flex-end',
  },
  handle: {
    fontWeight: '900',
    fontSize: 13,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { fontWeight: '800' },
  title: { fontWeight: '800', fontSize: 16 },
  body: {
    lineHeight: 22,
  },
  media: {
    width: '100%',
    aspectRatio: 16 / 9,
    minHeight: 280,
    borderRadius: 14,
  },
  typeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
