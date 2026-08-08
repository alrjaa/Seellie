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
  onPress,
}: {
  item: Message;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Card
        style={
          !item.read
            ? { ...styles.msgCard, borderColor: theme.colors.accent }
            : styles.msgCard
        }
      >
        <View style={styles.row}>
          <Avatar uri={item.senderAvatar} name={item.senderName} size={40} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.subject, { color: theme.colors.text }]}>
              {item.subject}
            </Text>
            <Muted>{item.senderName}</Muted>
            <Text
              style={[styles.body, { color: theme.colors.textMuted }]}
              numberOfLines={2}
            >
              {item.body}
            </Text>
            <Muted>{formatArabicDate(item.timestamp)}</Muted>
          </View>
          {!item.read ? (
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

  const inbox = useMemo(
    () =>
      currentUser
        ? messages.filter((m) => m.recipientId === currentUser.id)
        : [],
    [messages, currentUser]
  );

  const onSend = useCallback(async () => {
    if (!recipientId) return;
    const ok = await sendMessage({ recipientId, subject, body });
    if (ok) {
      setSubject('');
      setBody('');
      setRecipientId('');
      setComposing(false);
    }
  }, [recipientId, subject, body, sendMessage]);

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  if (currentUser.role !== 'freelancer') {
    return <Redirect href={routeForRole(currentUser.role) as any} />;
  }

  return (
    <Screen>
      <FlatList
        data={inbox}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 8 }}>
            <Subtitle>{t('freelancer.inbox')}</Subtitle>
            <Muted>{t('freelancer.inboxSub')}</Muted>
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
                <Button label={t('common.send')} onPress={onSend} />
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
            onPress={() => markMessageAsRead(item.id)}
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
