import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Screen } from '@/components/layout/Screen';
import { PlayerMediaSection } from '@/components/media/PlayerMediaSection';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import {
  Avatar,
  Card,
  Muted,
  Subtitle,
  Title,
} from '@/components/ui';

/** Own player profile for freelancers — manage photos/videos from account. */
export default function FreelancerProfileScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const {
    currentUser,
    loading,
    routeForRole,
    addUserMedia,
    removeUserMedia,
    setUserAvatar,
    toggleMediaLike,
  } = useTournament();

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  if (currentUser.role !== 'freelancer') {
    return <Redirect href={routeForRole(currentUser.role) as any} />;
  }

  const photos = currentUser.media?.photos || [];
  const videos = currentUser.media?.videos || [];

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.profile}>
        <Avatar uri={currentUser.avatar} name={currentUser.name} size={88} />
        <Title>{currentUser.name}</Title>
        <Muted>{currentUser.handle}</Muted>
        <Muted>{t('freelancer.regIdLabel', { id: currentUser.visibleId })}</Muted>
      </View>

      <Card style={styles.card}>
        <Subtitle>{t('freelancer.bio')}</Subtitle>
        <Text style={[styles.bio, { color: theme.colors.text }]}>
          {currentUser.bio || t('freelancer.addBioHint')}
        </Text>
        <View style={styles.infoRow}>
          <Muted>{t('screens.photos')}</Muted>
          <Text style={[styles.value, { color: theme.colors.text }]}>
            {photos.length}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Muted>{t('screens.videos')}</Muted>
          <Text style={[styles.value, { color: theme.colors.text }]}>
            {videos.length}
          </Text>
        </View>
      </Card>

      <Muted>{t('freelancer.manageMediaHint')}</Muted>

      <PlayerMediaSection
        photos={photos}
        videos={videos}
        editable
        currentUserId={currentUser.id}
        onAddPhoto={(url) =>
          addUserMedia('photos', url, t('freelancer.photoAddedToProfile'))
        }
        onAddVideo={(url) =>
          addUserMedia('videos', url, t('freelancer.videoAddedToProfile'))
        }
        onRemovePhoto={(id) =>
          removeUserMedia('photos', id, t('freelancer.photoRemoved'))
        }
        onRemoveVideo={(id) =>
          removeUserMedia('videos', id, t('freelancer.videoRemoved'))
        }
        onSetAvatar={(url) =>
          setUserAvatar(url, t('freelancer.avatarSet'))
        }
        onTogglePhotoLike={(id) =>
          toggleMediaLike(currentUser.id, id, 'photo', 'user')
        }
        onToggleVideoLike={(id) =>
          toggleMediaLike(currentUser.id, id, 'video', 'user')
        }
      />

      <AccountSocialStats user={currentUser} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 16, paddingBottom: 100 },
  profile: { alignItems: 'center', gap: 8 },
  card: { gap: 10 },
  bio: { textAlign: 'left', lineHeight: 22 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  value: { fontWeight: '800' },
});
