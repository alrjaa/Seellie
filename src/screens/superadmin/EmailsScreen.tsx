import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTournament, type Message } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Avatar,
  Button,
  Card,
  Input,
  Muted,
  Subtitle,
  Title,
} from '@/components/ui';
import { formatArabicDate } from '@/utils';

type SentEntry = Message & { localSent?: boolean };

export default function EmailsScreen() {
  const { currentUser, users, sendMessage, messages } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [toId, setToId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [localSent, setLocalSent] = useState<SentEntry[]>([]);

  const recipients = useMemo(
    () => users.filter((u) => u.id !== currentUser?.id && u.role !== 'superadmin'),
    [users, currentUser]
  );

  const sent = useMemo(() => {
    const fromProvider = currentUser
      ? messages.filter((m) => m.senderId === currentUser.id)
      : [];
    const merged = [...localSent, ...fromProvider];
    const seen = new Set<string>();
    return merged.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages, currentUser, localSent]);

  const onSend = useCallback(() => {
    if (!toId) return;
    const ok = sendMessage({ recipientId: toId, subject, body });
    if (ok && currentUser) {
      setLocalSent((prev) => [
        {
          id: `local-${Date.now()}`,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar || '',
          recipientId: toId,
          subject: subject.trim(),
          body: body.trim(),
          timestamp: new Date(),
          read: false,
          localSent: true,
        },
        ...prev,
      ]);
      setSubject('');
      setBody('');
      setToId('');
    }
  }, [toId, subject, body, sendMessage, currentUser]);

  return (
    <Screen>
      <FlatList
        data={sent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <Title>{t('nav.emails')}</Title>
            <Muted>{t('superadmin.emails.subtitle')}</Muted>

            <Card style={{ gap: 10 }}>
              <Subtitle>{t('superadmin.emails.compose')}</Subtitle>
              <View style={styles.recipients}>
                {recipients.map((u) => (
                  <Button
                    key={u.id}
                    label={u.name}
                    variant={toId === u.id ? 'primary' : 'outline'}
                    onPress={() => setToId(u.id)}
                    style={{ flexGrow: 0 }}
                  />
                ))}
              </View>
              <Input
                label={t('superadmin.emails.subject')}
                value={subject}
                onChangeText={setSubject}
              />
              <Input
                label={t('superadmin.emails.body')}
                value={body}
                onChangeText={setBody}
                multiline
              />
              <Button label={t('superadmin.emails.send')} onPress={onSend} />
            </Card>

            <Subtitle>{t('superadmin.emails.sentMessages')}</Subtitle>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('superadmin.emails.emptySent')}
            icon="mail-outline"
          />
        }
        renderItem={({ item }) => {
          const recipient = users.find((u) => u.id === item.recipientId);
          return (
            <Card style={styles.sentCard}>
              <View style={styles.row}>
                <Avatar
                  uri={recipient?.avatar}
                  name={recipient?.name ?? '?'}
                  size={36}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.subject, { color: theme.colors.text }]}>
                    {item.subject}
                  </Text>
                  <Muted>
                    {t('superadmin.emails.toLine', {
                      name: recipient?.name ?? item.recipientId,
                    })}
                  </Muted>
                  <Text
                    style={[styles.body, { color: theme.colors.textMuted }]}
                    numberOfLines={2}
                  >
                    {item.body}
                  </Text>
                  <Muted>{formatArabicDate(item.timestamp)}</Muted>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  recipients: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sentCard: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  subject: { fontWeight: '800', textAlign: 'left' },
  body: { textAlign: 'left', writingDirection: 'ltr', fontSize: 12, lineHeight: 18 },
});
