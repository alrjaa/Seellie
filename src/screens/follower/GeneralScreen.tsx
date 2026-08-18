import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { useSaveToPrivateSpace } from '@/hooks/useSaveToPrivateSpace';
import { resolveLocationLabel } from '@/utils/location-label';
import { useEffectiveNativeAds } from '@/hooks/useEffectiveNativeAds';
import { useAdPreferences } from '@/hooks/useAdPreferences';
import {
  injectNativeAds,
  type NativeAdFeedItem,
} from '@/services/native-ads';

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
  /** صورة غلاف/تحليل بدون فيديو */
  posterUrl?: string;
  /** نوع الوسائط لتحليلات الفريد التي تحمل فيديو أو صورة */
  mediaKind?: 'photo' | 'video';
  mediaId?: string;
  /** معرف المالك لـ toggleMediaLike / addMediaComment (مسابقة/مباراة/لاعب/مستخدم) */
  mediaOwnerId?: string;
  likes: string[];
  comments?: {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    timestamp: Date | string | number;
  }[];
  timestamp: Date;
  mediaSource?: 'user' | 'player' | 'match' | 'competition';
  subtitle?: string;
  locationCity?: string;
  locationRegion?: string;
  sponsored?: boolean;
  hookText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
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
          {item.sponsored
            ? t('ui.sponsoredBadge')
            : t(TYPE_LABEL_KEYS[item.type])}
          {item.subtitle ? ` · ${item.subtitle}` : ''}
          {item.sponsored ? '' : ` · ${formatArabicDate(item.timestamp)}`}
        </Muted>

        {item.sponsored && item.hookText ? (
          <Text style={[styles.title, textDir, { color: theme.colors.text }]}>
            {item.hookText}
          </Text>
        ) : null}

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
          <InlineVideoPlayer uri={item.mediaUrl} autoPlayMuted />
        ) : null}

        {item.type === 'analysis' && item.mediaKind === 'video' && item.mediaUrl ? (
          <InlineVideoPlayer uri={item.mediaUrl} autoPlayMuted />
        ) : null}

        {item.type === 'analysis' &&
        item.mediaKind === 'photo' &&
        (item.mediaUrl || item.posterUrl) ? (
          <Pressable onPress={onOpenMedia}>
            <Image
              source={{ uri: item.mediaUrl || item.posterUrl }}
              style={styles.media}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        ) : null}

        {item.sponsored ? (
          item.ctaUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                item.ctaLabel?.trim() || t('ui.adCtaDefault')
              }
              onPress={() => {
                const url = item.ctaUrl?.trim() || '';
                if (url.startsWith('https://')) void Linking.openURL(url);
              }}
              style={({ pressed }) => [
                styles.adCtaChip,
                {
                  backgroundColor: theme.colors.accent,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.adCtaChipText,
                  textDir,
                  { color: theme.colors.textInverse },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.ctaLabel?.trim() || t('ui.adCtaDefault')}
              </Text>
            </Pressable>
          ) : null
        ) : (
          <LikeButton
            count={(item.likes || []).length}
            liked={liked}
            onPress={onLike}
          />
        )}
      </Card>
    </Pressable>
  );
});

