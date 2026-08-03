import React, { memo, useCallback } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTournament, type Comment } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, LikeButton, Muted, Subtitle } from '@/components/ui';

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

  const renderItem = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentRow
        item={item}
        liked={!!currentUser && item.likes.includes(currentUser.id)}
        onLike={() => toggleCommentLike(item.id)}
        onDelete={() =>
          Alert.alert(t('common.confirm'), t('superadmin.quickComments.deleteConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('superadmin.actions.delete'),
              style: 'destructive',
              onPress: () =>
                deleteQuickComment(item.id, t('superadmin.quickComments.deleted')),
            },
          ])
        }
      />
    ),
    [currentUser, deleteQuickComment, toggleCommentLike, t]
  );

  return (
    <Screen>
      <FlatList
        data={quickComments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.quickComments.title')}</Subtitle>
            <Muted>{t('superadmin.quickComments.subtitle')}</Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('superadmin.quickComments.empty')}
            description={t('superadmin.quickComments.emptyDesc')}
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
  text: { textAlign: 'left', writingDirection: 'ltr', lineHeight: 20 },
});
