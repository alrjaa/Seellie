import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTournament, type Message, type User } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Button, Card, Input, Muted, Subtitle } from '@/components/ui';
import { formatArabicDate } from '@/utils';
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
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}>
      <Card
        style={
          !item.read
            ? { ...styles.card, borderColor: theme.colors.accent }
            : styles.card
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

export default function OrganizerMessagesScreen() {
  const {
    messages,
    users,
    currentUser,
    markMessageAsRead,
    sendMessage,
    refreshCloudMessages,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
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

  const inbox = useMemo(
    () =>
      messages.filter((m) => m.recipientId === currentUser?.id),
    [messages, currentUser]
  );

  const contacts = useMemo(
    () => users.filter((u) => u.id !== currentUser?.id),
    [users, currentUser]
  );

  const openMessage = useCallback(
    (msg: Message) => {
      markMessageAsRead(msg.id);
      setSelectedMsg(msg);
    },
    [markMessageAsRead]
  );

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageRow item={item} onPress={() => openMessage(item)} />
    ),
    [openMessage]
  );

  return (
    <Screen>
      <FlatList
        data={inbox}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <View style={styles.headerRow}>
              <Subtitle>{t('organizer.messages.inbox')}</Subtitle>
              <Button
                label={t('organizer.messages.newMessage')}
                variant="secondary"
                onPress={() => {
                  setRecipientId('');
                  setSubject('');
                  setBody('');
                  setComposeOpen(true);
                }}
              />
            </View>
            <Muted>{t('organizer.messages.tapToRead')}</Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('organizer.messages.empty')}
            icon="chatbubbles-outline"
          />
        }
        renderItem={renderItem}
      />

      <Modal visible={!!selectedMsg} transparent animationType="fade">
        <Pressable
          style={styles.overlay}
          onPress={() => setSelectedMsg(null)}
        >
          <Pressable
            style={[
              styles.modal,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedMsg ? (
              <ScrollView contentContainerStyle={{ gap: 10 }}>
                <Subtitle>{selectedMsg.subject}</Subtitle>
                <Muted>
                  {t('organizer.messages.fromLine', {
                    name: selectedMsg.senderName,
                    date: formatArabicDate(selectedMsg.timestamp),
                  })}
                </Muted>
                <Text style={[styles.fullBody, { color: theme.colors.text }]}>
                  {selectedMsg.body}
                </Text>
                <Button
                  label={t('organizer.messages.close')}
                  onPress={() => setSelectedMsg(null)}
                />
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={composeOpen} transparent animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setComposeOpen(false)}
          >
            <Pressable
              style={[
                styles.modal,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                contentContainerStyle={{ gap: 12 }}
                keyboardShouldPersistTaps="handled"
              >
                <Subtitle>{t('organizer.messages.newMessage')}</Subtitle>
                <Muted>{t('organizer.messages.chooseRecipient')}</Muted>
                {contacts.map((u: User) => (
                  <Pressable
                    key={u.id}
                    onPress={() => setRecipientId(u.id)}
                    style={[
                      styles.contactPick,
                      {
                        borderColor:
                          recipientId === u.id
                            ? theme.colors.accent
                            : theme.colors.border,
                        backgroundColor:
                          recipientId === u.id
                            ? theme.colors.accentSoft
                            : theme.colors.inputBg,
                      },
                    ]}
                  >
                    <Avatar uri={u.avatar} name={u.name} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.subject, { color: theme.colors.text }]}>
                        {u.name}
                      </Text>
                      <Muted>{u.role}</Muted>
                    </View>
                  </Pressable>
                ))}
                <Input
                  label={t('common.subject')}
                  value={subject}
                  onChangeText={setSubject}
                />
                <Input
                  label={t('organizer.messages.messageBody')}
                  value={body}
                  onChangeText={setBody}
                  multiline
                />
                <View style={styles.headerRow}>
                  <Button
                    label={t('common.cancel')}
                    variant="ghost"
                    onPress={() => setComposeOpen(false)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={t('common.send')}
                    onPress={() => {
                      if (!recipientId) return;
                      void sendMessage({ recipientId, subject, body }).then(
                        (ok) => {
                          if (ok) setComposeOpen(false);
                        }
                      );
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  subject: { fontWeight: '800', textAlign: 'left' },
  body: { textAlign: 'left', lineHeight: 18, fontSize: 12 },
  fullBody: { textAlign: 'left', lineHeight: 22, fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    maxHeight: '85%',
  },
  contactPick: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
});
