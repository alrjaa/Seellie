import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
} from '@/components/ui';
import { cairoText } from '@/theme/fonts';
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

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.statPill,
        {
          backgroundColor: accent
            ? theme.colors.accentSoft
            : theme.colors.surfaceElevated,
          borderColor: accent ? theme.colors.accentMuted : theme.colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.statValue,
          { color: accent ? theme.colors.accent : theme.colors.text },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

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
  const totalLikes =
    playerInfo.photos.reduce((s, p) => s + p.likes.length, 0) +
    playerInfo.videos.reduce((s, v) => s + v.likes.length, 0);

  const metaParts = playerInfo.isFreelancer
    ? ([
        playerInfo.user?.handle?.trim(),
        playerInfo.user?.city?.trim(),
      ].filter(Boolean) as string[])
    : ([
        playerInfo.teamName,
        playerInfo.position,
        playerInfo.jerseyNumber != null
          ? `#${playerInfo.jerseyNumber}`
          : null,
      ].filter(Boolean) as string[]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Card style={styles.heroCard} padded={false}>
        <View
          style={[
            styles.heroBand,
            {
              backgroundColor: playerInfo.isFreelancer
                ? theme.colors.accentSoft
                : theme.colors.surfaceElevated,
            },
          ]}
        />
        <View style={styles.heroBody}>
          <View style={styles.heroTop}>
            <View
              style={[
                styles.avatarRing,
                {
                  borderColor: theme.colors.card,
                  backgroundColor: theme.colors.card,
                },
              ]}
            >
              <Avatar
                uri={playerInfo.avatar}
                name={playerInfo.name}
                size={88}
              />
            </View>
            <View style={styles.heroIdentity}>
              {playerInfo.isFreelancer ? (
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.accentMuted,
                    },
                  ]}
                >
                  <Ionicons
                    name="flash"
                    size={12}
                    color={theme.colors.accent}
                  />
                  <Text
                    style={[styles.roleBadgeText, { color: theme.colors.accent }]}
                  >
                    {t('home.freelancerPlayer')}
                  </Text>
                </View>
              ) : null}
              <Text
                style={[styles.heroName, { color: theme.colors.text }]}
                numberOfLines={2}
              >
                {playerInfo.name}
              </Text>
              {metaParts.length > 0 ? (
                <Text
                  style={[styles.heroMeta, { color: theme.colors.textMuted }]}
                  numberOfLines={2}
                >
                  {metaParts.join('  ·  ')}
                </Text>
              ) : null}
              {playerInfo.user?.visibleId ? (
                <Text
                  style={[styles.regId, { color: theme.colors.textMuted }]}
                >
                  {t('player.regIdLine', { id: playerInfo.user.visibleId })}
                </Text>
              ) : null}
              {playerInfo.status ? (
                <View style={{ marginTop: 4 }}>
                  <StatusBadge status={playerInfo.status} />
                </View>
              ) : null}
            </View>
          </View>

          {playerInfo.bio ? (
            <View style={styles.bioBlock}>
              <Text style={[styles.bioLabel, { color: theme.colors.textMuted }]}>
                {t('account.bio')}
              </Text>
              <Text style={[styles.bioText, { color: theme.colors.text }]}>
                {playerInfo.bio}
              </Text>
            </View>
          ) : null}

          <View style={styles.statsGrid}>
            <StatPill
              label={t('player.photos')}
              value={playerInfo.photos.length}
            />
            <StatPill
              label={t('player.videos')}
              value={playerInfo.videos.length}
            />
            <StatPill
              label={t('player.likesStat')}
              value={totalLikes}
              accent
            />
          </View>

          {isOwner ? (
            <View
              style={[
                styles.ownerNote,
                { backgroundColor: theme.colors.surfaceElevated },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={theme.colors.textMuted}
              />
              <Muted style={styles.ownerHint}>{t('player.ownerHint')}</Muted>
            </View>
          ) : null}
        </View>
      </Card>

      {!playerInfo.isFreelancer &&
      (playerInfo.jerseyNumber != null || playerInfo.position) ? (
        <Card style={styles.card}>
          {playerInfo.jerseyNumber != null ? (
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
        </Card>
      ) : null}

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
  content: { paddingTop: 12, gap: 16, paddingBottom: 40 },
  heroCard: {
    overflow: 'hidden',
  },
  heroBand: {
    height: 72,
  },
  heroBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
    marginTop: -36,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  avatarRing: {
    borderRadius: 52,
    borderWidth: 3,
    padding: 2,
  },
  heroIdentity: {
    flex: 1,
    gap: 4,
    minWidth: 0,
    paddingBottom: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  roleBadgeText: {
    ...cairoText('semiBold'),
    fontSize: 11,
    textAlign: 'left',
  },
  heroName: {
    ...cairoText('extraBold'),
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'left',
  },
  heroMeta: {
    ...cairoText('medium'),
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'left',
  },
  regId: {
    ...cairoText('regular'),
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
  },
  bioBlock: {
    gap: 6,
    paddingTop: 2,
  },
  bioLabel: {
    ...cairoText('semiBold'),
    fontSize: 11,
    letterSpacing: 0.3,
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  bioText: {
    ...cairoText('regular'),
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'left',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: {
    ...cairoText('extraBold'),
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  statLabel: {
    ...cairoText('medium'),
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  ownerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 12,
  },
  ownerHint: {
    flex: 1,
    textAlign: 'left',
    lineHeight: 18,
  },
  card: { gap: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  value: {
    ...cairoText('bold'),
    textAlign: 'left',
  },
  section: { gap: 10 },
  analysisCard: { gap: 8 },
  analysisBody: {
    ...cairoText('regular'),
    textAlign: 'left',
    lineHeight: 22,
  },
});
