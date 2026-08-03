import React, { memo, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTournament, type Message } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, Muted, Subtitle } from '@/components/ui';
import { formatArabicDate } from '@/utils';

const MessageRow = memo(function MessageRow({
  item,
  onPress,
}: {
  item: Message;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress}>
      <Card
        style={
          !item.read
            ? { ...styles.card, borderColor: theme.colors.primary }
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
              style={[styles.dot, { backgroundColor: theme.colors.primary }]}
            />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
});

export default function MessagesScreen() {
  const { messages, markMessageAsRead } = useTournament();
  const { t } = useTranslation();

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageRow item={item} onPress={() => markMessageAsRead(item.id)} />
    ),
    [markMessageAsRead]
  );

  return (
    <Screen>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.modules.messages.title')}</Subtitle>
            <Muted>{t('superadmin.messages.subtitle')}</Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title={t('superadmin.messages.empty')} icon="chatbubbles-outline" />
        }
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  subject: { fontWeight: '800', textAlign: 'left' },
  body: { textAlign: 'left', writingDirection: 'ltr', lineHeight: 18, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