export default function GeneralFeedScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { tablet } = useResponsive();
  const listChrome = useListChrome({ enabled: tablet });
  const saveToPrivate = useSaveToPrivateSpace();
  const nativeAds = useEffectiveNativeAds();
  const { hideAd, reportAd } = useAdPreferences();
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
    addMediaComment,
    addComment,
    syncCloudUsers,
  } = useTournament();

  const [filter, setFilter] = useState<FeedFilter>('all');
  const [discussionText, setDiscussionText] = useState('');
  /** حقل «شارك رأيك» لا يُركَّب في الشاشة إلا داخل النافذة بعد زر نقاشات سريعة */
  const [discussionModalOpen, setDiscussionModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void syncCloudUsers();
    }, [syncCloudUsers])
  );

  const closeDiscussionModal = useCallback(() => {
    setDiscussionModalOpen(false);
    setDiscussionText('');
  }, []);

  const publishDiscussion = useCallback(async () => {
    const value = discussionText.trim();
    if (!value) return;
    const ok = await addComment(value, undefined, { type: 'general' });
    if (!ok) return;
    setDiscussionText('');
    setFilter('discussions');
    setDiscussionModalOpen(false);
  }, [addComment, discussionText]);

  const isHttpUrl = useCallback((url?: string) => {
    return !!url && /^https?:\/\//i.test(url.trim());
  }, []);

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
            locationCity: user.city,
            locationRegion: user.region,
          });
        });

        (user.media?.photos || []).forEach((photo) => {
          if (!isHttpUrl(photo.url)) return;
          items.push({
            id: `photo-user-${photo.id}`,
            type: 'photo',
            authorId: user.id,
            authorName: user.name,
            authorHandle: user.handle,
            authorAvatar: user.avatar,
            mediaUrl: photo.url,
            mediaId: photo.id,
            mediaOwnerId: user.id,
            likes: photo.likes,
            comments: photo.comments || [],
            timestamp: new Date(photo.timestamp || Date.now()),
            mediaSource: 'user',
            subtitle: t('home.freelancerPlayer'),
            locationCity: user.city,
            locationRegion: user.region,
          });
        });

        (user.media?.videos || []).forEach((video) => {
          if (!isHttpUrl(video.url)) return;
          items.push({
            id: `video-user-${video.id}`,
            type: 'video',
            authorId: user.id,
            authorName: user.name,
            authorHandle: user.handle,
            authorAvatar: user.avatar,
            mediaUrl: video.url,
            mediaId: video.id,
            mediaOwnerId: user.id,
            likes: video.likes,
            comments: video.comments || [],
            timestamp: new Date(video.timestamp || Date.now()),
            mediaSource: 'user',
            subtitle: t('home.freelancerPlayer'),
            locationCity: user.city,
            locationRegion: user.region,
          });
        });
      }

      user.analysisContent.forEach((a) => {
        if (a.status === 'blocked' || a.status === 'suspended') return;
        const videoUrl =
          a.videoUrl && isHttpUrl(a.videoUrl) ? a.videoUrl.trim() : undefined;
        const posterUrl =
          a.posterUrl && isHttpUrl(a.posterUrl) ? a.posterUrl.trim() : undefined;
        const mediaKind = videoUrl ? 'video' : posterUrl ? 'photo' : undefined;
        const rawText = (a.content || '').trim();
        const text =
          rawText &&
          rawText !== 'تحليل مرئي' &&
          rawText !== 'Visual analysis'
            ? rawText
            : undefined;
        items.push({
          id: `analysis-${a.id}`,
          type: 'analysis',
          authorId: user.id,
          authorName: user.name,
          authorHandle: user.handle,
          authorAvatar: user.avatar,
          title: a.title,
          text,
          mediaUrl: videoUrl || posterUrl,
          posterUrl,
          mediaKind,
          likes: a.likes,
          comments: a.comments || [],
          timestamp: new Date(a.timestamp),
          subtitle: t('screens.typeAnalysis'),
          locationCity: user.city,
          locationRegion: user.region,
        });
      });
    });

    competitions.forEach((comp) => {
      const organizer = users.find((u) => u.id === comp.organizerId);
      const uploaderId = comp.organizerId;
      const uploaderName = organizer?.name || comp.name;
      const uploaderHandle = organizer?.handle;
      const uploaderAvatar = organizer?.avatar || comp.logo;
      const locationCity = comp.venue?.city;
      const locationRegion = comp.venue?.region;

      (comp.media?.photos || []).forEach((photo) => {
        if (!isHttpUrl(photo.url)) return;
        items.push({
          id: `photo-comp-${photo.id}`,
          type: 'photo',
          authorId: uploaderId,
          authorName: uploaderName,
          authorHandle: uploaderHandle,
          authorAvatar: uploaderAvatar,
          mediaUrl: photo.url,
          mediaId: photo.id,
          mediaOwnerId: comp.id,
          likes: photo.likes,
          comments: photo.comments || [],
          timestamp: new Date(photo.timestamp || Date.now()),
          mediaSource: 'competition',
          subtitle: t('screens.competitionMedia'),
          locationCity,
          locationRegion,
        });
      });
      (comp.media?.videos || []).forEach((video) => {
        if (!isHttpUrl(video.url)) return;
        items.push({
          id: `video-comp-${video.id}`,
          type: 'video',
          authorId: uploaderId,
          authorName: uploaderName,
          authorHandle: uploaderHandle,
          authorAvatar: uploaderAvatar,
          mediaUrl: video.url,
          mediaId: video.id,
          mediaOwnerId: comp.id,
          likes: video.likes,
          comments: video.comments || [],
          timestamp: new Date(video.timestamp || Date.now()),
          mediaSource: 'competition',
          subtitle: t('screens.competitionMedia'),
          locationCity,
          locationRegion,
        });
      });

      comp.teams.forEach((team) => {
        team.players.forEach((player) => {
          (player.media?.photos || []).forEach((photo) => {
            if (!isHttpUrl(photo.url)) return;
            items.push({
              id: `photo-player-${player.id}-${photo.id}`,
              type: 'photo',
              authorId: player.id,
              authorName: player.name || uploaderName,
              authorHandle: uploaderHandle,
              authorAvatar: player.avatar || uploaderAvatar,
              mediaUrl: photo.url,
              mediaId: photo.id,
              mediaOwnerId: player.id,
              likes: photo.likes,
              comments: photo.comments || [],
              timestamp: new Date(photo.timestamp || Date.now()),
              mediaSource: 'player',
              subtitle: `${team.name} · ${player.name}`,
              locationCity,
              locationRegion,
            });
          });
          (player.media?.videos || []).forEach((video) => {
            if (!isHttpUrl(video.url)) return;
            items.push({
              id: `video-player-${player.id}-${video.id}`,
              type: 'video',
              authorId: player.id,
              authorName: player.name || uploaderName,
              authorHandle: uploaderHandle,
              authorAvatar: player.avatar || uploaderAvatar,
              mediaUrl: video.url,
              mediaId: video.id,
              mediaOwnerId: player.id,
              likes: video.likes,
              comments: video.comments || [],
              timestamp: new Date(video.timestamp || Date.now()),
              mediaSource: 'player',
              subtitle: `${team.name} · ${player.name}`,
              locationCity,
              locationRegion,
            });
          });
        });
      });

      comp.matches.forEach((match) => {
        const t1 = comp.teams.find((x) => x.id === match.team1Id)?.name || '?';
        const t2 = comp.teams.find((x) => x.id === match.team2Id)?.name || '?';
        const label = `${t1} ${t('screens.vs')} ${t2}`;
        (match.media?.photos || []).forEach((photo) => {
          if (!isHttpUrl(photo.url)) return;
          items.push({
            id: `photo-match-${photo.id}`,
            type: 'photo',
            authorId: uploaderId,
            authorName: uploaderName,
            authorHandle: uploaderHandle,
            authorAvatar: uploaderAvatar,
            mediaUrl: photo.url,
            mediaId: photo.id,
            mediaOwnerId: match.id,
            likes: photo.likes,
            comments: photo.comments || [],
            timestamp: new Date(photo.timestamp || match.date),
            mediaSource: 'match',
            subtitle: `${comp.name} · ${label}`,
            locationCity,
            locationRegion,
          });
        });
        (match.media?.videos || []).forEach((video) => {
          if (!isHttpUrl(video.url)) return;
          items.push({
            id: `video-match-${video.id}`,
            type: 'video',
            authorId: uploaderId,
            authorName: uploaderName,
            authorHandle: uploaderHandle,
            authorAvatar: uploaderAvatar,
            mediaUrl: video.url,
            mediaId: video.id,
            mediaOwnerId: match.id,
            likes: video.likes,
            comments: video.comments || [],
            timestamp: new Date(video.timestamp || match.date),
            mediaSource: 'match',
            subtitle: `${comp.name} · ${label}`,
            locationCity,
            locationRegion,
          });
        });
      });
    });

    comments.forEach((c) => {
      if (c.status === 'blocked' || c.status === 'suspended') return;
      const author = users.find((u) => u.id === c.authorId);
      const forumVideo =
        c.videoUrl && isHttpUrl(c.videoUrl) ? c.videoUrl.trim() : undefined;
      // فيديو الساحة يظهر في «عام» كوسائط (وليس نص نقاش فقط)
      if (forumVideo) {
        items.push({
          id: `forum-video-${c.id}`,
          type: 'video',
          authorId: c.authorId,
          authorName: c.authorName,
          authorHandle: author?.handle,
          authorAvatar: c.authorAvatar,
          text: c.text,
          mediaUrl: forumVideo,
          likes: c.likes,
          timestamp: new Date(c.timestamp),
          subtitle: t('screens.publicForum'),
          locationCity: author?.city,
          locationRegion: author?.region,
        });
        return;
      }
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
        locationCity: author?.city,
        locationRegion: author?.region,
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
        locationCity: author?.city,
        locationRegion: author?.region,
      });
    });

    return items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [users, competitions, comments, quickComments, t, isHttpUrl]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'media':
        return feed.filter(
          (i) =>
            i.type === 'photo' ||
            i.type === 'video' ||
            (i.type === 'analysis' && !!i.mediaUrl)
        );
      case 'discussions':
        return feed.filter(
          (i) =>
            i.type === 'discussion' || i.id.startsWith('forum-video-')
        );
      case 'posts':
        return feed.filter((i) => i.type === 'post' || i.type === 'analysis');
      default:
        return feed;
    }
  }, [feed, filter]);

  const counts = useMemo(
    () => ({
      all: feed.length,
      media: feed.filter(
        (i) =>
          i.type === 'photo' ||
          i.type === 'video' ||
          (i.type === 'analysis' && !!i.mediaUrl)
      ).length,
      discussions: feed.filter(
        (i) => i.type === 'discussion' || i.id.startsWith('forum-video-')
      ).length,
      posts: feed.filter((i) => i.type === 'post' || i.type === 'analysis')
        .length,
    }),
    [feed]
  );

  const onLike = useCallback(
    (item: FeedItem) => {
      if (!currentUser) return;
      if (item.sponsored) return;
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
      // فيديوهات الساحة في الخلاصة العامة
      if (item.type === 'video' && item.id.startsWith('forum-video-')) {
        toggleCommentLike(item.id.replace(/^forum-video-/, ''));
        return;
      }
      if (item.type === 'photo' || item.type === 'video') {
        if (!item.mediaId) return;
        toggleMediaLike(
          item.mediaOwnerId || item.authorId,
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
      const liked = currentUser
        ? (item.likes || []).includes(currentUser.id)
        : false;
      return (
        <FeedCard
          item={item}
          liked={liked}
          onLike={item.sponsored ? undefined : () => onLike(item)}
          onPressHandle={
            item.sponsored
              ? undefined
              : item.authorHandle
                ? () => openHandleProfile(item.authorId, item.authorHandle)
                : undefined
          }
          onOpenMedia={undefined}
        />
      );
    },
    [currentUser, onLike, openHandleProfile]
  );

  const visibleFeed = useMemo<FeedItem[]>(() => {
    return injectNativeAds(filtered, nativeAds, 'general').map((item) => {
      if ((item as NativeAdFeedItem).sponsored) {
        const ad = item as NativeAdFeedItem;
        return {
          id: ad.id,
          type: 'video' as const,
          authorId: ad.authorId,
          authorName: ad.authorName,
          authorHandle: ad.authorHandle,
          authorAvatar: ad.authorAvatar,
          title: ad.title,
          text: ad.text,
          mediaUrl: ad.mediaUrl,
          posterUrl: ad.posterUrl,
          likes: [],
          timestamp: new Date(0),
          sponsored: true,
          hookText: ad.hookText,
          ctaLabel: ad.ctaLabel,
          ctaUrl: ad.ctaUrl,
        };
      }
      return item as FeedItem;
    });
  }, [filtered, nativeAds]);

  const fullScreenData = useMemo<FullScreenContent[]>(
    () =>
      visibleFeed.map((item) => {
        if (item.sponsored) {
          return {
            id: item.id,
            kind: 'video' as const,
            mediaUrl: item.mediaUrl,
            posterUrl: item.posterUrl,
            title: item.title || item.hookText,
            text: item.text,
            authorId: item.authorId,
            authorName: item.authorName,
            authorHandle: item.authorHandle,
            authorAvatar: item.authorAvatar,
            likes: [],
            liked: false,
            sponsored: true,
            hookText: item.hookText,
            ctaLabel: item.ctaLabel,
            ctaUrl: item.ctaUrl,
          };
        }
        const kind =
          item.type === 'photo' || item.type === 'video'
            ? item.type
            : item.type === 'analysis' && item.mediaKind
              ? item.mediaKind
              : 'text';
        return {
          id: item.id,
          kind,
          mediaUrl: item.mediaUrl,
          posterUrl: item.posterUrl,
          title: item.title,
          text: item.text,
          authorId: item.authorId,
          authorName: item.authorHandle || item.authorName || '',
          authorHandle: item.authorHandle,
          authorAvatar: item.authorAvatar,
          subtitle: undefined,
          likes: item.likes || [],
          liked: !!currentUser && (item.likes || []).includes(currentUser.id),
          locationLabel: resolveLocationLabel({
            city: item.locationCity,
            region: item.locationRegion,
          }),
          comments: (item.comments || []).map((c) => ({
            id: c.id,
            text: c.text,
            authorId: c.authorId,
            authorName: c.authorName,
            authorAvatar: c.authorAvatar,
            timestamp: c.timestamp,
          })),
        };
      }),
    [visibleFeed, currentUser]
  );

  const onFullLike = useCallback(
    (item: FullScreenContent) => {
      if (item.sponsored) return;
      const source = visibleFeed.find((f) => f.id === item.id && !f.sponsored);
      if (source) onLike(source);
    },
    [visibleFeed, onLike]
  );

  const onFullComment = useCallback(
    (item: FullScreenContent, text: string) => {
      if (item.sponsored) return null;
      const source = visibleFeed.find((f) => f.id === item.id && !f.sponsored);
      if (!source) return null;
      if (source.type === 'photo' || source.type === 'video') {
        if (source.id.startsWith('forum-video-')) return null;
        if (!source.mediaId) return null;
        const created = addMediaComment(
          source.mediaOwnerId || source.authorId,
          source.mediaId,
          source.type,
          text,
          source.mediaSource || 'user'
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
      }
      // منشورات/تحليلات/نقاشات: التخزين المحلي عبر FullScreenFeed يكفي للعرض
      return null;
    },
    [visibleFeed, addMediaComment]
  );

  const onPressAuthor = useCallback(
    (item: FullScreenContent) => {
      if (item.sponsored) return;
      const source = visibleFeed.find((f) => f.id === item.id && !f.sponsored);
      if (!source?.authorHandle) return;
      openHandleProfile(source.authorId, source.authorHandle);
    },
    [visibleFeed, openHandleProfile]
  );

  const mobileTopBar = (
    <View style={styles.topBar}>
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
              styles.mobileFilterBtn,
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
              size={16}
              color={active ? theme.colors.textInverse : '#fff'}
            />
          </Pressable>
        );
      })}
      {currentUser ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('screens.quickDiscuss')}
          onPress={() => setDiscussionModalOpen(true)}
          style={[
            styles.mobileFilterBtn,
            {
              backgroundColor: 'rgba(37, 244, 238, 0.22)',
              borderColor: theme.colors.accent,
            },
          ]}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={theme.colors.accent}
          />
        </Pressable>
      ) : null}
    </View>
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
            onPress={() => setDiscussionModalOpen(true)}
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
        </View>
      ) : null}
    </View>
  );

  const discussionModal = (
    <Modal
      visible={discussionModalOpen}
      transparent
      animationType="fade"
      onRequestClose={closeDiscussionModal}
    >
      <Pressable style={styles.modalBackdrop} onPress={closeDiscussionModal}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {t('screens.quickDiscuss')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={closeDiscussionModal}
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </View>
          <Muted>{t('screens.discussHint')}</Muted>
          <Input
            label={t('screens.discussLabel')}
            value={discussionText}
            onChangeText={setDiscussionText}
            placeholder={t('screens.shareOpinion')}
            multiline
          />
          <View style={styles.composerActions}>
            <Button
              label={t('screens.publishForum')}
              onPress={publishDiscussion}
              style={{ flex: 1 }}
            />
            <Button
              label={t('screens.openForums')}
              variant="outline"
              onPress={() => {
                closeDiscussionModal();
                router.push('/forums');
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  const emptyTitle = t('screens.generalEmpty');
  const emptyDescription =
    filter !== 'all' && feed.length > 0
      ? t('screens.generalEmptyOtherTab')
      : t('screens.generalEmptyDesc');

  if (!tablet) {
    return (
      <Screen bleed edges={['left', 'right']}>
        <FullScreenFeed
          data={fullScreenData}
          onLike={onFullLike}
          onComment={onFullComment}
          onPressAuthor={onPressAuthor}
          onDoubleTap={(item) => void saveToPrivate(item)}
          authorPresentation="handleOnly"
          adPlacement="general"
          sponsoredActions={{
            onHide: (adId) => {
              void hideAd(adId, 'general');
            },
            onReport: (adId, reason) => {
              void reportAd(adId, reason, 'general');
            },
          }}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyIcon="newspaper-outline"
          topOverlay={
            <View style={styles.mobileOverlay} pointerEvents="box-none">
              {mobileTopBar}
            </View>
          }
        />
        {discussionModal}
      </Screen>
    );
  }

  return (
    <Screen>
      {discussionModal}
      <FlatList
        style={styles.listFlex}
        data={visibleFeed}
        keyExtractor={(item) => item.id}
        {...listChrome}
        contentContainerStyle={[styles.list, listChrome.contentContainerStyle]}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
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
    paddingHorizontal: 10,
  },
  topBar: {
    minHeight: 36,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  mobileFilterBtn: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersWrap: {
    flex: 1,
    minWidth: 0,
  },
  mobileComposer: {
    gap: 6,
    alignItems: 'flex-end',
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
  composerActions: { flexDirection: 'row', gap: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    fontWeight: '800',
    fontSize: 16,
    flex: 1,
  },
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
  adCtaChip: {
    alignSelf: 'flex-start',
    minHeight: 28,
    maxWidth: 140,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adCtaChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
