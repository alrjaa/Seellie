import React, { memo, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTournament, type Comment } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar, Card, LikeButton, Muted, Subtitle } from '@/components/ui';
import { formatArabicDate } from '@/utils';

const CommentRow = memo(function CommentRow({
  item,
  liked,
  onToggleLike,
}: {
  item: Comment;
  liked: boolean;
  onToggleLike: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={item.authorAvatar} name={item.authorName} size={36} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.author, { color: theme.colors.text }]}>
            {item.authorName}
          </Text>
          <Text style={[styles.text, { color: theme.colors.text }]}>
            {item.text}
          </Text>
          <Muted>{formatArabicDate(item.timestamp)}</Muted>
          <LikeButton
            count={item.likes.length}
            liked={liked}
            onPress={onToggleLike}
            size="sm"
          />
        </View>
      </View>
    </Card>
  );
});

export default function CommentsScreen() {
  const { comments, currentUser, toggleCommentLike } = useTournament();
  const { t } = useTranslation();

  const renderItem = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentRow
        item={item}
        liked={
          !!currentUser && item.likes.includes(currentUser.id)
        }
        onToggleLike={() => toggleCommentLike(item.id)}
      />
    ),
    [currentUser, toggleCommentLike]
  );

  return (
    <Screen>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Subtitle>{t('organizer.comments.title')}</Subtitle>
            <Muted>{t('organizer.comments.subtitle')}</Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('organizer.comments.empty')}
            icon="chatbox-outline"
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
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  author: { fontWeight: '800', textAlign: 'left' },
  text: { textAlign: 'left', lineHeight: 20 },
});
