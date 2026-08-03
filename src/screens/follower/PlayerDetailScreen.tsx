import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useTournament,
  type Player,
  type User,
} from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PlayerMediaSection } from '@/components/media/PlayerMediaSection';
import {
  Avatar,
  Card,
  LikeButton,
  Muted,
  SectionHeader,
  StatusBadge,
  Subtitle,
  Title,
} from '@/components/ui';
import { userHasRole } from '@/utils/roles';

type PlayerInfo = {
  id: string;
  name: string;
  avatar?: string;
  teamName: string;
  jerseyNumber?: number;
  position?: string;
  status?: Player['status'];
  bio?: string;
  photos: { id: string; url: string; likes: string[]; timestamp?: Date }[];
  videos: { id: string; url: string; likes: string[]; timestamp?: Date }[];
  isFreelancer: boolean;
  user?: User;
};

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const {
    competitions,
    users,
    toggleAnalysisLike,
    currentUser,
    addUserMedia,
    removeUserMedia,
    setUserAvatar,
    toggleMediaLike,
  } = useTournament();

  const playerInfo = useMemo((): PlayerInfo | null => {
    for (const comp of competitions) {
      for (const team of comp.teams) {
        const player = team.players.find((p) => p.id === id);
        if (player) {
          return {
            id: player.id,
            name: player.name,
            avatar: player.avatar,
            teamName: team.name,
            jerseyNumber: player.jerseyNumber,
            position: player.position,
            status: player.status,
            bio: player.bio,
            photos: player.media?.photos || [],
            videos: player.media?.videos || [],
            isFreelancer: false,
          };
        }
      }
    }

    const user = users.find((u) => u.id === id && userHasRole(u, 'freelancer'));
    if (user) {
      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        teamName: t('roles.freelancer'),
        bio: user.bio,
        photos: user.media?.photos || [],
        videos: user.media?.videos || [],
        isFreelancer: true,
        user,
      };
    }

    return null;
  }, [competitions, users, id, t]);

  if (!playerInfo) {
    return (
      <Screen contentStyle={styles.content} edges={['left', 'right']}>
        <EmptyState
          title={t('player.notFound')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
          icon="person-outline"
        />
      </Screen>
    );
  }

  const isOwner =
    !!currentUser &&
    playerInfo.isFreelancer &&
    currentUser.id === playerInfo.id;
  const analyses = playerInfo.user?.analysisContent || [];

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.profile}>
        <Avatar uri={playerInfo.avatar} name={playerInfo.name} size={88} />
        <Title>{playerInfo.name}</Title>
        {playerInfo.user?.handle ? (
          <Muted>{playerInfo.user.handle}</Muted>
        ) : null}
        {playerInfo.user?.visibleId ? (
          <Muted>
            {t('player.regIdLine', { id: playerInfo.user.visibleId })}
          </Muted>
        ) : null}
        <Muted>{playerInfo.teamName}</Muted>
        {playerInfo.status ? (
          <StatusBadge status={playerInfo.status} />
        ) : null}
        {isOwner ? <Muted>{t('player.ownerHint')}</Muted> : null}
      </View>

      <Card style={styles.card}>
        {playerInfo.jerseyNumber ? (
          <View style={styles.infoRow}>
            <Muted>{t('player.jerseyNumber')}</Muted>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {playerInfo.jerseyNumber}
            </Text>
          </View>
        ) : null}
        {playerInfo.position ? (
          <View style={styles.infoRow}>
            <Muted>{t('player.position')}</Muted>
            <Text style={[styles.value, { color: theme.colors.text }]}>
              {playerInfo.position}
            </Text>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Muted>{t('player.photos')}</Muted>
          <Text style={[styles.value, { color: theme.colors.text }]}>
            {playerInfo.photos.length}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Muted>{t('player.videos')}</Muted>
          <Text style={[styles.value, { color: theme.colors.text }]}>
            {playerInfo.videos.length}
          </Text>
        </View>
        {playerInfo.bio ? (
          <View style={styles.bio}>
            <Muted>{t('account.bio')}</Muted>
            <Text style={[styles.bioText, { color: theme.colors.text }]}>
              {playerInfo.bio}
            </Text>
          </View>
        ) : null}
      </Card>

      <PlayerMediaSection
        photos={playerInfo.photos}
        videos={playerInfo.videos}
        editable={isOwner}
        currentUserId={currentUser?.id}
        onAddPhoto={(url) =>
          addUserMedia('photos', url, t('freelancer.photoAddedToProfile'))
        }
        onAddVideo={(url) =>
          addUserMedia('videos', url, t('freelancer.videoAddedToProfile'))
        }
        onRemovePhoto={(mediaId) =>
          removeUserMedia('photos', mediaId, t('freelancer.photoRemoved'))
        }
        onRemoveVideo={(mediaId) =>
          removeUserMedia('videos', mediaId, t('freelancer.videoRemoved'))
        }
        onSetAvatar={(url) =>
          setUserAvatar(url, t('freelancer.avatarSet'))
        }
        onTogglePhotoLike={(mediaId) =>
          toggleMediaLike(
            playerInfo.id,
            mediaId,
            'photo',
            playerInfo.isFreelancer ? 'user' : 'player'
          )
        }
        onToggleVideoLike={(mediaId) =>
          toggleMediaLike(
            playerInfo.id,
            mediaId,
            'video',
            playerInfo.isFreelancer ? 'user' : 'player'
          )
        }
      />

      {playerInfo.isFreelancer && analyses.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title={t('player.analyses')} />
          {analyses.map((analysis) => {
            const liked =
              currentUser != null && analysis.likes.includes(currentUser.id);
            return (
              <Card key={analysis.id} style={styles.analysisCard}>
                <Subtitle>{analysis.title}</Subtitle>
                <Text
                  style={[styles.analysisBody, { color: theme.colors.text }]}
                >
                  {analysis.content}
                </Text>
                <LikeButton
                  count={analysis.likes.length}
                  liked={liked}
                  onPress={() =>
                    toggleAnalysisLike(playerInfo.id, analysis.id)
                  }
                />
              </Card>
            );
          })}
        </View>
      ) : playerInfo.isFreelancer ? (
        <EmptyState
          title={t('player.noAnalyses')}
          description={t('player.noAnalysesDesc')}
          icon="analytics-outline"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 20, paddingBottom: 40 },
  profile: { alignItems: 'center', gap: 8 },
  card: { gap: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  value: { fontWeight: '800', textAlign: 'left' },
  bio: { gap: 6 },
  bioText: { textAlign: 'left', lineHeight: 22 },
  section: { gap: 10 },
  analysisCard: { gap: 8 },
  analysisBody: { textAlign: 'left', lineHeight: 22 },
  like: { fontWeight: '800', textAlign: 'left' },
});
