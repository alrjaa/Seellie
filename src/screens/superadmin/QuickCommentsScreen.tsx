import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTournament, type Comment } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, LikeButton, Muted, SearchBar, Subtitle } from '@/components/ui';
import { matchesSearchQuery } from '@/utils/search';
import { confirmDestructive } from '@/utils/confirm';

const CommentRow = memo(function CommentRow({
  item,
  liked,
  onLike,
  onDelete,
}: {
  item: Comment;
  liked: boolean;
  onLike: () => void;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={item.authorAvatar} name={item.authorName} size={36} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.author, { color: theme.colors.text }]}>
            {item.authorName}
          </Text>
          <Text style={[styles.text, { color: theme.colors.text }]}>{item.text}</Text>
          <LikeButton
            count={item.likes.length}
            liked={liked}
            onPress={onLike}
            size="sm"
          />
        </View>
      </View>
      <Pressable onPress={onDelete} style={{ alignSelf: 'flex-end' }}>
        <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 12 }}>
          {t('superadmin.actions.delete')}
        </Text>
      </Pressable>
    </Card>
  );
});

export default function QuickCommentsScreen() {
  const { quickComments, currentUser, deleteQuickComment, toggleCommentLike } =
    useTournament();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const data = useMemo(
    () =>
      quickComments.filter((item) =>
        matchesSearchQuery(query, item.authorName, item.text, item.id)
      ),
    [quickComments, query]
  );

  const renderItem = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentRow
        item={item}
        liked={!!currentUser && item.likes.includes(currentUser.id)}
        onLike={() => toggleCommentLike(item.id)}
        onDelete={() => {
          void (async () => {
            const ok = await confirmDestructive({
              title: t('common.confirm'),
              message: t('superadmin.quickComments.deleteConfirm'),
              cancelLabel: t('common.cancel'),
              confirmLabel: t('superadmin.actions.delete'),
            });
            if (!ok) return;
            deleteQuickComment(item.id, t('superadmin.quickComments.deleted'));
          })();
        }}
      />
    ),
    [currentUser, deleteQuickComment, toggleCommentLike, t]
  );

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.quickComments.title')}</Subtitle>
            <Muted>{t('superadmin.quickComments.subtitle')}</Muted>
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
                : t('superadmin.quickComments.empty')
            }
            description={
              query.trim()
                ? undefined
                : t('superadmin.quickComments.emptyDesc')
            }
            icon="flash-outline"
          />
        }
        renderItem={renderItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 8 },
  row: { flexDirection: 'row', gap: 10 },
  author: { fontWeight: '800', textAlign: 'left' },
  text: { textAlign: 'left', lineHeight: 20 },
});
