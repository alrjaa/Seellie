import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
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
import type { PrivateContentItem } from '@/services/private-space';

type Section = 'friends' | 'chat' | 'saved';

const SECTIONS: { key: Section; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'friends', labelKey: 'privateSpace.friends', icon: 'people-outline' },
  { key: 'chat', labelKey: 'privateSpace.chat', icon: 'chatbubbles-outline' },
  { key: 'saved', labelKey: 'privateSpace.saved', icon: 'bookmark-outline' },
];

const SavedCard = memo(function SavedCard({
  item,
  onRemove,
}: {
  item: PrivateContentItem;
  onRemove: () => void;
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
      <Muted>{formatArabicDate(new Date(item.savedAt))}</Muted>
    </Card>
  );
});

/**
 * مساحة خاصة بالمتابع: أصدقاء + رسائل خاصة + محتوى محفوظ بنقرتين.
 */
export default function PrivateScreen() {
  const { currentUser, users, loading } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const listChrome = useListChrome();
  const space = usePrivateSpace(currentUser?.id);
  const [section, setSection] = useState<Section>('friends');
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pickOpen, setPickOpen] = useState(false);

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
    return users.filter(
      (u) =>
        u.id !== me.id &&
        following.has(u.id) &&
        !space.friendIds.includes(u.id)
    );
  }, [me, users, space.friendIds]);

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
      });
    },
    [space, toast, t]
  );

  const onRemoveFriend = useCallback(
    async (friendId: string) => {
      await space.removeFriend(friendId);
      if (activeFriendId === friendId) setActiveFriendId(null);
      toast({
        variant: 'success',
        title: t('privateSpace.friendRemoved'),
      });
    },
    [space, activeFriendId, toast, t]
  );

  const onSend = useCallback(async () => {
    if (!activeFriend || !draft.trim()) return;
    await space.sendMessage(activeFriend.id, draft);
    setDraft('');
  }, [activeFriend, draft, space]);

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
              <Muted>{t('privateSpace.pickFromFollowing')}</Muted>
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
                    <Pressable onPress={() => void onRemoveFriend(u.id)} hitSlop={6}>
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
                      onPress={() => setActiveFriendId(u.id)}
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
                <Muted>
                  {t('privateSpace.privateWith', {
                    name: activeFriend?.handle || activeFriend?.name || '',
                  })}
                </Muted>
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
                        <Text
                          style={{
                            color: m.fromMe
                              ? theme.colors.textInverse
                              : theme.colors.text,
                          }}
                        >
                          {m.text}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
                <Input
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t('privateSpace.messagePlaceholder')}
                  multiline
                />
                <Button
                  label={t('common.send')}
                  onPress={() => void onSend()}
                  disabled={!draft.trim() || !activeFriend}
                />
              </Card>
            </>
          )}
        </View>
      ) : null}

      {section === 'saved' ? (
        <FlatList
          data={space.items}
          keyExtractor={(item) => item.id}
          {...listChrome}
          ListHeaderComponent={
            <Muted style={{ marginBottom: 8 }}>{t('privateSpace.savedHint')}</Muted>
          }
          ListEmptyComponent={
            <EmptyState
              title={t('privateSpace.noSaved')}
              description={t('privateSpace.noSavedDesc')}
              icon="bookmark-outline"
            />
          }
          renderItem={({ item }) => (
            <SavedCard
              item={item}
              onRemove={() => void space.removeContent(item.id)}
            />
          )}
        />
      ) : null}
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
  chatList: { gap: 8, minHeight: 120 },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  savedCard: { gap: 8, marginBottom: 10 },
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
});
