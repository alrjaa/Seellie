import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import { PlayerMediaSection } from '@/components/media/PlayerMediaSection';
import { Avatar, Button, Card, Muted, Subtitle } from '@/components/ui';
import { ensureSocialLists } from '@/utils/social-stats';

/** ملف عام موحّد — يظهر لكل الأدوار عبر /profile/[id] */
export default function HandleProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { users, currentUser, toggleFollowUser } = useTournament();

  const user = useMemo(
    () => users.find((u) => u.id === id || u.handle === id),
    [users, id]
  );

  const roleLabel = useMemo(() => {
    if (!user) return '';
    const key = user.role as
      | 'follower'
      | 'organizer'
      | 'freelancer'
      | 'superadmin';
    if (key in { follower: 1, organizer: 1, freelancer: 1, superadmin: 1 }) {
      return t(`roles.${key}`);
    }
    return user.role;
  }, [user, t]);

  const isOwn = !!currentUser && !!user && currentUser.id === user.id;
  const isFollowing = useMemo(() => {
    if (!currentUser || !user || isOwn) return false;
    return ensureSocialLists(currentUser).following!.includes(user.id);
  }, [currentUser, user, isOwn]);

  const photos = user?.media?.photos || [];
  const videos = user?.media?.videos || [];

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
    <Screen scroll contentStyle={styles.content}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Avatar uri={user.avatar} name={user.name} size={72} />
          <Text
            style={[
              styles.name,
              {
                color: theme.colors.text,
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}
          >
            {user.name}
          </Text>
          <Text
            style={[
              styles.handle,
              {
                color: theme.colors.accent,
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}
          >
            {user.handle}
          </Text>
          <Muted>{t('handle.regIdLine', { id: user.visibleId })}</Muted>
          <Muted>{roleLabel}</Muted>
          {user.bio ? (
            <Muted style={{ marginTop: 4 }}>{user.bio}</Muted>
          ) : null}
        </View>

        {!isOwn && currentUser ? (
          <Button
            label={
              isFollowing
                ? t('account.stats.unfollow')
                : t('account.stats.follow')
            }
            variant={isFollowing ? 'outline' : 'primary'}
            onPress={() => toggleFollowUser(user.id)}
          />
        ) : null}
      </Card>

      <AccountSocialStats
        user={user}
        title={
          isOwn ? t('account.stats.title') : t('account.stats.titleOther')
        }
      />

      {(photos.length > 0 || videos.length > 0) && (
        <>
          <Subtitle>{t('media.photoGallery')}</Subtitle>
          <PlayerMediaSection
            photos={photos}
            videos={videos}
            editable={false}
            currentUserId={currentUser?.id}
          />
        </>
      )}

      <Button
        label={t('common.back')}
        variant="ghost"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 24, gap: 16, paddingBottom: 40 },
  card: { gap: 12 },
  header: { gap: 6, alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '800' },
  handle: { fontSize: 16, fontWeight: '700' },
});
