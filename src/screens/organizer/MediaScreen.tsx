import React, { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import {
  ShareTargetModal,
  TinyShareButton,
  type ContentSharePayload,
} from '@/components/share/ShareTargetModal';
import { Button, Card, Chip, Input, Muted, Subtitle, Title } from '@/components/ui';
import {
  PROFILE_VIDEO_MAX_SEC,
  MEDIA_SPECS,
  validatePickerAsset,
  type MediaUploadKind,
} from '@/utils/media-limits';

type MediaItem = {
  id: string;
  url: string;
  kind: 'photo' | 'video';
  competitionName: string;
};

export default function MediaScreen() {
  const { competitions, currentUser, addCompetitionMedia } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [picking, setPicking] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
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

  const items = useMemo(() => {
    const media: MediaItem[] = [];
    myCompetitions.forEach((c) => {
      c.media.photos.forEach((p) =>
        media.push({
          id: p.id,
          url: p.url,
          kind: 'photo',
          competitionName: c.name,
        })
      );
      c.media.videos.forEach((v) =>
        media.push({
          id: v.id,
          url: v.url,
          kind: 'video',
          competitionName: c.name,
        })
      );
      c.teams.forEach((team) => {
        team.players.forEach((pl) => {
          pl.media.photos.forEach((p) =>
            media.push({
              id: `${pl.id}-${p.id}`,
              url: p.url,
              kind: 'photo',
              competitionName: c.name,
            })
          );
          pl.media.videos.forEach((v) =>
            media.push({
              id: `${pl.id}-${v.id}`,
              url: v.url,
              kind: 'video',
              competitionName: c.name,
            })
          );
        });
      });
    });
    return media;
  }, [myCompetitions]);

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
          addCompetitionMedia(
            activeCompetitionId,
            'videos',
            asset.uri,
            t('organizer.media.videoAdded')
          );
          return;
        }
        addCompetitionMedia(
          activeCompetitionId,
          'photos',
          asset.uri,
          t('organizer.media.photoAdded')
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
    [activeCompetitionId, addCompetitionMedia, t, toast]
  );

  return (
    <Screen scroll contentStyle={styles.content}>
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
                  onPress={() => setSelectedCompetitionId(c.id)}
                />
              ))}
            </View>

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
                if (
                  addCompetitionMedia(
                    activeCompetitionId,
                    'photos',
                    photoUrl.trim(),
                    t('organizer.media.photoAdded')
                  )
                ) {
                  setPhotoUrl('');
                }
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
                if (
                  addCompetitionMedia(
                    activeCompetitionId,
                    'videos',
                    videoUrl.trim(),
                    t('organizer.media.videoAdded')
                  )
                ) {
                  setVideoUrl('');
                }
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
                  <View
                    style={[
                      styles.videoPlaceholder,
                      { backgroundColor: theme.colors.inputBg },
                    ]}
                  >
                    <Text
                      style={{ color: theme.colors.accent, fontWeight: '800' }}
                    >
                      {t('common.video')}
                    </Text>
                  </View>
                )}
                <View style={styles.mediaShare}>
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
                </View>
              </View>
              <Subtitle>{item.competitionName}</Subtitle>
              <Muted>
                {item.kind === 'photo' ? t('common.photo') : t('common.video')}
              </Muted>
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
  mediaShare: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
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
