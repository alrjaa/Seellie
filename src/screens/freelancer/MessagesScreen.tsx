import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useTournament, type Message } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import {
  Avatar,
  Button,
  Card,
  Input,
  Muted,
  Subtitle,
} from '@/components/ui';
import { formatArabicDate } from '@/utils';
import { userHasRole } from '@/utils/roles';
import { isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';

const MessageRow = memo(function MessageRow({
  item,
  currentUserId,
  peerName,
  onPress,
}: {
  item: Message;
  currentUserId: string;
  peerName: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const isSent = item.senderId === currentUserId;
  const unread = !isSent && !item.read;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${item.subject} — ${peerName}`}
      accessibilityState={{ selected: unread }}
    >
      <Card
        style={
          unread
            ? { ...styles.msgCard, borderColor: theme.colors.accent }
            : styles.msgCard
        }
      >
        <View style={styles.row}>
          <Avatar uri={item.senderAvatar} name={peerName} size={40} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.subject, { color: theme.colors.text }]}>
              {item.subject}
            </Text>
            <Muted>
              {isSent
                ? t('organizer.messages.sentTo', { name: peerName })
                : t('organizer.messages.fromLineShort', { name: peerName })}
            </Muted>
            <Text
              style={[styles.body, { color: theme.colors.textMuted }]}
              numberOfLines={2}
            >
              {item.body}
            </Text>
            <Muted>{formatArabicDate(item.timestamp)}</Muted>
          </View>
          {unread ? (
            <View
              style={[styles.dot, { backgroundColor: theme.colors.accent }]}
            />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
});

export default function MessagesScreen() {
  const {
    currentUser,
    loading,
    messages,
    users,
    sendMessage,
    markMessageAsRead,
    routeForRole,
    refreshCloudMessages,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const cloudOk =
    isSupabaseConfigured() && isUuid(currentUser?.id);

  useFocusEffect(
    useCallback(() => {
      if (!cloudOk) return;
      void refreshCloudMessages();
    }, [cloudOk, refreshCloudMessages])
  );

  const organizers = useMemo(
    () => users.filter((u) => userHasRole(u, 'organizer')),
    [users]
  );

  const inbox = useMemo(() => {
    if (!currentUser) return [];
    return messages
      .filter(
        (m) =>
          m.senderId === currentUser.id || m.recipientId === currentUser.id
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [messages, currentUser]);

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
  );

  const peerNameFor = useCallback(
    (msg: Message) => {
      if (!currentUser) return msg.senderName;
      const peerId =
        msg.senderId === currentUser.id ? msg.recipientId : msg.senderId;
      return usersById.get(peerId)?.name || msg.senderName;
    },
    [currentUser, usersById]
  );

  const onOpenMessage = useCallback(
    (msg: Message) => {
      if (msg.recipientId === currentUser?.id) {
        markMessageAsRead(msg.id);
      }
    },
    [currentUser?.id, markMessageAsRead]
  );

  const onSend = useCallback(async () => {
    if (!recipientId || sending) return;
    setSending(true);
    try {
      const ok = await sendMessage({ recipientId, subject, body });
      if (ok) {
        setSubject('');
        setBody('');
        setRecipientId('');
        setComposing(false);
      }
    } finally {
      setSending(false);
    }
  }, [recipientId, subject, body, sendMessage, sending]);

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'freelancer') {
    return <Redirect href={routeForRole(active) as any} />;
  }

  return (
    <Screen keyboard>
      <FlatList
        data={inbox}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 8 }}>
            <Subtitle>{t('freelancer.inbox')}</Subtitle>
            <Muted>{t('freelancer.inboxSub')}</Muted>
            <Muted>{t('freelancer.mailboxHint')}</Muted>
            <Muted>{t('freelancer.joinRequestsHint')}</Muted>
            <Button
              label={composing ? t('freelancer.cancelCompose') : t('freelancer.newMessage')}
              variant={composing ? 'ghost' : 'primary'}
              onPress={() => setComposing((v) => !v)}
            />
            {composing ? (
              <Card style={{ gap: 10 }}>
                <Subtitle>{t('freelancer.sendToOrganizer')}</Subtitle>
                <View style={styles.organizers}>
                  {organizers.map((org) => (
                    <Pressable
                      key={org.id}
                      onPress={() => setRecipientId(org.id)}
                      accessibilityRole="button"
                      accessibilityLabel={org.name}
                      accessibilityState={{ selected: recipientId === org.id }}
                      style={[
                        styles.orgChip,
                        {
                          borderColor:
                            recipientId === org.id
                              ? theme.colors.accent
                              : theme.colors.border,
                          backgroundColor:
                            recipientId === org.id
                              ? theme.colors.accentSoft
                              : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.orgChipText,
                          {
                            color:
                              recipientId === org.id
                                ? theme.colors.accent
                                : theme.colors.text,
                          },
                        ]}
                      >
                        {org.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Input
                  label={t('common.subject')}
                  value={subject}
                  onChangeText={setSubject}
                />
                <Input
                  label={t('freelancer.messageBody')}
                  value={body}
                  onChangeText={setBody}
                  multiline
                />
                <Button
                  label={t('common.send')}
                  onPress={() => void onSend()}
                  disabled={sending || !recipientId}
                  loading={sending}
                />
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !composing ? (
            <EmptyState title={t('freelancer.noMessages')} icon="chatbubbles-outline" />
          ) : null
        }
        renderItem={({ item }) => (
          <MessageRow
            item={item}
            currentUserId={currentUser.id}
            peerName={peerNameFor(item)}
            onPress={() => onOpenMessage(item)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 100 },
  msgCard: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  subject: { fontWeight: '800', textAlign: 'left' },
  body: { textAlign: 'left', lineHeight: 18, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  organizers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  orgChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  orgChipText: { fontSize: 12, fontWeight: '700' },
});
