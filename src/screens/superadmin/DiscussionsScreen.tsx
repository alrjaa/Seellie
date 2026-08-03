import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ReasonModal } from '@/components/feedback/ReasonModal';
import { Avatar, Card, LikeButton, Muted, Subtitle } from '@/components/ui';

type DiscussionStatus = 'active' | 'warned' | 'suspended' | 'blocked';

type FeedItem = {
  key: string;
  type: 'comment' | 'analysis';
  id: string;
  authorId: string;
  author: string;
  avatar?: string;
  title: string;
  text: string;
  likes: string[];
  typeLabel: string;
  status: DiscussionStatus;
  statusReason?: string;
};

type PendingAction = {
  item: FeedItem;
  status: DiscussionStatus;
};

const DiscussionCard = memo(function DiscussionCard({
  item,
  liked,
  onLike,
  onAction,
}: {
  item: FeedItem;
  liked: boolean;
  onLike: () => void;
  onAction: (item: FeedItem, status: DiscussionStatus) => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const statusColor =
    item.status === 'active'
      ? theme.colors.primary
      : item.status === 'warned'
        ? theme.colors.warning
        : theme.colors.danger;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={item.avatar} name={item.author} size={40} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {item.title}
          </Text>
          <Muted>
            {item.author} · {item.typeLabel}
          </Muted>
          <Text
            style={[styles.body, { color: theme.colors.text }]}
            numberOfLines={3}
          >
            {item.text}
          </Text>
          <LikeButton
            count={item.likes.length}
            liked={liked}
            onPress={onLike}
            size="sm"
          />
          <Text
            style={{
              color: statusColor,
              fontWeight: '800',
              fontSize: 12,
              textAlign: 'left',
            }}
          >
            {t('superadmin.discussions.statusLine', {
              status: t(`superadmin.discussions.discussionStatus.${item.status}`),
            })}
          </Text>
          {item.statusReason ? (
            <Muted>
              {t('superadmin.discussions.reasonLine', {
                reason: item.statusReason,
              })}
            </Muted>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => onAction(item, 'active')}>
          <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 12 }}>
            {t('superadmin.actions.activate')}
          </Text>
        </Pressable>
        <Pressable onPress={() => onAction(item, 'warned')}>
          <Text style={{ color: theme.colors.warning, fontWeight: '800', fontSize: 12 }}>
            {t('superadmin.actions.issueWarn')}
          </Text>
        </Pressable>
        <Pressable onPress={() => onAction(item, 'suspended')}>
          <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 12 }}>
            {t('superadmin.actions.suspend')}
          </Text>
        </Pressable>
        <Pressable onPress={() => onAction(item, 'blocked')}>
          <Text style={{ color: theme.colors.danger, fontWeight: '900', fontSize: 12 }}>
            {t('superadmin.actions.block')}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
});

export default function DiscussionsScreen() {
  const {
    comments,
    users,
    currentUser,
    updateDiscussionStatus,
    toggleCommentLike,
    toggleAnalysisLike,
  } = useTournament();
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingAction | null>(null);

  const feed = useMemo<FeedItem[]>(() => {
    const analyses = users.flatMap((u) =>
      u.analysisContent.map((a) => ({
        key: `a-${a.id}`,
        type: 'analysis' as const,
        id: a.id,
        authorId: u.id,
        author: u.name,
        avatar: u.avatar,
        title: a.title,
        text: a.content,
        likes: a.likes,
        typeLabel: t('superadmin.discussions.typeAnalysis'),
        status: (a.status || 'active') as DiscussionStatus,
        statusReason: a.statusReason,
      }))
    );
    const general = comments.map((c) => ({
      key: `c-${c.id}`,
      type: 'comment' as const,
      id: c.id,
      authorId: c.authorId,
      author: c.authorName,
      avatar: c.authorAvatar,
      title: t('superadmin.discussions.generalCommentTitle'),
      text: c.text,
      likes: c.likes,
      typeLabel: t('superadmin.discussions.typeComment'),
      status: (c.status || 'active') as DiscussionStatus,
      statusReason: c.statusReason,
    }));
    return [...analyses, ...general];
  }, [users, comments, t]);

  const onAction = useCallback((item: FeedItem, status: DiscussionStatus) => {
    setPending({ item, status });
  }, []);

  const onLike = useCallback(
    (item: FeedItem) => {
      if (item.type === 'analysis') {
        toggleAnalysisLike(item.authorId, item.id);
      } else {
        toggleCommentLike(item.id);
      }
    },
    [toggleAnalysisLike, toggleCommentLike]
  );
  const modalMeta = useMemo(() => {
    if (!pending) return null;
    if (pending.status === 'active') {
      return {
        title: t('superadmin.discussions.modals.activateContent'),
        description: t('superadmin.discussions.modals.reactivateDesc', {
          title: pending.item.title,
        }),
        requireReason: false,
        confirmLabel: t('superadmin.actions.activate'),
        destructive: false,
        reasonLabel: t('superadmin.labels.reason'),
      };
    }
    if (pending.status === 'warned') {
      return {
        title: t('superadmin.discussions.modals.warnContent'),
        description: t('superadmin.discussions.modals.warnDesc'),
        requireReason: true,
        confirmLabel: t('superadmin.discussions.modals.confirmWarn'),
        destructive: false,
        reasonLabel: t('superadmin.discussions.modals.warnReason'),
      };
    }
    if (pending.status === 'suspended') {
      return {
        title: t('superadmin.discussions.modals.suspendContent'),
        description: t('superadmin.discussions.modals.suspendDesc'),
        requireReason: true,
        confirmLabel: t('superadmin.discussions.modals.confirmSuspend'),
        destructive: true,
        reasonLabel: t('superadmin.discussions.modals.suspendReason'),
      };
    }
    return {
      title: t('superadmin.discussions.modals.blockContent'),
      description: t('superadmin.discussions.modals.blockDesc'),
      requireReason: true,
      confirmLabel: t('superadmin.discussions.modals.confirmBlock'),
      destructive: true,
      reasonLabel: t('superadmin.discussions.modals.blockReason'),
    };
  }, [pending, t]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <DiscussionCard
        item={item}
        liked={!!currentUser && item.likes.includes(currentUser.id)}
        onLike={() => onLike(item)}
        onAction={onAction}
      />
    ),
    [currentUser, onAction, onLike]
  );

  return (
    <Screen>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Subtitle>{t('superadmin.modules.discussions.title')}</Subtitle>
            <Muted>{t('superadmin.discussions.subtitle')}</Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('superadmin.discussions.empty')}
            icon="chatbox-ellipses-outline"
          />
        }
        renderItem={renderItem}
      />

      {modalMeta && pending ? (
        <ReasonModal
          visible
          title={modalMeta.title}
          description={modalMeta.description}
          requireReason={modalMeta.requireReason}
          reasonLabel={modalMeta.reasonLabel}
          confirmLabel={modalMeta.confirmLabel}
          destructive={modalMeta.destructive}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => {
            updateDiscussionStatus(
              {
                type: pending.item.type,
                id: pending.item.id,
                authorId: pending.item.authorId,
                status: pending.status,
                reason,
              },
              pending.status === 'active'
                ? t('superadmin.discussions.toasts.activated')
                : pending.status === 'warned'
                  ? t('superadmin.discussions.toasts.warned')
                  : pending.status === 'suspended'
                    ? t('superadmin.discussions.toasts.suspended')
                    : t('superadmin.discussions.toasts.blocked')
            );
            setPending(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  title: { fontWeight: '800', textAlign: 'left' },
  body: { textAlign: 'left', writingDirection: 'ltr', lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'flex-end',
  },
});
