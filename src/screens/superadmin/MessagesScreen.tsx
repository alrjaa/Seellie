import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTournament, type Message } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, Muted, SearchBar, Subtitle } from '@/components/ui';
import { formatArabicDate } from '@/utils';
import { matchesSearchQuery } from '@/utils/search';
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
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${item.subject} — ${item.senderName}`}
      accessibilityState={{ selected: !item.read }}
    >
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

export default function MessagesScreen() {
  const {
    messages,
    markMessageAsRead,
    currentUser,
    refreshCloudMessages,
  } = useTournament();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser?.id || !isUuid(currentUser.id)) return;
      void refreshCloudMessages();
    }, [currentUser?.id, refreshCloudMessages])
  );

  const data = useMemo(() => {
    const inbox = currentUser
      ? messages.filter((m) => m.recipientId === currentUser.id)
      : messages;
    return inbox
      .filter((item) =>
        matchesSearchQuery(
          query,
          item.subject,
          item.senderName,
          item.body,
          item.id,
          item.recipientId
        )
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }, [messages, query, currentUser]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageRow item={item} onPress={() => markMessageAsRead(item.id)} />
    ),
    [markMessageAsRead]
  );

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refreshCloudMessages();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.modules.messages.title')}</Subtitle>
            <Muted>
              وارد الدعم من المتابعين. للرد أو المراسلة استخدم شاشة البريد.
            </Muted>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={t('superadmin.searchPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={
              query.trim()
                ? t('superadmin.noSearchResults')
                : t('superadmin.messages.empty')
            }
            icon="chatbubbles-outline"
          />
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
  body: {
    textAlign: 'left',
    lineHeight: 18,
    fontSize: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
