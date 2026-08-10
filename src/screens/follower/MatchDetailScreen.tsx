import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useTournament,
  type Comment,
  type Match,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import { Image } from 'expo-image';
import {
  Avatar,
  Button,
  Card,
  Input,
  LikeButton,
  ListRow,
  Muted,
  Subtitle,
} from '@/components/ui';
import { formatArabicDate, formatArabicTime } from '@/utils';

function isMatchPlayed(match: Match): boolean {
  const now = Date.now();
  return (
    new Date(match.date).getTime() <= now ||
    match.team1Score > 0 ||
    match.team2Score > 0
  );
}

const CommentCard = memo(function CommentCard({
  item,
  liked,
  onLike,
}: {
  item: Comment;
  liked: boolean;
  onLike: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Card style={styles.commentCard}>
      <View style={styles.commentRow}>
        <Avatar uri={item.authorAvatar} name={item.authorName} size={36} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.author, { color: theme.colors.text }]}>
            {item.authorName}
          </Text>
          <Text style={[styles.commentText, { color: theme.colors.text }]}>
            {item.text}
          </Text>
          <LikeButton count={item.likes.length} liked={liked} onPress={onLike} size="sm" />
        </View>
      </View>
    </Card>
  );
});

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { competitions, addComment, currentUser, toggleCommentLike, toggleMediaLike } =
    useTournament();
  const [text, setText] = useState('');

  const matchData = useMemo(() => {
    for (const comp of competitions) {
      const match = comp.matches.find((m) => m.id === id);
      if (!match) continue;
      const team1 = comp.teams.find((t) => t.id === match.team1Id);
      const team2 = comp.teams.find((t) => t.id === match.team2Id);
      if (!team1 || !team2) continue;
      return { match, competition: comp, team1, team2 };
    }
    return null;
  }, [competitions, id]);

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => {
      const liked = !!currentUser && item.likes.includes(currentUser.id);
      return (
        <CommentCard
          item={item}
          liked={liked}
          onLike={() => toggleCommentLike(item.id)}
        />
      );
    },
    [currentUser, toggleCommentLike]
  );

  const send = useCallback(() => {
    if (!matchData || !text.trim()) return;
    addComment(text, undefined, {
      type: 'match',
      competitionId: matchData.competition.id,
      matchId: matchData.match.id,
    });
    setText('');
  }, [addComment, matchData, text]);

  if (!matchData) {
    return (
      <Screen contentStyle={styles.content} edges={['left', 'right']}>
        <EmptyState
          title={t('match.notFound')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
          icon="football-outline"
        />
      </Screen>
    );
  }

  const { match, competition, team1, team2 } = matchData;
  const played = isMatchPlayed(match);

  return (
    <Screen edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={match.comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <ListRow
                title={competition.name}
                subtitle={t('match.viewCompetition')}
                onPress={() =>
                  router.push(
                    `/(follower)/competitions/${competition.id}` as any
                  )
                }
              />
              <Card style={styles.matchCard}>
                <View style={styles.teamsRow}>
                  <View style={styles.teamCol}>
                    <Avatar uri={team1.logo} name={team1.name} size={56} />
                    <Text style={[styles.teamName, { color: theme.colors.text }]}>
                      {team1.name}
                    </Text>
                  </View>
                  <Text style={[styles.score, { color: theme.colors.text }]}>
                    {played
                      ? `${match.team1Score} - ${match.team2Score}`
                      : t('screens.vs')}
                  </Text>
                  <View style={styles.teamCol}>
                    <Avatar uri={team2.logo} name={team2.name} size={56} />
                    <Text style={[styles.teamName, { color: theme.colors.text }]}>
                      {team2.name}
                    </Text>
                  </View>
                </View>
                <Muted>{formatArabicDate(match.date)}</Muted>
                <Muted>{formatArabicTime(match.date)}</Muted>
                <Muted>
                  {played ? t('match.played') : t('match.upcoming')}
                </Muted>
              </Card>

              {(match.media?.photos?.length || match.media?.videos?.length) ? (
                <View style={{ gap: 8 }}>
                  <Subtitle>{t('match.media')}</Subtitle>
                  {(match.media?.photos || []).map((photo) => {
                    const src = String(photo.url || '').trim();
                    const liked =
                      !!currentUser && photo.likes.includes(currentUser.id);
                    return (
                      <Card key={photo.id} style={{ gap: 8 }}>
                        {src ? (
                          <Image
                            source={{ uri: src }}
                            style={styles.matchMedia}
                            contentFit="cover"
                            transition={200}
                            accessibilityLabel={t('common.photo')}
                          />
                        ) : (
                          <Muted>{t('match.mediaUnavailable')}</Muted>
                        )}
                        <LikeButton
                          count={photo.likes.length}
                          liked={liked}
                          onPress={() =>
                            toggleMediaLike(match.id, photo.id, 'photo', 'match')
                          }
                        />
                      </Card>
                    );
                  })}
                  {(match.media?.videos || []).map((video) => {
                    const src = String(video.url || '').trim();
                    const liked =
                      !!currentUser && video.likes.includes(currentUser.id);
                    return (
                      <Card key={video.id} style={{ gap: 8 }}>
                        {src ? (
                          <InlineVideoPlayer uri={src} height={220} />
                        ) : (
                          <Muted>{t('match.mediaUnavailable')}</Muted>
                        )}
                        <LikeButton
                          count={video.likes.length}
                          liked={liked}
                          onPress={() =>
                            toggleMediaLike(match.id, video.id, 'video', 'match')
                          }
                        />
                      </Card>
                    );
                  })}
                </View>
              ) : null}

              <Subtitle>{t('match.comments')}</Subtitle>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title={t('match.noComments')}
              description={t('match.noCommentsDesc')}
              icon="chatbubble-outline"
            />
          }
          renderItem={renderComment}
        />

        {currentUser?.permissions.canComment ? (
          <View
            style={[
              styles.composer,
              {
                borderTopColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
          >
            <Input
              value={text}
              onChangeText={setText}
              placeholder={t('match.commentPlaceholder')}
              multiline
            />
            <Button
              label={t('common.send')}
              onPress={send}
              disabled={!text.trim()}
            />
          </View>
        ) : (
          <View style={[styles.composer, { backgroundColor: theme.colors.surface }]}>
            <Muted>{t('match.commentsDisabled')}</Muted>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center' },
  list: { paddingTop: 12, gap: 10, paddingBottom: 20 },
  header: { gap: 12, marginBottom: 4 },
  matchCard: { alignItems: 'center', gap: 6 },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  teamCol: { alignItems: 'center', gap: 6, flex: 1 },
  teamName: { fontWeight: '700', fontSize: 13, textAlign: 'center' },
  score: { fontSize: 22, fontWeight: '800' },
  matchMedia: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#0b1220',
  },
  commentCard: { gap: 6 },
  commentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  author: { fontWeight: '800', textAlign: 'left', fontSize: 13 },
  commentText: { textAlign: 'left', lineHeight: 20 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
});
