import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import {
  ShareTargetModal,
  TinyShareButton,
  type ContentSharePayload,
} from '@/components/share/ShareTargetModal';
import { Button, Card, Chip, Input, Muted, Subtitle, Title } from '@/components/ui';
import { confirmDestructive } from '@/utils/confirm';
import {
  PROFILE_VIDEO_MAX_SEC,
  MEDIA_SPECS,
  validatePickerAsset,
  type MediaUploadKind,
} from '@/utils/media-limits';

type MediaItem = {
  id: string;
  mediaId: string;
  competitionId: string;
  matchId?: string;
  playerId?: string;
  url: string;
  kind: 'photo' | 'video';
  competitionName: string;
  label?: string;
};

export default function MediaScreen() {
  const {
    competitions,
    currentUser,
    addCompetitionMedia,
    removeCompetitionMedia,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [picking, setPicking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<ContentSharePayload | null>(
    null
  );
  const myCompetitions = useMemo(
    () =>
      currentUser
        ? competitions.filter((c) => c.organizerId === currentUser.id)
        : [],
    [competitions, currentUser]
  );

  const [selectedCompetitionId, setSelectedCompetitionId] = useState(
    () => myCompetitions[0]?.id || ''
  );

  const activeCompetitionId =
    selectedCompetitionId || myCompetitions[0]?.id || '';

  const activeCompetition = useMemo(
    () => myCompetitions.find((c) => c.id === activeCompetitionId) || null,
    [myCompetitions, activeCompetitionId]
  );

  const matchOptions = useMemo(() => {
    if (!activeCompetition) return [];
    return activeCompetition.matches.map((m) => {
      const t1 =
        activeCompetition.teams.find((x) => x.id === m.team1Id)?.name || '؟';
      const t2 =
        activeCompetition.teams.find((x) => x.id === m.team2Id)?.name || '؟';
      return { id: m.id, label: `${t1} × ${t2}` };
    });
  }, [activeCompetition]);

  const items = useMemo(() => {
    const media: MediaItem[] = [];
    myCompetitions.forEach((c) => {
      (c.media?.photos || []).forEach((p) =>
        media.push({
          id: `comp-photo-${c.id}-${p.id}`,
          mediaId: p.id,
          competitionId: c.id,
          url: p.url,
          kind: 'photo',
          competitionName: c.name,
          label: t('organizer.media.scopeCompetition'),
        })
      );
      (c.media?.videos || []).forEach((v) =>
        media.push({
          id: `comp-video-${c.id}-${v.id}`,
          mediaId: v.id,
          competitionId: c.id,
          url: v.url,
          kind: 'video',
          competitionName: c.name,
          label: t('organizer.media.scopeCompetition'),
        })
      );

      c.matches.forEach((match) => {
        const t1 = c.teams.find((x) => x.id === match.team1Id)?.name || '?';
        const t2 = c.teams.find((x) => x.id === match.team2Id)?.name || '?';
        const matchLabel = `${t1} × ${t2}`;
        (match.media?.photos || []).forEach((p) =>
          media.push({
            id: `match-photo-${match.id}-${p.id}`,
            mediaId: p.id,
            competitionId: c.id,
            matchId: match.id,
            url: p.url,
            kind: 'photo',
            competitionName: c.name,
            label: matchLabel,
          })
        );
        (match.media?.videos || []).forEach((v) =>
          media.push({
            id: `match-video-${match.id}-${v.id}`,
            mediaId: v.id,
            competitionId: c.id,
            matchId: match.id,
            url: v.url,
            kind: 'video',
            competitionName: c.name,
            label: matchLabel,
          })
        );
      });

      c.teams.forEach((team) => {
        team.players.forEach((pl) => {
          (pl.media?.photos || []).forEach((p) =>
            media.push({
              id: `player-photo-${pl.id}-${p.id}`,
              mediaId: p.id,
              competitionId: c.id,
              playerId: pl.id,
              url: p.url,
              kind: 'photo',
              competitionName: c.name,
              label: `${pl.name} · ${team.name}`,
            })
          );
          (pl.media?.videos || []).forEach((v) =>
            media.push({
              id: `player-video-${pl.id}-${v.id}`,
              mediaId: v.id,
              competitionId: c.id,
              playerId: pl.id,
              url: v.url,
              kind: 'video',
              competitionName: c.name,
              label: `${pl.name} · ${team.name}`,
            })
          );
        });
      });
    });
    return media;
  }, [myCompetitions, t]);

  const confirmDelete = useCallback(
    async (item: MediaItem) => {
      if (deletingId) return;
      const ok = await confirmDestructive({
        title: t('organizer.media.deleteTitle'),
        message: t('organizer.media.deleteConfirm', {
          kind:
            item.kind === 'photo' ? t('common.photo') : t('common.video'),
        }),
        cancelLabel: t('common.cancel'),
        confirmLabel: t('common.delete'),
      });
      if (!ok) return;

      setDeletingId(item.id);
      try {
        await removeCompetitionMedia({
          competitionId: item.competitionId,
          mediaId: item.mediaId,
          type: item.kind === 'photo' ? 'photos' : 'videos',
          matchId: item.matchId,
          playerId: item.playerId,
        });
      } finally {
        setDeletingId(null);
      }
    },
    [removeCompetitionMedia, t, deletingId]
  );

  const pickFromLibrary = useCallback(
    async (kind: 'photo' | 'video') => {
      if (!activeCompetitionId) {
        toast({
          variant: 'destructive',
          title: t('organizer.media.needCompetition'),
        });
        return;
      }
      setPicking(true);
      try {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          toast({
            variant: 'destructive',
            title: t('media.permissionDenied'),
            description: t('media.allowLibrary'),
          });
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            kind === 'photo'
              ? ImagePicker.MediaTypeOptions.Images
              : ImagePicker.MediaTypeOptions.Videos,
          quality: 0.85,
          allowsEditing: kind === 'photo',
          aspect: kind === 'photo' ? [1, 1] : undefined,
          videoMaxDuration:
            kind === 'video' ? PROFILE_VIDEO_MAX_SEC : undefined,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const asset = result.assets[0];
        const validateKind: MediaUploadKind =
          kind === 'photo' ? 'photo' : 'video';
        const check = validatePickerAsset(validateKind, {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          duration: asset.duration,
        });
        if (!check.ok) {
          if (check.reason === 'duration') {
            toast({
              variant: 'destructive',
              title: t('media.videoTooLong'),
              description: t('media.videoTooLongDesc', {
                sec: PROFILE_VIDEO_MAX_SEC,
              }),
            });
          } else if (check.reason === 'size') {
            toast({
              variant: 'destructive',
              title: t('media.fileTooLarge'),
              description: t('media.fileTooLargeDesc', {
                mb: MEDIA_SPECS[validateKind].maxMb,
              }),
            });
          } else {
            toast({
              variant: 'destructive',
              title: t('media.imageTooSmall'),
              description: t('media.imageTooSmallDesc', {
                w: (MEDIA_SPECS.photo as { width: number }).width,
              }),
            });
          }
          return;
        }
        if (kind === 'video') {
          await addCompetitionMedia(
            activeCompetitionId,
            'videos',
            asset.uri,
            t('organizer.media.videoAdded'),
            selectedMatchId || undefined
          );
          return;
        }
        await addCompetitionMedia(
          activeCompetitionId,
          'photos',
          asset.uri,
          t('organizer.media.photoAdded'),
          selectedMatchId || undefined
        );
      } catch {
        toast({
          variant: 'destructive',
          title: t('media.pickFailed'),
          description: t('media.pickFailedHint'),
        });
      } finally {
        setPicking(false);
      }
    },
    [activeCompetitionId, addCompetitionMedia, selectedMatchId, t, toast]
  );

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('organizer.media.title')}</Title>
      <Muted>{t('organizer.media.subtitle')}</Muted>

      <Card style={styles.card}>
        <Subtitle>{t('organizer.media.uploadTitle')}</Subtitle>
        <Muted>{t('organizer.media.uploadHint')}</Muted>

        {myCompetitions.length === 0 ? (
          <EmptyState
            title={t('organizer.media.noCompetitions')}
            description={t('organizer.media.noCompetitionsDesc')}
            icon="trophy-outline"
          />
        ) : (
          <>
            <Muted>{t('organizer.media.selectCompetition')}</Muted>
            <View style={styles.chips}>
              {myCompetitions.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  active={c.id === activeCompetitionId}
                  onPress={() => {
                    setSelectedCompetitionId(c.id);
                    setSelectedMatchId(null);
                  }}
                />
              ))}
            </View>

            {matchOptions.length > 0 ? (
              <>
                <Muted>{t('organizer.media.selectMatchOptional')}</Muted>
                <View style={styles.chips}>
                  <Chip
                    label={t('organizer.media.wholeCompetition')}
                    active={!selectedMatchId}
                    onPress={() => setSelectedMatchId(null)}
                  />
                  {matchOptions.map((m) => (
                    <Chip
                      key={m.id}
                      label={m.label}
                      active={selectedMatchId === m.id}
                      onPress={() => setSelectedMatchId(m.id)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <MediaUploadSpecs
              kind="photo"
              title={t('media.specs.photoTitle')}
            />
            <MediaUploadSpecs
              kind="logo"
              title={t('media.specs.logoTitle')}
              compact
            />
            <Button
              label={
                picking ? t('media.picking') : t('media.pickPhotoFromDevice')
              }
              variant="secondary"
              loading={picking}
              onPress={() => void pickFromLibrary('photo')}
            />
            <Input
              label={t('media.photoUrlLabel')}
              value={photoUrl}
              onChangeText={setPhotoUrl}
              placeholder="https://..."
              autoCapitalize="none"
              ltr
            />
            <Button
              label={t('media.addPhoto')}
              onPress={() => {
                void (async () => {
                  const ok = await addCompetitionMedia(
                    activeCompetitionId,
                    'photos',
                    photoUrl.trim(),
                    t('organizer.media.photoAdded'),
                    selectedMatchId || undefined
                  );
                  if (ok) setPhotoUrl('');
                })();
              }}
            />

            <MediaUploadSpecs
              kind="video"
              title={t('media.specs.videoTitle')}
            />
            <Button
              label={
                picking ? t('media.picking') : t('media.pickVideoFromDevice')
              }
              variant="secondary"
              loading={picking}
              onPress={() => void pickFromLibrary('video')}
            />
            <Input
              label={t('media.videoUrlLabel')}
              value={videoUrl}
              onChangeText={setVideoUrl}
              placeholder="https://..."
              autoCapitalize="none"
              ltr
            />
            <Button
              label={t('media.addVideo')}
              onPress={() => {
                void (async () => {
                  const ok = await addCompetitionMedia(
                    activeCompetitionId,
                    'videos',
                    videoUrl.trim(),
                    t('organizer.media.videoAdded'),
                    selectedMatchId || undefined
                  );
                  if (ok) setVideoUrl('');
                })();
              }}
            />
          </>
        )}
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title={t('organizer.media.empty')}
          description={t('organizer.media.emptyDesc')}
          icon="images-outline"
        />
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <Card key={item.id} style={styles.tile}>
              <View style={styles.mediaWrap}>
                {item.kind === 'photo' ? (
                  <Image source={{ uri: item.url }} style={styles.image} />
                ) : (
                  <InlineVideoPlayer uri={item.url} height={160} style={styles.image} />
                )}
                <View style={styles.mediaActions}>
                  <TinyShareButton
                    onPress={() =>
                      setSharePayload({
                        kind: 'content',
                        title: item.competitionName,
                        mediaUrl: item.url,
                        mediaKind: item.kind,
                      })
                    }
                  />
                  <Pressable
                    onPress={() => void confirmDelete(item)}
                    disabled={deletingId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={t('organizer.media.deleteA11y')}
                    hitSlop={8}
                    style={[
                      styles.deleteBtn,
                      {
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        opacity: deletingId === item.id ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                  </Pressable>
                </View>
              </View>
              <Subtitle>{item.competitionName}</Subtitle>
              <Muted>
                {item.kind === 'photo' ? t('common.photo') : t('common.video')}
                {item.label ? ` · ${item.label}` : ''}
              </Muted>
              <Button
                label={
                  deletingId === item.id
                    ? t('common.loading')
                    : t('common.delete')
                }
                variant="danger"
                size="sm"
                onPress={() => void confirmDelete(item)}
                disabled={deletingId === item.id}
                loading={deletingId === item.id}
              />
            </Card>
          ))}
        </View>
      )}
      <ShareTargetModal
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', gap: 6, flexGrow: 1, minWidth: 150 },
  mediaWrap: { position: 'relative' },
  mediaActions: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: 120, borderRadius: 10 },
  videoPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
