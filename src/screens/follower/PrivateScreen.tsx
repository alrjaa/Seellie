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
  AppState,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import type { Video as VideoType } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { confirmDestructive } from '@/utils/confirm';
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
import type {
  PrivateChatMediaKind,
  PrivateContentItem,
} from '@/services/private-space';
import type { User } from '@/providers/TournamentProvider';
import { isUuid } from '@/services/supabase-messages';

function useKeyboardBottomInset(enabled: boolean) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setInset(0);
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const vv = window.visualViewport;
      if (!vv) return;
      const update = () => {
        const covered = Math.max(
          0,
          window.innerHeight - vv.height - vv.offsetTop
        );
        setInset(covered > 40 ? covered : 0);
      };
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      update();
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      };
    }

    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setInset(Math.max(0, e.endCoordinates?.height || 0));
    });
    const onHide = Keyboard.addListener(hideEvent, () => setInset(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [enabled]);

  return inset;
}

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

const ChatMediaThumb = memo(function ChatMediaThumb({
  uri,
  kind,
  onOpen,
}: {
  uri: string;
  kind: PrivateChatMediaKind;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const htmlRef = useRef<HTMLVideoElement | null>(null);

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

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={
        kind === 'photo' ? t('common.photo') : t('media.play')
      }
      style={({ pressed }) => [wrapStyle, { opacity: pressed ? 0.88 : 1 }]}
    >
      {kind === 'photo' ? (
        <Image
          source={{ uri }}
          style={{ width: CHAT_VIDEO_W, height: CHAT_VIDEO_H }}
          resizeMode="cover"
        />
      ) : Platform.OS === 'web' ? (
        createElement('video', {
          ref: (node: HTMLVideoElement | null) => {
            htmlRef.current = node;
          },
          src: uri,
          muted: true,
          playsInline: true,
          preload: 'metadata',
          style: {
            width: CHAT_VIDEO_W,
            height: CHAT_VIDEO_H,
            objectFit: 'cover',
            borderRadius: 10,
            backgroundColor: '#0b1220',
            display: 'block',
            pointerEvents: 'none',
          },
          onLoadedData: (e: { target: HTMLVideoElement }) => {
            try {
              const v = e.target;
              if (v.currentTime < 0.05) v.currentTime = 0.05;
            } catch {
              // ignore
            }
          },
        })
      ) : (
        <Video
          source={{ uri }}
          style={{ width: CHAT_VIDEO_W, height: CHAT_VIDEO_H }}
          resizeMode={ResizeMode.COVER}
          useNativeControls={false}
          shouldPlay={false}
          isMuted
          isLooping={false}
        />
      )}
      {kind === 'video' ? (
        <View style={styles.videoPlayOverlay} pointerEvents="none">
          <View style={styles.videoPlayBtn}>
            <Ionicons name="play" size={28} color="#fff" />
          </View>
        </View>
      ) : (
        <View style={styles.photoExpandHint} pointerEvents="none">
          <Ionicons name="expand-outline" size={16} color="#fff" />
        </View>
      )}
    </Pressable>
  );
});

const ChatMediaLightbox = memo(function ChatMediaLightbox({
  uri,
  kind,
  onClose,
}: {
  uri: string;
  kind: PrivateChatMediaKind;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const videoRef = useRef<VideoType | null>(null);
  const htmlRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!focused) onClose();
  }, [focused, onClose]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void videoRef.current?.pauseAsync().catch(() => undefined);
        htmlRef.current?.pause();
      }
    });
    return () => {
      sub.remove();
      void videoRef.current?.pauseAsync().catch(() => undefined);
      htmlRef.current?.pause();
    };
  }, []);

  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}
    >
      <View style={styles.lightboxRoot}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={[
            styles.lightboxClose,
            { top: Math.max(insets.top, 12) + 8 },
          ]}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>

        {kind === 'photo' ? (
          <Pressable style={styles.lightboxMediaWrap} onPress={onClose}>
            <Image
              source={{ uri }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          </Pressable>
        ) : Platform.OS === 'web' ? (
          <View style={styles.lightboxMediaWrap}>
            {createElement('video', {
              ref: (node: HTMLVideoElement | null) => {
                htmlRef.current = node;
                if (node) {
                  void node.play().catch(() => undefined);
                }
              },
              src: uri,
              controls: true,
              autoPlay: true,
              playsInline: true,
              style: {
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: '#000',
              },
            })}
          </View>
        ) : (
          <Video
            ref={videoRef}
            source={{ uri }}
            style={styles.lightboxVideo}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            isLooping={false}
            isMuted={false}
          />
        )}
      </View>
    </Modal>
  );
});

