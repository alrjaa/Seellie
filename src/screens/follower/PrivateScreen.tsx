import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
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
import { usePrivateSpace } from '@/hooks/usePrivateSpace';
import { ensureSocialLists } from '@/utils/social-stats';
import { formatArabicDate } from '@/utils';
import type {
  PrivateChatMediaKind,
  PrivateContentItem,
} from '@/services/private-space';
import type { User } from '@/providers/TournamentProvider';
import { isUuid } from '@/services/supabase-messages';

function isHttpUrl(url?: string) {
  return !!url && /^https?:\/\//i.test(url.trim());
}

type AttachSource = 'saved' | 'highlights' | 'content';

type AttachableItem = {
  id: string;
  uri: string;
  kind: PrivateChatMediaKind;
  label: string;
};

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
        <View
          style={[
            styles.savedMedia,
            styles.videoPlaceholder,
            { backgroundColor: theme.colors.surfaceElevated },
          ]}
        >
          <Ionicons name="videocam" size={28} color={theme.colors.accent} />
          <Muted>{t('common.video')}</Muted>
        </View>
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
    async (item: AttachableItem) => {
      if (!activeFriend || sending) return;
      setAttachOpen(false);
      const caption = draft.trim();
      setDraft('');
      setPendingMedia(null);
      setSending(true);
      try {
        const result = await space.sendMessage(activeFriend.id, caption, {
          uri: item.uri,
          kind: item.kind,
        });
        if (!result.ok) {
          setPendingMedia({
            uri: item.uri,
            kind: item.kind,
            label: item.label,
          });
          if (caption) setDraft(caption);
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
    },
    [activeFriend, sending, draft, space, toast, t, sendErrorDescription]
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
    <Screen style={styles.screen} contentStyle={styles.content} hasTabBar>
      <Subtitle style={{ width: '100%' }}>
        {t('privateSpace.title')}
      </Subtitle>
      <Muted>{t('privateSpace.subtitle')}</Muted>
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
        <View style={styles.block}>
          {friends.length === 0 ? (
            <EmptyState
              title={t('privateSpace.noFriends')}
              description={t('privateSpace.chatNeedFriend')}
              icon="chatbubbles-outline"
            />
          ) : (
            <>
              <FlatList
                horizontal
                data={friends.filter(Boolean)}
                keyExtractor={(u) => u!.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.friendChips}
                renderItem={({ item: u }) => {
                  if (!u) return null;
                  const active = activeFriend?.id === u.id;
                  return (
                    <Pressable
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
                }}
              />
              <Card style={styles.chatCard}>
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
                <View style={styles.chatList}>
                  {chatMessages.length === 0 ? (
                    <Muted>{t('privateSpace.noMessages')}</Muted>
                  ) : (
                    chatMessages.map((m) => (
                      <View
                        key={m.id}
                        style={[
                          styles.bubble,
                          {
                            alignSelf: m.fromMe ? 'flex-end' : 'flex-start',
                            backgroundColor: m.fromMe
                              ? theme.colors.accent
                              : theme.colors.surfaceElevated,
                          },
                        ]}
                      >
                        {m.mediaUrl && m.mediaKind === 'photo' ? (
                          <Image
                            source={{ uri: m.mediaUrl }}
                            style={styles.bubbleMedia}
                            resizeMode="cover"
                          />
                        ) : null}
                        {m.mediaUrl && m.mediaKind === 'video' ? (
                          <InlineVideoPlayer
                            uri={m.mediaUrl}
                            height={180}
                            style={styles.bubbleVideo}
                          />
                        ) : null}
                        {m.text ? (
                          <Text
                            style={{
                              color: m.fromMe
                                ? theme.colors.textInverse
                                : theme.colors.text,
                            }}
                          >
                            {m.text}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>
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
                      <View
                        style={[
                          styles.pendingThumb,
                          styles.pendingVideo,
                          { backgroundColor: theme.colors.surfaceElevated },
                        ]}
                      >
                        <Ionicons
                          name="videocam"
                          size={22}
                          color={theme.colors.accent}
                        />
                      </View>
                    )}
                    <Muted style={{ flex: 1 }} numberOfLines={2}>
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
                <Input
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t('privateSpace.messagePlaceholder')}
                  multiline
                />
                <View style={styles.chatActions}>
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
                    style={{ opacity: activeFriend ? 1 : 0.35 }}
                  >
                    <Ionicons
                      name="attach-outline"
                      size={24}
                      color={theme.colors.accent}
                    />
                  </Pressable>
                  <Button
                    label={t('privateSpace.clearChat')}
                    variant="ghost"
                    size="sm"
                    onPress={() => void onClearChat()}
                    disabled={!activeFriend || chatMessages.length === 0}
                  />
                  <Button
                    label={
                      sending
                        ? t('privateSpace.sending')
                        : t('common.send')
                    }
                    onPress={() => void onSend()}
                    disabled={
                      sending ||
                      !activeFriend ||
                      (!draft.trim() && !pendingMedia)
                    }
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
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
        animationType="fade"
        onRequestClose={() => setAttachOpen(false)}
      >
        <View style={styles.attachBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setAttachOpen(false)}
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
                      onPress={() => void onSelectAttachable(item)}
                      disabled={sending || !activeFriend}
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
                        <View
                          style={[
                            styles.attachThumb,
                            styles.pendingVideo,
                            { backgroundColor: theme.colors.border },
                          ]}
                        >
                          <Ionicons
                            name="play-circle"
                            size={28}
                            color={theme.colors.accent}
                          />
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
  sections: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  pickCard: { gap: 10 },
  friendCard: { gap: 0 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  friendChips: { gap: 8, paddingVertical: 4 },
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
  chatCard: { gap: 10, minHeight: 280 },
  chatHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatList: { gap: 8, minHeight: 120 },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 8,
  },
  bubbleMedia: {
    width: 220,
    maxWidth: '100%',
    height: 180,
    borderRadius: 10,
  },
  bubbleVideo: {
    width: 220,
    maxWidth: '100%',
    borderRadius: 10,
    overflow: 'hidden',
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
  },
  pendingVideo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
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
