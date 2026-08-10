import React, {
  createElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import type { AVPlaybackStatus, Video as VideoType } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import {
  Avatar,
  Button,
  Card,
  Input,
  Muted,
  Subtitle,
} from '@/components/ui';
import { useListChrome } from '@/hooks/useListChrome';
import { useResponsive } from '@/hooks/useResponsive';
import { usePrivateSpace } from '@/hooks/usePrivateSpace';
import { ensureSocialLists } from '@/utils/social-stats';
import { formatArabicDate } from '@/utils';
import { tabBarTotalHeight } from '@/theme/navigation';
import type {
  PrivateChatMediaKind,
  PrivateContentItem,
} from '@/services/private-space';
import type { User } from '@/providers/TournamentProvider';
import { isUuid } from '@/services/supabase-messages';
import { setFloatingSuppressed } from '@/services/floating-scroll-bus';

function isHttpUrl(url?: string) {
  return !!url && /^https?:\/\//i.test(url.trim());
}

/** رسائل وصلت كنص رابط قبل أعمدة الوسائط */
function isVideoUrl(url: string) {
  const u = url.trim();
  if (/\.(?:mp4|mov|webm|m4v|mkv)(?:\?\S*)?$/i.test(u)) return true;
  if (/\.(?:png|jpe?g|gif|webp|svg|heic)(?:\?\S*)?$/i.test(u)) return false;
  if (/\/(?:videos?|highlights|analysis|forums)\//i.test(u)) return true;
  if (/[?&](?:type|content.?type)=video/i.test(u)) return true;
  if (/video|mp4|webm|mov/i.test(u) && /supabase|storage|share-media/i.test(u)) {
    return true;
  }
  return false;
}

function inferMediaKind(url: string): PrivateChatMediaKind {
  return isVideoUrl(url) ? 'video' : 'photo';
}

function resolveChatMedia(message: {
  text: string;
  mediaUrl?: string;
  mediaKind?: PrivateChatMediaKind;
}): {
  mediaUrl?: string;
  mediaKind?: PrivateChatMediaKind;
  caption: string;
} {
  if (message.mediaUrl) {
    let kind: PrivateChatMediaKind =
      message.mediaKind === 'photo' || message.mediaKind === 'video'
        ? message.mediaKind
        : inferMediaKind(message.mediaUrl);
    if (kind === 'photo' && isVideoUrl(message.mediaUrl)) kind = 'video';
    const caption =
      message.text &&
      message.text.trim() !== message.mediaUrl.trim() &&
      !/^(?:🖼️|🎬)\s*https?:\/\//i.test(message.text.trim())
        ? message.text
        : '';
    return {
      mediaUrl: message.mediaUrl,
      mediaKind: kind,
      caption,
    };
  }
  const raw = (message.text || '').trim();
  const match = raw.match(/^(?:🖼️|🎬)\s*(https?:\/\/\S+)/i);
  if (match?.[1]) {
    return {
      mediaUrl: match[1],
      mediaKind: raw.startsWith('🎬') || isVideoUrl(match[1]) ? 'video' : 'photo',
      caption: '',
    };
  }
  if (/^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|mp4|mov|webm|m4v)(?:\?\S*)?$/i.test(raw)) {
    return {
      mediaUrl: raw,
      mediaKind: isVideoUrl(raw) ? 'video' : 'photo',
      caption: '',
    };
  }
  // رابط سحابي بدون امتداد ظاهر في نص الرسالة
  const bare = raw.match(/^(https?:\/\/\S+)/i);
  if (bare?.[1] && /supabase|storage|share-media/i.test(bare[1])) {
    return {
      mediaUrl: bare[1],
      mediaKind: inferMediaKind(bare[1]),
      caption: '',
    };
  }
  return { caption: message.text || '' };
}

type AttachSource = 'saved' | 'highlights' | 'content';

type AttachableItem = {
  id: string;
  uri: string;
  kind: PrivateChatMediaKind;
  label: string;
};

const CHAT_VIDEO_W = 200;
const CHAT_VIDEO_H = 120;

const ChatVideoBubble = memo(function ChatVideoBubble({ uri }: { uri: string }) {
  const focused = useIsFocused();
  const videoRef = useRef<VideoType | null>(null);
  const htmlRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const stop = useCallback(() => {
    void videoRef.current?.pauseAsync().catch(() => undefined);
    const el = htmlRef.current;
    if (el) {
      el.pause();
    }
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!focused) stop();
    return () => stop();
  }, [focused, uri, stop]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => sub.remove();
  }, [stop]);

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) setFailed(true);
      return;
    }
    setPlaying(status.isPlaying);
  }, []);

  const wrapStyle = {
    width: CHAT_VIDEO_W,
    height: CHAT_VIDEO_H,
    minWidth: CHAT_VIDEO_W,
    minHeight: CHAT_VIDEO_H,
    borderRadius: 10,
    overflow: 'hidden' as const,
    alignSelf: 'center' as const,
    backgroundColor: '#0b1220',
  };

  if (!focused) {
    return <View style={wrapStyle} />;
  }

  if (failed) {
    return (
      <View style={[wrapStyle, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={28} color="#fff" />
      </View>
    );
  }

  // ويب: عنصر video أصلي بأبعاد ثابتة (expo-av ينهار إلى شريط رفيع على سطح المكتب)
  if (Platform.OS === 'web') {
    return (
      <View style={wrapStyle}>
        {createElement('video', {
          ref: (node: HTMLVideoElement | null) => {
            htmlRef.current = node;
          },
          src: uri,
          controls: true,
          playsInline: true,
          preload: 'metadata',
          style: {
            width: CHAT_VIDEO_W,
            height: CHAT_VIDEO_H,
            objectFit: 'cover',
            borderRadius: 10,
            backgroundColor: '#0b1220',
            display: 'block',
          },
          onPlay: () => setPlaying(true),
          onPause: () => setPlaying(false),
          onError: () => setFailed(true),
          onLoadedData: (e: { target: HTMLVideoElement }) => {
            try {
              const v = e.target;
              if (v.currentTime < 0.05) v.currentTime = 0.05;
            } catch {
              // ignore
            }
          },
        })}
      </View>
    );
  }

  return (
    <View style={wrapStyle}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={{ width: CHAT_VIDEO_W, height: CHAT_VIDEO_H }}
        resizeMode={ResizeMode.COVER}
        useNativeControls
        shouldPlay={false}
        isLooping={false}
        isMuted={false}
        onPlaybackStatusUpdate={onStatus}
        onError={() => setFailed(true)}
      />
      {!playing ? (
        <Pressable
          style={styles.videoPlayOverlay}
          onPress={() => {
            void videoRef.current?.playAsync().catch(() => setFailed(true));
          }}
          accessibilityRole="button"
          accessibilityLabel="تشغيل"
        >
          <View style={styles.videoPlayBtn}>
            <Ionicons name="play" size={28} color="#fff" />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
});

async function confirmAction(input: {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    return window.confirm(`${input.title}\n\n${input.message}`);
  }
  return await new Promise<boolean>((resolve) => {
    Alert.alert(input.title, input.message, [
      {
        text: input.cancelLabel,
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: input.confirmLabel,
        style: 'destructive',
        onPress: () => resolve(true),
      },
    ]);
  });
}

type Section = 'friends' | 'chat' | 'saved';

function resolveAuthorId(
  item: PrivateContentItem,
  users: User[],
  selfId?: string
): string | undefined {
  // معرف سحابي صالح → يُقبل حتى لو لم يُحمَّل الملف بعد في users
  if (item.authorId && isUuid(item.authorId) && item.authorId !== selfId) {
    return item.authorId;
  }
  if (item.authorHandle) {
    const handle = item.authorHandle.replace(/^@/, '').toLowerCase();
    const byHandle = users.find(
      (u) => (u.handle || '').replace(/^@/, '').toLowerCase() === handle
    );
    if (byHandle && byHandle.id !== selfId) return byHandle.id;
  }
  if (item.authorName) {
    const byName = users.find(
      (u) => u.name.trim().toLowerCase() === item.authorName.trim().toLowerCase()
    );
    if (byName && byName.id !== selfId) return byName.id;
  }
  return undefined;
}

const SECTIONS: { key: Section; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'friends', labelKey: 'privateSpace.friends', icon: 'people-outline' },
  { key: 'chat', labelKey: 'privateSpace.chat', icon: 'chatbubbles-outline' },
  { key: 'saved', labelKey: 'privateSpace.saved', icon: 'bookmark-outline' },
];

const SavedCard = memo(function SavedCard({
  item,
  canAddFriend,
  isFriend,
  onRemove,
  onAddFriend,
}: {
  item: PrivateContentItem;
  canAddFriend: boolean;
  isFriend: boolean;
  onRemove: () => void;
  onAddFriend?: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <Card style={styles.savedCard}>
      <View style={styles.savedHead}>
        <Muted>{item.authorHandle || item.authorName}</Muted>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button">
          <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
        </Pressable>
      </View>
      {item.kind === 'photo' && item.mediaUrl ? (
        <Image source={{ uri: item.mediaUrl }} style={styles.savedMedia} />
      ) : null}
      {item.kind === 'video' && item.mediaUrl ? (
        <InlineVideoPlayer uri={item.mediaUrl} height={180} style={styles.savedMedia} />
      ) : null}
      {item.title ? (
        <Text style={[styles.savedTitle, { color: theme.colors.text }]}>
          {item.title}
        </Text>
      ) : null}
      {item.text ? (
        <Text style={[styles.savedBody, { color: theme.colors.text }]} numberOfLines={4}>
          {item.text}
        </Text>
      ) : null}
      <View style={styles.savedFooter}>
        <Muted>{formatArabicDate(new Date(item.savedAt))}</Muted>
        {isFriend ? (
          <Muted>{t('privateSpace.alreadyFriend')}</Muted>
        ) : canAddFriend && onAddFriend ? (
          <Pressable
            onPress={onAddFriend}
            accessibilityRole="button"
            accessibilityLabel={t('privateSpace.addAuthorFriend')}
            style={({ pressed }) => [
              styles.addFriendBtn,
              {
                borderColor: theme.colors.accent,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="person-add-outline" size={14} color={theme.colors.accent} />
            <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>
              {t('privateSpace.addAuthorFriend')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
});

/**
 * مساحة خاصة بالمتابع: أصدقاء + رسائل خاصة + محتوى محفوظ بنقرتين.
 */
export default function PrivateScreen() {
  const { currentUser, users, competitions, loading } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const listChrome = useListChrome();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { desktop } = useResponsive();
  const space = usePrivateSpace(currentUser?.id);
  const [section, setSection] = useState<Section>('friends');
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{
    uri: string;
    kind: PrivateChatMediaKind;
    label?: string;
  } | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachSource, setAttachSource] = useState<AttachSource>('saved');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // أخفِ الأزرار العائمة في كل أقسام الخاصة (محادثة/أصدقاء/محفوظ)
    setFloatingSuppressed(true);
    return () => setFloatingSuppressed(false);
  }, []);

  const me = useMemo(
    () => (currentUser ? ensureSocialLists(currentUser) : null),
    [currentUser]
  );

  const friends = useMemo(
    () =>
      space.friendIds
        .map((id) => users.find((u) => u.id === id))
        .filter(Boolean),
    [space.friendIds, users]
  );

  const candidates = useMemo(() => {
    if (!me) return [];
    const following = new Set(me.following || []);
    const fromFollowing = users.filter(
      (u) =>
        u.id !== me.id &&
        following.has(u.id) &&
        !space.friendIds.includes(u.id)
    );
    const byId = new Map<string, (typeof users)[number]>();
    fromFollowing.forEach((u) => byId.set(u.id, u));

    // أصحاب المحتوى المحفوظ — حتى لو لم يُحمَّل ملفهم في users بعد
    for (const item of space.items) {
      const id = resolveAuthorId(item, users, me.id);
      if (!id || id === me.id || space.friendIds.includes(id)) continue;
      if (byId.has(id)) continue;
      const known = users.find((u) => u.id === id);
      if (known) {
        byId.set(id, known);
        continue;
      }
      byId.set(id, {
        id,
        name: item.authorName || item.authorHandle || id,
        handle: item.authorHandle || '',
        email: '',
        passwordHash: '',
        role: 'follower',
        status: 'active',
        visibleId: '',
        permissions: {
          canComment: true,
          canUseVoice: true,
          canCreateContent: false,
          canNominateToPersonality: false,
        },
        posts: [],
        media: { photos: [], videos: [] },
        personalityPhotos: [],
        analysisContent: [],
        comments: [],
      });
    }
    return [...byId.values()];
  }, [me, users, space.friendIds, space.items]);

  const resolveSavedAuthor = useCallback(
    (item: PrivateContentItem) => {
      const id = resolveAuthorId(item, users, currentUser?.id);
      if (!id || id === currentUser?.id) return null;
      return (
        users.find((u) => u.id === id) || {
          id,
          name: item.authorName || item.authorHandle || id,
          handle: item.authorHandle,
          email: '',
          passwordHash: '',
          role: 'follower' as const,
          status: 'active' as const,
          visibleId: '',
          permissions: {
            canComment: true,
            canUseVoice: true,
            canCreateContent: false,
            canNominateToPersonality: false,
          },
          posts: [],
          media: { photos: [], videos: [] },
          personalityPhotos: [],
          analysisContent: [],
          comments: [],
        }
      );
    },
    [users, currentUser?.id]
  );

  const activeFriend = useMemo(
    () => friends.find((f) => f && f.id === activeFriendId) || friends[0] || null,
    [friends, activeFriendId]
  );

  const chatMessages = activeFriend
    ? space.chats[activeFriend.id] || []
    : [];

  // ارتفاع صندوق الرسائل فقط — شريط الكتابة داخل البطاقة (كمبيوتر) أو فوق التبويب (جوال)
  const tabBarHeight = useMemo(
    () => (desktop ? 0 : tabBarTotalHeight(insets.bottom)),
    [desktop, insets.bottom]
  );
  const composerBottomOffset = desktop
    ? 0
    : tabBarHeight + (Platform.OS === 'web' ? 8 : 4);
  const composerReserve = 78;

  const chatShellHeight = useMemo(() => {
    const topChrome = desktop ? 72 : 52;
    return Math.max(
      240,
      windowHeight - topChrome - composerBottomOffset - composerReserve
    );
  }, [windowHeight, composerBottomOffset, desktop]);

  const chatMessagesHeight = useMemo(() => {
    const chips = 48;
    const head = 34;
    const gaps = 16;
    return Math.max(140, chatShellHeight - chips - head - gaps);
  }, [chatShellHeight]);

  const composerDockStyle = useMemo(() => {
    if (desktop) {
      // داخل عرض بطاقة المحادثة فقط — لا يمتد فوق القائمة الجانبية
      return {
        position: 'absolute' as const,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
        elevation: 4,
      };
    }
    return {
      ...styles.composerFixed,
      bottom: composerBottomOffset,
      position:
        Platform.OS === 'web'
          ? ('fixed' as 'absolute')
          : ('absolute' as const),
    };
  }, [desktop, composerBottomOffset]);

  const onAddFriend = useCallback(
    async (friendId: string) => {
      await space.addFriend(friendId);
      setActiveFriendId(friendId);
      setPickOpen(false);
      setSection('friends');
      toast({
        variant: 'success',
        title: t('privateSpace.friendAdded'),
        description: t('privateSpace.friendCloudHint'),
      });
    },
    [space, toast, t]
  );

  const onRemoveFriend = useCallback(
    async (friendId: string) => {
      const ok = await confirmAction({
        title: t('privateSpace.removeFriendTitle'),
        message: t('privateSpace.removeFriendConfirm'),
        cancelLabel: t('common.cancel'),
        confirmLabel: t('common.delete'),
      });
      if (!ok) return;
      const result = await space.removeFriend(friendId);
      if (activeFriendId === friendId) setActiveFriendId(null);
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: t('privateSpace.removeFriendFailed'),
          description: t('privateSpace.removeFriendFailedHint'),
        });
        return;
      }
      toast({
        variant: 'success',
        title: t('privateSpace.friendRemoved'),
      });
    },
    [space, activeFriendId, toast, t]
  );

  const onClearChat = useCallback(async () => {
    if (!activeFriend) return;
    const ok = await confirmAction({
      title: t('privateSpace.clearChatTitle'),
      message: t('privateSpace.clearChatConfirm'),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    const result = await space.clearChat(activeFriend.id);
    if (!result.ok) {
      toast({
        variant: 'destructive',
        title: t('privateSpace.clearChatFailed'),
        description: t('privateSpace.removeFriendFailedHint'),
      });
      return;
    }
    toast({
      variant: 'success',
      title: t('privateSpace.chatCleared'),
    });
  }, [activeFriend, space, toast, t]);

  const onRemoveSaved = useCallback(
    async (itemId: string) => {
      await space.removeContent(itemId);
      toast({
        variant: 'success',
        title: t('privateSpace.savedRemoved'),
      });
    },
    [space, toast, t]
  );

  const savedAttachables = useMemo<AttachableItem[]>(
    () =>
      space.items
        .filter(
          (item) =>
            (item.kind === 'photo' || item.kind === 'video') &&
            isHttpUrl(item.mediaUrl)
        )
        .map((item) => ({
          id: `saved-${item.id}`,
          uri: item.mediaUrl!,
          kind: item.kind as PrivateChatMediaKind,
          label:
            item.title ||
            item.authorHandle ||
            item.authorName ||
            t('privateSpace.saved'),
        })),
    [space.items, t]
  );

  const highlightAttachables = useMemo<AttachableItem[]>(() => {
    const items: AttachableItem[] = [];
    competitions.forEach((comp) => {
      (comp.media?.photos || []).forEach((p) => {
        if (!isHttpUrl(p.url)) return;
        items.push({
          id: `hl-comp-photo-${p.id}`,
          uri: p.url,
          kind: 'photo',
          label: comp.name,
        });
      });
      (comp.media?.videos || []).forEach((v) => {
        if (!isHttpUrl(v.url)) return;
        items.push({
          id: `hl-comp-video-${v.id}`,
          uri: v.url,
          kind: 'video',
          label: comp.name,
        });
      });
      comp.teams.forEach((team) => {
        team.players.forEach((player) => {
          (player.media?.photos || []).forEach((p) => {
            if (!isHttpUrl(p.url)) return;
            items.push({
              id: `hl-player-photo-${p.id}`,
              uri: p.url,
              kind: 'photo',
              label: `${player.name} · ${team.name}`,
            });
          });
          (player.media?.videos || []).forEach((v) => {
            if (!isHttpUrl(v.url)) return;
            items.push({
              id: `hl-player-video-${v.id}`,
              uri: v.url,
              kind: 'video',
              label: `${player.name} · ${team.name}`,
            });
          });
        });
      });
      comp.matches.forEach((match) => {
        const team1 = comp.teams.find((x) => x.id === match.team1Id)?.name;
        const team2 = comp.teams.find((x) => x.id === match.team2Id)?.name;
        const label = `${team1 || '?'} vs ${team2 || '?'}`;
        (match.media?.photos || []).forEach((p) => {
          if (!isHttpUrl(p.url)) return;
          items.push({
            id: `hl-match-photo-${p.id}`,
            uri: p.url,
            kind: 'photo',
            label,
          });
        });
        (match.media?.videos || []).forEach((v) => {
          if (!isHttpUrl(v.url)) return;
          items.push({
            id: `hl-match-video-${v.id}`,
            uri: v.url,
            kind: 'video',
            label,
          });
        });
      });
    });
    return items;
  }, [competitions]);

  const contentAttachables = useMemo<AttachableItem[]>(() => {
    const items: AttachableItem[] = [];
    const seen = new Set<string>();
    users.forEach((user) => {
      (user.media?.photos || []).forEach((p) => {
        if (!isHttpUrl(p.url) || seen.has(p.url)) return;
        seen.add(p.url);
        items.push({
          id: `user-photo-${p.id}`,
          uri: p.url,
          kind: 'photo',
          label: user.handle || user.name,
        });
      });
      (user.media?.videos || []).forEach((v) => {
        if (!isHttpUrl(v.url) || seen.has(v.url)) return;
        seen.add(v.url);
        items.push({
          id: `user-video-${v.id}`,
          uri: v.url,
          kind: 'video',
          label: user.handle || user.name,
        });
      });
      (user.personalityPhotos || []).forEach((url, idx) => {
        if (!isHttpUrl(url) || seen.has(url)) return;
        seen.add(url);
        items.push({
          id: `personality-${user.id}-${idx}`,
          uri: url,
          kind: 'photo',
          label: user.handle || user.name,
        });
      });
    });
    return items;
  }, [users]);

  const attachables = useMemo(() => {
    if (attachSource === 'saved') return savedAttachables;
    if (attachSource === 'highlights') return highlightAttachables;
    return contentAttachables;
  }, [
    attachSource,
    savedAttachables,
    highlightAttachables,
    contentAttachables,
  ]);

  const sendErrorDescription = useCallback(
    (error?: string) => {
      if (error === 'recipient_inbox_failed') {
        return t('privateSpace.sendFailedRecipient');
      }
      if (error === 'no_session') return t('privateSpace.sendFailedSession');
      if (error === 'upload_failed') return t('privateSpace.attachUploadFailed');
      if (error === 'cloud_unavailable' || error === 'local_only') {
        return t('privateSpace.sendFailedSession');
      }
      return t('privateSpace.sendFailedHint');
    },
    [t]
  );

  const onSelectAttachable = useCallback(
    (item: AttachableItem) => {
      if (!activeFriend) {
        toast({
          variant: 'destructive',
          title: t('privateSpace.chatNeedFriend'),
        });
        return;
      }
      setPendingMedia({
        uri: item.uri,
        kind: item.kind,
        label: item.label,
      });
      setAttachOpen(false);
      toast({
        variant: 'success',
        title:
          item.kind === 'photo'
            ? t('privateSpace.attachPhotoReady')
            : t('privateSpace.attachVideoReady'),
        description: t('privateSpace.attachReadyHint'),
      });
    },
    [activeFriend, toast, t]
  );

  const onSend = useCallback(async () => {
    if (!activeFriend || sending) return;
    const text = draft.trim();
    if (!text && !pendingMedia) return;
    setSending(true);
    setDraft('');
    const media = pendingMedia
      ? { uri: pendingMedia.uri, kind: pendingMedia.kind }
      : undefined;
    const pendingSnapshot = pendingMedia;
    setPendingMedia(null);
    try {
      const result = await space.sendMessage(
        activeFriend.id,
        text,
        media
      );
      if (!result.ok) {
        if (pendingSnapshot) setPendingMedia(pendingSnapshot);
        if (text) setDraft(text);
        toast({
          variant: 'destructive',
          title: t('privateSpace.sendFailed'),
          description: sendErrorDescription(result.error),
        });
        return;
      }
      if (result.warning === 'media_schema_missing') {
        toast({
          variant: 'default',
          title: t('privateSpace.attachSentAsLink'),
          description: t('privateSpace.attachMediaSqlHint'),
        });
      }
    } finally {
      setSending(false);
    }
  }, [
    activeFriend,
    draft,
    pendingMedia,
    sending,
    space,
    toast,
    t,
    sendErrorDescription,
  ]);

  if (loading || !space.ready) return <LoadingState />;
  if (!currentUser) return null;

  const sectionBar = (
    <View style={styles.sections}>
      {SECTIONS.map((s) => {
        const active = section === s.key;
        return (
          <Pressable
            key={s.key}
            onPress={() => setSection(s.key)}
            style={[
              styles.sectionChip,
              {
                backgroundColor: active
                  ? theme.colors.accent
                  : theme.colors.surfaceElevated,
                borderColor: active ? theme.colors.accent : theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name={s.icon}
              size={14}
              color={active ? theme.colors.textInverse : theme.colors.text}
            />
            <Text
              style={{
                color: active ? theme.colors.textInverse : theme.colors.text,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {t(s.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Screen
      style={styles.screen}
      contentStyle={{
        ...styles.content,
        ...(section === 'chat' ? styles.contentChat : null),
      }}
      hasTabBar
      scroll={section === 'friends'}
      keyboard={section === 'chat'}
      fabClearance={section !== 'chat'}
    >
      {section === 'chat' ? null : (
        <>
          <Subtitle style={{ width: '100%' }}>
            {t('privateSpace.title')}
          </Subtitle>
          <Muted>{t('privateSpace.subtitle')}</Muted>
        </>
      )}
      {sectionBar}

      {section === 'friends' ? (
        <View style={styles.block}>
          <Button
            label={t('privateSpace.addFriend')}
            onPress={() => setPickOpen((v) => !v)}
            variant="secondary"
          />
          {pickOpen ? (
            <Card style={styles.pickCard}>
              <Muted>{t('privateSpace.pickFromFollowingOrSaved')}</Muted>
              {candidates.length === 0 ? (
                <Muted>{t('privateSpace.noCandidates')}</Muted>
              ) : (
                candidates.map((u) => (
                  <Pressable
                    key={u.id}
                    style={styles.friendRow}
                    onPress={() => void onAddFriend(u.id)}
                  >
                    <Avatar uri={u.avatar} name={u.name} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                        {u.handle || u.name}
                      </Text>
                      <Muted>{u.name}</Muted>
                    </View>
                    <Ionicons name="add-circle" size={22} color={theme.colors.accent} />
                  </Pressable>
                ))
              )}
            </Card>
          ) : null}

          {friends.length === 0 ? (
            <EmptyState
              title={t('privateSpace.noFriends')}
              description={t('privateSpace.noFriendsDesc')}
              icon="people-outline"
            />
          ) : (
            friends.map((u) =>
              u ? (
                <Card key={u.id} style={styles.friendCard}>
                  <View style={styles.friendRow}>
                    <Avatar uri={u.avatar} name={u.name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                        {u.handle || u.name}
                      </Text>
                      <Muted>{u.name}</Muted>
                    </View>
                    <Pressable
                      onPress={() => {
                        setActiveFriendId(u.id);
                        setSection('chat');
                      }}
                      hitSlop={6}
                    >
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={22}
                        color={theme.colors.accent}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => void onRemoveFriend(u.id)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={t('privateSpace.removeFriendTitle')}
                    >
                      <Ionicons
                        name="person-remove-outline"
                        size={20}
                        color={theme.colors.danger}
                      />
                    </Pressable>
                  </View>
                </Card>
              ) : null
            )
          )}
        </View>
      ) : null}

      {section === 'chat' ? (
        <View
          style={[
            styles.chatShell,
            { height: chatShellHeight, position: 'relative' },
          ]}
        >
          {friends.length === 0 ? (
            <EmptyState
              title={t('privateSpace.noFriends')}
              description={t('privateSpace.chatNeedFriend')}
              icon="chatbubbles-outline"
            />
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.friendChips}
                keyboardShouldPersistTaps="handled"
                style={styles.friendChipsScroll}
              >
                {friends.filter(Boolean).map((u) => {
                  if (!u) return null;
                  const active = activeFriend?.id === u.id;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => {
                        setActiveFriendId(u.id);
                        setPendingMedia(null);
                      }}
                      style={[
                        styles.friendChip,
                        {
                          borderColor: active
                            ? theme.colors.accent
                            : theme.colors.border,
                          backgroundColor: active
                            ? theme.colors.accentSoft
                            : theme.colors.card,
                        },
                      ]}
                    >
                      <Avatar uri={u.avatar} name={u.name} size={28} />
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontWeight: '700',
                          fontSize: 12,
                        }}
                        numberOfLines={1}
                      >
                        {u.handle || u.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View
                style={[
                  styles.chatPanel,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.chatHead}>
                  <Muted style={{ flex: 1 }}>
                    {t('privateSpace.privateWith', {
                      name: activeFriend?.handle || activeFriend?.name || '',
                    })}
                  </Muted>
                  <Pressable
                    onPress={() => void onClearChat()}
                    disabled={!activeFriend || chatMessages.length === 0}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('privateSpace.clearChatTitle')}
                    style={{ opacity: chatMessages.length ? 1 : 0.35 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={theme.colors.danger}
                    />
                  </Pressable>
                </View>

                <ScrollView
                  style={[styles.chatListScroll, { height: chatMessagesHeight }]}
                  contentContainerStyle={styles.chatList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {chatMessages.length === 0 ? (
                    <Muted>{t('privateSpace.noMessages')}</Muted>
                  ) : (
                    chatMessages.map((m) => {
                      const resolved = resolveChatMedia(m);
                      const mediaUrl = resolved.mediaUrl;
                      const mediaKind = resolved.mediaKind;
                      const caption = resolved.caption;
                      return (
                      <View
                        key={m.id}
                        style={[
                          styles.bubble,
                          mediaUrl ? styles.bubbleWithMedia : null,
                          {
                            alignSelf: m.fromMe ? 'flex-end' : 'flex-start',
                            backgroundColor: m.fromMe
                              ? theme.colors.accent
                              : theme.colors.surfaceElevated,
                          },
                        ]}
                      >
                        {mediaUrl && mediaKind === 'photo' ? (
                          <View
                            style={{
                              width: CHAT_VIDEO_W,
                              height: CHAT_VIDEO_H,
                              minWidth: CHAT_VIDEO_W,
                              minHeight: CHAT_VIDEO_H,
                              borderRadius: 10,
                              overflow: 'hidden',
                              alignSelf: 'center',
                              backgroundColor: '#0b1220',
                            }}
                          >
                            <Image
                              source={{ uri: mediaUrl }}
                              style={{
                                width: CHAT_VIDEO_W,
                                height: CHAT_VIDEO_H,
                              }}
                              resizeMode="cover"
                            />
                          </View>
                        ) : null}
                        {mediaUrl && mediaKind === 'video' ? (
                          <ChatVideoBubble uri={mediaUrl} />
                        ) : null}
                        {mediaUrl && !mediaKind ? (
                          <ChatVideoBubble uri={mediaUrl} />
                        ) : null}
                        {caption ? (
                          <Text
                            style={{
                              color: m.fromMe
                                ? theme.colors.textInverse
                                : theme.colors.text,
                            }}
                          >
                            {caption}
                          </Text>
                        ) : null}
                      </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>

                <View
                  style={[
                    styles.composerDock,
                    composerDockStyle,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  {pendingMedia ? (
                    <View
                      style={[
                        styles.pendingMedia,
                        { borderColor: theme.colors.border },
                      ]}
                    >
                      {pendingMedia.kind === 'photo' ? (
                        <Image
                          source={{ uri: pendingMedia.uri }}
                          style={styles.pendingThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.pendingThumb}>
                          <Video
                            source={{ uri: pendingMedia.uri }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={false}
                            isMuted
                            useNativeControls={false}
                            {...(Platform.OS === 'web'
                              ? ({ playsInline: true } as object)
                              : null)}
                          />
                          <View style={styles.pendingVideoBadge}>
                            <Ionicons name="play" size={14} color="#fff" />
                          </View>
                        </View>
                      )}
                      <Muted style={{ flex: 1 }} numberOfLines={1}>
                        {pendingMedia.label ||
                          (pendingMedia.kind === 'photo'
                            ? t('privateSpace.attachPhotoReady')
                            : t('privateSpace.attachVideoReady'))}
                      </Muted>
                      <Pressable
                        onPress={() => setPendingMedia(null)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.cancel')}
                      >
                        <Ionicons
                          name="close-circle"
                          size={22}
                          color={theme.colors.danger}
                        />
                      </Pressable>
                    </View>
                  ) : null}
                  <View style={styles.composerRow}>
                    <Pressable
                      onPress={() => {
                        setAttachSource(
                          savedAttachables.length
                            ? 'saved'
                            : highlightAttachables.length
                              ? 'highlights'
                              : 'content'
                        );
                        setAttachOpen(true);
                      }}
                      disabled={!activeFriend || sending}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('privateSpace.attachContent')}
                      style={[
                        styles.composerIconBtn,
                        { opacity: activeFriend ? 1 : 0.35 },
                      ]}
                    >
                      <Ionicons
                        name="attach-outline"
                        size={24}
                        color={theme.colors.accent}
                      />
                    </Pressable>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder={t('privateSpace.messagePlaceholder')}
                      placeholderTextColor={theme.colors.textMuted}
                      editable={!!activeFriend && !sending}
                      onSubmitEditing={() => void onSend()}
                      returnKeyType="send"
                      blurOnSubmit={false}
                      style={[
                        styles.composerInput,
                        {
                          color: theme.colors.text,
                          backgroundColor: theme.colors.surfaceElevated,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    />
                    <Pressable
                      onPress={() => void onSend()}
                      disabled={
                        sending ||
                        !activeFriend ||
                        (!draft.trim() && !pendingMedia)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t('common.send')}
                      style={[
                        styles.sendBtn,
                        {
                          backgroundColor: theme.colors.accent,
                          opacity:
                            sending ||
                            !activeFriend ||
                            (!draft.trim() && !pendingMedia)
                              ? 0.45
                              : 1,
                        },
                      ]}
                    >
                      <Ionicons
                        name="send"
                        size={18}
                        color={theme.colors.textInverse}
                      />
                    </Pressable>
                  </View>
                </View>
            </>
          )}
        </View>
      ) : null}

      {section === 'saved' ? (
        <FlatList
          style={styles.savedList}
          data={space.items}
          keyExtractor={(item) => item.id}
          {...listChrome}
          contentContainerStyle={[
            styles.savedListContent,
            listChrome.contentContainerStyle,
          ]}
          ListHeaderComponent={
            <Muted style={{ marginBottom: 8 }}>
              {t('privateSpace.savedHint')}
              {space.items.length
                ? ` (${space.items.length})`
                : ''}
            </Muted>
          }
          ListEmptyComponent={
            <EmptyState
              title={t('privateSpace.noSaved')}
              description={t('privateSpace.noSavedDesc')}
              icon="bookmark-outline"
            />
          }
          renderItem={({ item }) => {
            const author = resolveSavedAuthor(item);
            const isFriend = !!(
              author && space.friendIds.includes(author.id)
            );
            return (
              <SavedCard
                item={item}
                canAddFriend={!!author && !isFriend}
                isFriend={isFriend}
                onRemove={() => void onRemoveSaved(item.id)}
                onAddFriend={
                  author
                    ? () => void onAddFriend(author.id)
                    : undefined
                }
              />
            );
          }}
        />
      ) : null}

      <Modal
        visible={attachOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachOpen(false)}
      >
        <View style={styles.attachBackdrop}>
          <Pressable
            style={styles.attachDismiss}
            onPress={() => setAttachOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          />
          <View
            style={[
              styles.attachSheet,
              { backgroundColor: theme.colors.card },
            ]}
          >
            <View style={styles.attachHead}>
              <Subtitle>{t('privateSpace.attachContent')}</Subtitle>
              <Pressable
                onPress={() => setAttachOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={theme.colors.text}
                />
              </Pressable>
            </View>
            <Muted style={{ marginBottom: 8 }}>
              {t('privateSpace.attachFromApp')}
            </Muted>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attachTabs}
            >
              {(
                [
                  {
                    key: 'saved' as const,
                    label: t('privateSpace.attachSourceSaved'),
                    count: savedAttachables.length,
                  },
                  {
                    key: 'highlights' as const,
                    label: t('privateSpace.attachSourceHighlights'),
                    count: highlightAttachables.length,
                  },
                  {
                    key: 'content' as const,
                    label: t('privateSpace.attachSourceContent'),
                    count: contentAttachables.length,
                  },
                ] as const
              ).map((tab) => {
                const active = attachSource === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setAttachSource(tab.key)}
                    style={[
                      styles.attachTab,
                      {
                        borderColor: active
                          ? theme.colors.accent
                          : theme.colors.border,
                        backgroundColor: active
                          ? theme.colors.accentSoft
                          : theme.colors.surfaceElevated,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontWeight: '700',
                        fontSize: 12,
                      }}
                    >
                      {tab.label} ({tab.count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {attachables.length === 0 ? (
              <EmptyState
                title={t('privateSpace.attachEmpty')}
                description={t('privateSpace.attachEmptyDesc')}
                icon="images-outline"
              />
            ) : (
              <ScrollView
                style={styles.attachGrid}
                contentContainerStyle={styles.attachGridContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.attachWrap}>
                  {attachables.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => onSelectAttachable(item)}
                      disabled={!activeFriend}
                      style={[
                        styles.attachCell,
                        { backgroundColor: theme.colors.surfaceElevated },
                      ]}
                    >
                      {item.kind === 'photo' ? (
                        <Image
                          source={{ uri: item.uri }}
                          style={styles.attachThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.attachThumb}>
                          <Video
                            source={{ uri: item.uri }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={false}
                            isMuted
                            useNativeControls={false}
                            {...(Platform.OS === 'web'
                              ? ({ playsInline: true } as object)
                              : null)}
                          />
                          <View style={styles.attachPlayBadge}>
                            <Ionicons name="play-circle" size={28} color="#fff" />
                          </View>
                        </View>
                      )}
                      <Text
                        numberOfLines={1}
                        style={{
                          color: theme.colors.textMuted,
                          fontSize: 10,
                          marginTop: 4,
                        }}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: 12, gap: 12, paddingBottom: 24 },
  contentChat: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 0,
    gap: 8,
  },
  sections: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flexShrink: 0,
  },
  sectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  block: { gap: 10 },
  chatShell: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  chatBlock: {
    flex: 1,
    minHeight: 0,
    gap: 10,
  },
  pickCard: { gap: 10 },
  friendCard: { gap: 0 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  friendChipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 48,
  },
  friendChips: { gap: 8, paddingVertical: 4, flexGrow: 0 },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    maxWidth: 160,
  },
  chatPanel: {
    flex: 1,
    minHeight: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    overflow: 'hidden',
  },
  chatCard: {
    flexGrow: 0,
    gap: 10,
    overflow: 'hidden',
  },
  chatHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  composerDock: {
    gap: 8,
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  composerFixed: {
    left: 12,
    right: 12,
    zIndex: 40,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
    flexShrink: 0,
  },
  chatListScroll: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
  },
  chatList: { gap: 8, paddingBottom: 8 },
  bubble: {
    maxWidth: '85%',
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 8,
    overflow: 'hidden',
  },
  bubbleWithMedia: {
    width: 224,
    maxWidth: 224,
    minWidth: 224,
  },
  bubbleMediaWrap: {
    width: 200,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#0b1220',
  },
  bubbleMedia: {
    width: 200,
    height: 120,
  },
  bubbleVideo: {
    width: 200,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
  },
  videoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  pendingMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 8,
  },
  pendingThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0b1220',
  },
  pendingVideo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingVideoBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  attachPlayBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  attachBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  attachDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  attachSheet: {
    zIndex: 2,
    elevation: 8,
    maxHeight: '78%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 8,
  },
  attachHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  attachTabs: {
    gap: 8,
    paddingVertical: 4,
  },
  attachTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },
  attachGrid: {
    minHeight: 180,
    maxHeight: 420,
  },
  attachGridContent: {
    paddingBottom: 12,
  },
  attachWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachCell: {
    width: '31%',
    flexGrow: 1,
    maxWidth: '33%',
    borderRadius: 10,
    padding: 4,
  },
  attachThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0b1220',
  },
  savedCard: { gap: 8, marginBottom: 10 },
  savedList: { flex: 1, minHeight: 280 },
  savedListContent: { paddingBottom: 40, flexGrow: 1 },
  savedHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedMedia: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  savedTitle: { fontWeight: '800', fontSize: 15 },
  savedBody: { lineHeight: 20 },
  savedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
