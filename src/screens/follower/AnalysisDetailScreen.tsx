import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Avatar,
  Card,
  LikeButton,
  Muted,
  StatusBadge,
  Title,
} from '@/components/ui';
import { formatArabicDate } from '@/utils';

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { users, currentUser, toggleAnalysisLike } = useTournament();

  const found = useMemo(() => {
    for (const user of users) {
      const analysis = user.analysisContent.find((a) => a.id === id);
      if (analysis) return { user, analysis };
    }
    return null;
  }, [users, id]);

  if (!found) {
    return (
      <Screen contentStyle={styles.content}>
        <EmptyState
          title={t('analysis.notFound')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
          icon="document-text-outline"
        />
      </Screen>
    );
  }

  const { user, analysis } = found;
  const liked = currentUser
    ? analysis.likes.includes(currentUser.id)
    : false;

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Avatar uri={user.avatar} name={user.name} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.author, { color: theme.colors.text }]}>
            {user.name}
          </Text>
          <Muted>
            {t('analysis.analystMeta', {
              date: formatArabicDate(analysis.timestamp),
            })}
          </Muted>
        </View>
        {analysis.status ? <StatusBadge status={analysis.status} /> : null}
      </View>

      <Title>{analysis.title}</Title>

      {analysis.videoUrl ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('unique.playAnalysisVideoA11y')}
          onPress={() => {
            void Linking.openURL(analysis.videoUrl!).catch(() => undefined);
          }}
          style={[
            styles.videoBox,
            { backgroundColor: theme.colors.surfaceElevated },
          ]}
        >
          <Ionicons name="play-circle" size={56} color={theme.colors.accent} />
          <Muted>{t('media.analysisVideoTapPlay')}</Muted>
        </Pressable>
      ) : null}

      <Card style={styles.body}>
        <Text style={[styles.contentText, { color: theme.colors.text }]}>
          {analysis.content}
        </Text>
      </Card>

      <LikeButton
        count={analysis.likes.length}
        liked={liked}
        onPress={() => toggleAnalysisLike(user.id, analysis.id)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 14, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  author: { fontWeight: '800', textAlign: 'left' },
  body: { gap: 8 },
  contentText: {
    textAlign: 'left',
    lineHeight: 24,
    fontSize: 15,
  },
  videoBox: {
    height: 200,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