type Section = 'friends' | 'following' | 'followers' | 'chat' | 'saved';

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

function friendStub(input: {
  id: string;
  name?: string;
  handle?: string;
  avatar?: string;
}): User {
  return {
    id: input.id,
    name: input.name || input.handle || input.id,
    handle: input.handle || '',
    email: '',
    passwordHash: '',
    role: 'follower',
    status: 'active',
    visibleId: '',
    avatar: input.avatar,
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
  };
}

const SECTIONS: { key: Section; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'friends', labelKey: 'privateSpace.friends', icon: 'people-outline' },
  {
    key: 'following',
    labelKey: 'privateSpace.followingTab',
    icon: 'arrow-up',
  },
  {
    key: 'followers',
    labelKey: 'privateSpace.followersTab',
    icon: 'arrow-down',
  },
  { key: 'chat', labelKey: 'privateSpace.chat', icon: 'chatbubbles-outline' },
  { key: 'saved', labelKey: 'privateSpace.saved', icon: 'bookmark-outline' },
];

const SavedCard = memo(function SavedCard({
  item,
  canAddFriend,
  isFriend,
  onRemove,
  onAddFriend,
  adding,
}: {
  item: PrivateContentItem;
  canAddFriend: boolean;
  isFriend: boolean;
  onRemove: () => void;
  onAddFriend?: () => void;
  adding?: boolean;
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
            disabled={!!adding}
            accessibilityRole="button"
            accessibilityLabel={t('privateSpace.addAuthorFriend')}
            style={({ pressed }) => [
              styles.addFriendBtn,
              {
                borderColor: theme.colors.accent,
                opacity: adding ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons
              name={adding ? 'hourglass-outline' : 'person-add-outline'}
              size={14}
              color={theme.colors.accent}
            />
            <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>
              {adding
                ? t('common.loading')
                : t('privateSpace.addAuthorFriend')}
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
  const { currentUser, users, competitions, loading, toggleFollowUser } =
    useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const listChrome = useListChrome();
  const insets = useSafeAreaInsets();
  const { desktop } = useResponsive();
  const space = usePrivateSpace(currentUser?.id);
  const [section, setSection] = useState<Section>('friends');
  const keyboardInset = useKeyboardBottomInset(section === 'chat');
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
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [mediaViewer, setMediaViewer] = useState<{
    uri: string;
    kind: PrivateChatMediaKind;
  } | null>(null);

  const me = useMemo(
    () => (currentUser ? ensureSocialLists(currentUser) : null),
    [currentUser]
  );

  const friends = useMemo(() => {
    return space.friendIds
      .map((id) => {
        const known = users.find((u) => u.id === id);
        if (known) return known;
        // منظّم/مؤلف محفوظ غير محمّل في users — لا نخفيه من القائمة
        const fromSaved = space.items.find(
          (item) => resolveAuthorId(item, users, me?.id) === id
        );
        if (fromSaved) {
          return friendStub({
            id,
            name: fromSaved.authorName,
            handle: fromSaved.authorHandle,
          });
        }
        return friendStub({ id, name: id.slice(0, 8) });
      })
      .filter(Boolean) as User[];
  }, [space.friendIds, space.items, users, me?.id]);

  const followingList = useMemo(() => {
    if (!me) return [] as User[];
    const ids = ensureSocialLists(me).following || [];
    return ids
      .map((id) => {
        const known = users.find((u) => u.id === id);
        if (known) return known;
        return friendStub({ id, name: id.slice(0, 8) });
      })
      .filter((u) => u.id !== me.id) as User[];
  }, [me, users]);

  const followersList = useMemo(() => {
    if (!me) return [] as User[];
    const ids = ensureSocialLists(me).followers || [];
    return ids
      .map((id) => {
        const known = users.find((u) => u.id === id);
        if (known) return known;
        return friendStub({ id, name: id.slice(0, 8) });
      })
      .filter((u) => u.id !== me.id) as User[];
  }, [me, users]);

  const followingIds = useMemo(
    () => new Set(me ? ensureSocialLists(me).following || [] : []),
    [me]
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
    const byId = new Map<string, User>();
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
      byId.set(
        id,
        friendStub({
          id,
          name: item.authorName || item.authorHandle || id,
          handle: item.authorHandle || '',
        })
      );
    }
    return [...byId.values()];
  }, [me, users, space.friendIds, space.items]);

  const resolveSavedAuthor = useCallback(
    (item: PrivateContentItem) => {
      const id = resolveAuthorId(item, users, currentUser?.id);
      if (!id || id === currentUser?.id) return null;
      return (
        users.find((u) => u.id === id) ||
        friendStub({
          id,
          name: item.authorName || item.authorHandle || id,
          handle: item.authorHandle,
        })
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

  // عند فتح لوحة المفاتيح نستبدل خلوص التبويب بارتفاعها حتى لا تُقصّ الرسائل
  const chatBottomPad = keyboardInset > 0 ? keyboardInset : undefined;

  const onAddFriend = useCallback(
    async (friendId: string, opts?: { stayOnSaved?: boolean }) => {
      if (!friendId || addingFriendId) return;
      setAddingFriendId(friendId);
      try {
        const result = await space.addFriend(friendId);
        setActiveFriendId(friendId);
        setPickOpen(false);
        if (!opts?.stayOnSaved) {
          setSection('friends');
        }
        if (!result.ok) {
          const notInProfiles = result.error === 'friend_not_in_profiles';
          toast({
            variant: 'destructive',
            title: t('privateSpace.addFriendFailed'),
            description: notInProfiles
              ? t('privateSpace.addFriendNotFound')
              : t('privateSpace.addFriendFailedHint'),
          });
          return;
        }
        toast({
          variant: 'success',
          title: t('privateSpace.friendAdded'),
          description: opts?.stayOnSaved
            ? t('privateSpace.friendAddedFromSaved')
            : undefined,
        });
      } finally {
        setAddingFriendId(null);
      }
    },
    [space, toast, t, addingFriendId]
  );

  const onRemoveFriend = useCallback(
    async (friendId: string) => {
      const ok = await confirmDestructive({
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
    const ok = await confirmDestructive({
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
            accessibilityRole="button"
            accessibilityLabel={t(s.labelKey)}
            accessibilityState={{ selected: active }}
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
              size={20}
              color={active ? theme.colors.textInverse : theme.colors.text}
            />
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
        ...(section === 'chat'
          ? {
              ...styles.contentChat,
              ...(chatBottomPad != null
                ? { paddingBottom: chatBottomPad }
                : null),
            }
          : null),
      }}
      hasTabBar
      scroll={
        section === 'friends' ||
        section === 'following' ||
        section === 'followers'
      }
      keyboard={false}
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

      {section === 'following' ? (
        <View style={styles.block}>
          <Muted>{t('privateSpace.followingHint')}</Muted>
          {followingList.length === 0 ? (
            <EmptyState
              title={t('privateSpace.noFollowing')}
              description={t('privateSpace.noFollowingDesc')}
              icon="person-add-outline"
            />
          ) : (
            followingList.map((u) => (
              <Card key={u.id} style={styles.friendCard}>
                <View style={styles.friendRow}>
                  <Avatar uri={u.avatar} name={u.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: theme.colors.text, fontWeight: '800' }}
                    >
                      {u.handle || u.name}
                    </Text>
                    <Muted>{u.name}</Muted>
                  </View>
                  {!space.friendIds.includes(u.id) ? (
                    <Pressable
                      onPress={() => void onAddFriend(u.id)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={t('privateSpace.addFriend')}
                    >
                      <Ionicons
                        name="person-add-outline"
                        size={22}
                        color={theme.colors.accent}
                      />
                    </Pressable>
                  ) : (
                    <Muted>{t('privateSpace.alreadyFriend')}</Muted>
                  )}
                  <Pressable
                    onPress={() => toggleFollowUser(u.id)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('account.stats.unfollow')}
                  >
                    <Ionicons
                      name="remove-circle-outline"
                      size={22}
                      color={theme.colors.danger}
                    />
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </View>
      ) : null}

      {section === 'followers' ? (
        <View style={styles.block}>
          <Muted>{t('privateSpace.followersHint')}</Muted>
          {followersList.length === 0 ? (
            <EmptyState
              title={t('privateSpace.noFollowers')}
              description={t('privateSpace.noFollowersDesc')}
              icon="people-circle-outline"
            />
          ) : (
            followersList.map((u) => {
              const isFollowingBack = followingIds.has(u.id);
              return (
                <Card key={u.id} style={styles.friendCard}>
                  <View style={styles.friendRow}>
                    <Avatar uri={u.avatar} name={u.name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ color: theme.colors.text, fontWeight: '800' }}
                      >
                        {u.handle || u.name}
                      </Text>
                      <Muted>{u.name}</Muted>
                    </View>
                    {!space.friendIds.includes(u.id) ? (
                      <Pressable
                        onPress={() => void onAddFriend(u.id)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('privateSpace.addFriend')}
                      >
                        <Ionicons
                          name="person-add-outline"
                          size={22}
                          color={theme.colors.accent}
                        />
                      </Pressable>
                    ) : (
                      <Muted>{t('privateSpace.alreadyFriend')}</Muted>
                    )}
                    <Pressable
                      onPress={() => toggleFollowUser(u.id)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isFollowingBack
                          ? t('account.stats.unfollow')
                          : t('account.stats.follow')
                      }
                    >
                      <Ionicons
                        name={
                          isFollowingBack
                            ? 'checkmark-circle'
                            : 'person-add-outline'
                        }
                        size={22}
                        color={
                          isFollowingBack
                            ? theme.colors.success || theme.colors.accent
                            : theme.colors.accent
                        }
                      />
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      ) : null}

      {section === 'chat' ? (
        <View style={styles.chatShell}>
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
                  style={styles.chatListScroll}
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
                          <ChatMediaThumb
                            uri={mediaUrl}
                            kind="photo"
                            onOpen={() =>
                              setMediaViewer({ uri: mediaUrl, kind: 'photo' })
                            }
                          />
                        ) : null}
                        {mediaUrl && mediaKind === 'video' ? (
                          <ChatMediaThumb
                            uri={mediaUrl}
                            kind="video"
                            onOpen={() =>
                              setMediaViewer({ uri: mediaUrl, kind: 'video' })
                            }
                          />
                        ) : null}
                        {mediaUrl && !mediaKind ? (
                          <ChatMediaThumb
                            uri={mediaUrl}
                            kind={inferMediaKind(mediaUrl)}
                            onOpen={() =>
                              setMediaViewer({
                                uri: mediaUrl,
                                kind: inferMediaKind(mediaUrl),
                              })
                            }
                          />
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

                <View
                  style={[
                    styles.composerDock,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceElevated,
                      width: '100%',
                      maxWidth: '100%',
                      alignSelf: 'stretch',
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
            const busy =
              !!author && addingFriendId === author.id;
            return (
              <SavedCard
                item={item}
                canAddFriend={!!author && !isFriend}
                isFriend={isFriend}
                onRemove={() => void onRemoveSaved(item.id)}
                onAddFriend={
                  author
                    ? () =>
                        void onAddFriend(author.id, { stayOnSaved: true })
                    : undefined
                }
                adding={busy}
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

      {mediaViewer ? (
        <ChatMediaLightbox
          uri={mediaViewer.uri}
          kind={mediaViewer.kind}
          onClose={() => setMediaViewer(null)}
        />
      ) : null}
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
    flexWrap: 'nowrap',
    gap: 4,
    flexShrink: 0,
  },
  sectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 36,
  },
  block: { gap: 10 },
  chatShell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    gap: 8,
    overflow: 'hidden',
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
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginTop: 4,
  },
  composerFixed: {
    // لم يعد يُستخدم — أُبقي للتوافق إن وُجدت مراجع قديمة
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
    flex: 1,
    minHeight: 0,
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
    backgroundColor: 'rgba(0,0,0,0.25)',
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
  photoExpandHint: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  lightboxRoot: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  lightboxMediaWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  lightboxVideo: {
    width: '100%',
    height: '100%',
  },
  lightboxClose: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
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
