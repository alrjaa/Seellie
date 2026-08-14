import React, { memo, useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import {
  ShareTargetModal,
  TinyShareButton,
  type ContentSharePayload,
} from '@/components/share/ShareTargetModal';
import { Button, Card, Input, LikeButton, Muted, Subtitle } from '@/components/ui';
import { confirmDestructive } from '@/utils/confirm';
import {
  PROFILE_VIDEO_MAX_SEC,
  MEDIA_SPECS,
  validatePickerAsset,
  type MediaUploadKind,
} from '@/utils/media-limits';

export type MediaItem = {
  id: string;
  url: string;
  timestamp?: Date;
  likes: string[];
};

type Props = {
  photos: MediaItem[];
  videos: MediaItem[];
  /** When true, show add/remove controls (owner managing their account). */
  editable?: boolean;
  currentUserId?: string;
  onAddPhoto?: (url: string) => boolean | void | Promise<boolean | void>;
  onAddVideo?: (url: string) => boolean | void | Promise<boolean | void>;
  onRemovePhoto?: (id: string) => void | Promise<void | boolean>;
  onRemoveVideo?: (id: string) => void | Promise<void | boolean>;
  onSetAvatar?: (url: string) => void | Promise<void | boolean>;
  onTogglePhotoLike?: (id: string) => void;
  onToggleVideoLike?: (id: string) => void;
};

function PlayerMediaSectionComponent({
  photos,
  videos,
  editable,
  currentUserId,
  onAddPhoto,
  onAddVideo,
  onRemovePhoto,
  onRemoveVideo,
  onSetAvatar,
  onTogglePhotoLike,
  onToggleVideoLike,
}: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [photoUrl, setPhotoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [picking, setPicking] = useState(false);
  const [sharePayload, setSharePayload] = useState<ContentSharePayload | null>(
    null
  );

  const pickFromLibrary = useCallback(
    async (kind: 'photo' | 'video') => {
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

        if (kind === 'video') await onAddVideo?.(asset.uri);
        else await onAddPhoto?.(asset.uri);
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
    [onAddPhoto, onAddVideo, t, toast]
  );

  return (
    <View style={styles.wrap}>
      <Subtitle>{t('media.photoGallery')}</Subtitle>
      {photos.length === 0 ? (
        <EmptyState
          title={t('media.noPhotos')}
          description={
            editable
              ? t('media.addPhotosHint')
              : t('media.playerNoPhotos')
          }
          icon="images-outline"
        />
      ) : (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.tileWrap}>
              <View style={styles.tile}>
                <Image
                  source={{ uri: photo.url }}
                  style={styles.image}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.shareCorner}>
                  <TinyShareButton
                    onPress={() =>
                      setSharePayload({
                        kind: 'content',
                        title: t('media.photoGallery'),
                        mediaUrl: photo.url,
                        mediaKind: 'photo',
                      })
                    }
                  />
                </View>
                {editable ? (
                  <View style={styles.tileActions}>
                    {onSetAvatar ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('media.setAsAvatar')}
                        onPress={() => onSetAvatar(photo.url)}
                        style={[
                          styles.iconBtn,
                          { backgroundColor: theme.colors.accent },
                        ]}
                      >
                        <Ionicons
                          name="person-circle-outline"
                          size={16}
                          color={theme.colors.textInverse}
                        />
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('media.deletePhoto')}
                      onPress={() => {
                        void (async () => {
                          const ok = await confirmDestructive({
                            title: t('media.deletePhotoConfirmTitle'),
                            message: t('media.deletePhotoConfirmMessage'),
                            cancelLabel: t('common.cancel'),
                            confirmLabel: t('common.delete'),
                          });
                          if (ok) await onRemovePhoto?.(photo.id);
                        })();
                      }}
                      style={[
                        styles.iconBtn,
                        { backgroundColor: theme.colors.danger },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <LikeButton
                count={photo.likes.length}
                liked={!!currentUserId && photo.likes.includes(currentUserId)}
                onPress={
                  onTogglePhotoLike
                    ? () => onTogglePhotoLike(photo.id)
                    : undefined
                }
                size="sm"
              />
            </View>
          ))}
        </View>
      )}

      {editable ? (
        <Card style={styles.form}>
          <Muted>{t('media.addPhotoHint')}</Muted>
          <MediaUploadSpecs
            kind="photo"
            title={t('media.specs.photoTitle')}
          />
          {onSetAvatar ? (
            <MediaUploadSpecs
              kind="avatar"
              title={t('media.specs.avatarTitle')}
              compact
            />
          ) : null}
          <Button
            label={
              picking ? t('media.picking') : t('media.pickPhotoFromDevice')
            }
            variant="secondary"
            loading={picking}
            onPress={() => pickFromLibrary('photo')}
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
                const ok = await onAddPhoto?.(photoUrl.trim());
                if (ok !== false) setPhotoUrl('');
              })();
            }}
          />
        </Card>
      ) : null}

      <Subtitle>{t('media.videosSection')}</Subtitle>
      {videos.length === 0 ? (
        <EmptyState
          title={t('media.noVideos')}
          description={
            editable
              ? t('media.addVideosHint')
              : t('media.playerNoVideos')
          }
          icon="videocam-outline"
        />
      ) : (
        <View style={styles.videoList}>
          {videos.map((video, index) => (
            <Card key={video.id} style={styles.videoCard}>
              <View style={styles.videoHead}>
                <Text style={[styles.videoTitle, { color: theme.colors.text, flex: 1 }]}>
                  {t('media.videoNumber', { n: index + 1 })}
                </Text>
                <TinyShareButton
                  onPress={() =>
                    setSharePayload({
                      kind: 'content',
                      title: t('media.videoNumber', { n: index + 1 }),
                      mediaUrl: video.url,
                      mediaKind: 'video',
                    })
                  }
                />
              </View>
              <InlineVideoPlayer uri={video.url} />
              <View style={styles.videoActions}>
                {editable ? (
                  <Button
                    label={t('media.delete')}
                    variant="danger"
                    onPress={() => {
                      void (async () => {
                        const ok = await confirmDestructive({
                          title: t('media.deleteVideoConfirmTitle'),
                          message: t('media.deleteVideoConfirmMessage'),
                          cancelLabel: t('common.cancel'),
                          confirmLabel: t('common.delete'),
                        });
                        if (ok) await onRemoveVideo?.(video.id);
                      })();
                    }}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
              <LikeButton
                count={video.likes.length}
                liked={!!currentUserId && video.likes.includes(currentUserId)}
                onPress={
                  onToggleVideoLike
                    ? () => onToggleVideoLike(video.id)
                    : undefined
                }
                size="sm"
              />
            </Card>
          ))}
        </View>
      )}

      {editable ? (
        <Card style={styles.form}>
          <Muted>{t('media.addVideoHint')}</Muted>
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
            onPress={() => pickFromLibrary('video')}
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
                const ok = await onAddVideo?.(videoUrl.trim());
                if (ok !== false) setVideoUrl('');
              })();
            }}
          />
        </Card>
      ) : null}

      <ShareTargetModal
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </View>
  );
}

export const PlayerMediaSection = memo(PlayerMediaSectionComponent);

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tileWrap: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    gap: 6,
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  tileActions: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 6,
  },
  shareCorner: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { gap: 10 },
  videoList: { gap: 10 },
  videoCard: { gap: 10 },
  videoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoTitle: { fontWeight: '800' },
  videoActions: { flexDirection: 'row', gap: 8 },
});
