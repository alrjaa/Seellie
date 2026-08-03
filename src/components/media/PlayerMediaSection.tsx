import React, { memo, useCallback, useState } from 'react';
import {
  Linking,
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
import { Button, Card, Input, LikeButton, Muted, Subtitle } from '@/components/ui';

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
  onAddPhoto?: (url: string) => boolean | void;
  onAddVideo?: (url: string) => boolean | void;
  onRemovePhoto?: (id: string) => void;
  onRemoveVideo?: (id: string) => void;
  onSetAvatar?: (url: string) => void;
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
        });

        if (result.canceled || !result.assets?.[0]?.uri) return;
        const uri = result.assets[0].uri;
        if (kind === 'photo') onAddPhoto?.(uri);
        else onAddVideo?.(uri);
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
                {editable ? (
                  <View style={styles.tileActions}>
                    {onSetAvatar ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('media.setAsAvatar')}
                        onPress={() => onSetAvatar(photo.url)}
                        style={[
                          styles.iconBtn,
                          { backgroundColor: theme.colors.primary },
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
                      onPress={() => onRemovePhoto?.(photo.id)}
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
              if (onAddPhoto?.(photoUrl.trim())) setPhotoUrl('');
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
              <View style={styles.videoRow}>
                <View
                  style={[
                    styles.videoIcon,
                    { backgroundColor: theme.colors.primarySoft },
                  ]}
                >
                  <Ionicons
                    name="play-circle"
                    size={28}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.videoTitle, { color: theme.colors.text }]}>
                    {t('media.videoNumber', { n: index + 1 })}
                  </Text>
                  <Muted numberOfLines={1}>{video.url}</Muted>
                </View>
              </View>
              <View style={styles.videoActions}>
                <Button
                  label={t('media.play')}
                  variant="outline"
                  onPress={() => {
                    void Linking.openURL(video.url).catch(() =>
                      toast({
                        variant: 'destructive',
                        title: t('media.openVideoFailed'),
                      })
                    );
                  }}
                  style={{ flex: 1 }}
                />
                {editable ? (
                  <Button
                    label={t('media.delete')}
                    variant="danger"
                    onPress={() => onRemoveVideo?.(video.id)}
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
              if (onAddVideo?.(videoUrl.trim())) setVideoUrl('');
            }}
          />
        </Card>
      ) : null}
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
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  videoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTitle: { fontWeight: '800', textAlign: 'left' },
  videoActions: { flexDirection: 'row', gap: 8 },
});
