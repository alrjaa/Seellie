import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, Muted } from '@/components/ui';

/** Handle-only profile page — no account icon. */
export default function HandleProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { users } = useTournament();

  const user = useMemo(
    () => users.find((u) => u.id === id || u.handle === id),
    [users, id]
  );

  const roleLabel = useMemo(() => {
    if (!user) return '';
    const key = user.role as 'follower' | 'organizer' | 'freelancer' | 'superadmin';
    if (key in { follower: 1, organizer: 1, freelancer: 1, superadmin: 1 }) {
      return t(`roles.${key}`);
    }
    return user.role;
  }, [user, t]);

  if (!user) {
    return (
      <Screen contentStyle={styles.content}>
        <EmptyState
          title={t('handle.notFound')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
          icon="person-outline"
        />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={[styles.handle, { color: theme.colors.primary }]}>
          {user.handle}
        </Text>
        <Muted>{t('handle.regIdLine', { id: user.visibleId })}</Muted>
        <Muted>{roleLabel}</Muted>
      </Card>
      <Button
        label={t('common.back')}
        variant="ghost"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, gap: 16 },
  card: { gap: 8, alignItems: 'flex-end' },
  handle: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'left',
  },
});
