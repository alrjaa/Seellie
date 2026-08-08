import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ResizeMode, Video } from 'expo-av';
import { useTournament, type Comment } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import {
  StackTopChrome,
  stackTopChromePad,
} from '@/components/layout/StackTopChrome';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import {
  ShareTargetModal,
  TinyShareButton,
  type ContentSharePayload,
} from '@/components/share/ShareTargetModal';
import {
  Avatar,
  Button,
  Card,
  Input,
  LikeButton,
  Muted,
  Subtitle,
} from '@/components/ui';
import { formatArabicDate, formatArabicTime } from '@/utils';
import { useListChrome } from '@/hooks/useListChrome';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import {
  FORUM_VIDEO_MAX_SEC,
  isForumVideoWithinLimit,
  videoDurationSecFromPicker,
} from '@/utils/media-limits';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CommentCard = memo(function CommentCard({
  item,
  liked,
  onLike,
  onShare,
}: {
  item: Comment;
  liked: boolean;
  onLike: () => void;
  onShare: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={item.authorAvatar} name={item.authorName} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.author, { color: theme.colors.text }]}>
            {item.authorName}
          </Text>
          <Muted>
            {formatArabicDate(item.timestamp)} · {formatArabicTime(item.timestamp)}
            {item.videoUrl
              ? ` · ${t('common.video')}${
                  item.videoDurationSec
                    ? ` ${Math.round(item.videoDurationSec)}${t('media.secondsAbbr')}`
                    : ''
                }`
              : ''}
          </Muted>
        </View>
        {!item.videoUrl ? <TinyShareButton onPress={onShare} /> : null}
      </View>
      {item.text ? (
        <Text style={[styles.body, { color: theme.colors.text }]}>
          {item.text}
        </Text>
      ) : null}
      {item.videoUrl ? (
        <View style={styles.mediaWrap}>
          <Video
            source={{ uri: item.videoUrl }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
          />
          <View style={styles.mediaShare}>
            <TinyShareButton onPress={onShare} />
          </View>
        </View>
      ) : null}
      <LikeButton count={item.likes.length} liked={liked} onPress={onLike} />
    </Card>
  );
});

/** ساحات وتعليقات — نص + فيديو من الحساب نفسه (≤ 30 ثانية). */
export default function ForumsScreen() {
  const {
    comments,
    quickComments,
    currentUser,
    loading,
    addComment,
    toggleCommentLike,
    refreshCloudForumComments,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const listChrome = useListChrome({ hasTabBar: false });
  const topPad = stackTopChromePad(insets.top);
  const [text, setText] = useState('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [sharePayload, setSharePayload] = useState<ContentSharePayload | null>(
    null
  );

  useFocusEffect(
    useCallback(() => {
      void refreshCloudForumComments();
    }, [refreshCloudForumComments])
  );
  const discussions = useMemo(() => {
    const byId = new Map<string, Comment>();
    [...comments, ...quickComments].forEach((c) => {
      if (c.status === 'blocked' || c.status === 'suspended') return;
      byId.set(c.id, c);
    });
    return [...byId.values()].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [comments, quickComments]);

  const accountVideos = useMemo(
    () => currentUser?.media?.videos || [],
    [currentUser]
  );

  const clearVideo = useCallback(() => {
    setVideoUri(null);
    setVideoDurationSec(null);
  }, []);

  const attachVideo = useCallback(
    (uri: string, durationSec: number | null, fromAccount: boolean) => {
      if (!currentUser) {
        toast({
          variant: 'destructive',
          title: t('toasts.t023_bf2703'),
          description: t('forums.uploadFromAccountOnly'),
        });
        return;
      }
      if (!isForumVideoWithinLimit(durationSec)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t018_d72661'),
          description: t('forums.subtitle', { sec: FORUM_VIDEO_MAX_SEC }),
        });
        return;
      }
      setVideoUri(uri);
      setVideoDurationSec(durationSec);
      toast({
        title: fromAccount
          ? t('forums.videoSelectedFromAccount')
          : t('forums.videoAttached'),
        description: durationSec
          ? t('forums.durationApprox', { sec: Math.round(durationSec) })
          : t('forums.maxDuration', { sec: FORUM_VIDEO_MAX_SEC }),
      });
    },
    [currentUser, t, toast]
  );

  const pickVideoFromLibrary = useCallback(async () => {
    if (!currentUser) return;
    setPicking(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast({
          variant: 'destructive',
          title: t('media.permissionRequired'),
          description: t('media.allowLibraryForVideo'),
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.85,
        videoMaxDuration: FORUM_VIDEO_MAX_SEC,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const durationSec = videoDurationSecFromPicker(asset.duration);
      attachVideo(asset.uri, durationSec, false);
    } catch {
      toast({
        variant: 'destructive',
        title: t('media.pickVideoFailed'),
      });
    } finally {
      setPicking(false);
    }
  }, [attachVideo, currentUser, t, toast]);

  const recordVideo = useCallback(async () => {
    if (!currentUser) return;
    setPicking(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        toast({
          variant: 'destructive',
          title: t('media.permissionRequired'),
          description: t('media.allowCameraForVideo'),
        });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.85,
        videoMaxDuration: FORUM_VIDEO_MAX_SEC,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const durationSec = videoDurationSecFromPicker(asset.duration);
      attachVideo(asset.uri, durationSec, false);
    } catch {
      toast({
        variant: 'destructive',
        title: t('media.recordVideoFailed'),
      });
    } finally {
      setPicking(false);
    }
  }, [attachVideo, currentUser, t, toast]);

  const publish = useCallback(() => {
    if (!currentUser) return;
    const value = text.trim();
    if (!value && !videoUri) return;

    addComment(value, undefined, { type: 'general' }, {
      videoUrl: videoUri || undefined,
      videoDurationSec: videoDurationSec ?? undefined,
    });
    setText('');
    clearVideo();
  }, [
    addComment,
    clearVideo,
    currentUser,
    text,
    videoDurationSec,
    videoUri,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: Comment }) => {
      const liked = currentUser ? item.likes.includes(currentUser.id) : false;
      return (
        <CommentCard
          item={item}
          liked={liked}
          onLike={() => toggleCommentLike(item.id)}
          onShare={() =>
            setSharePayload({
              kind: 'content',
              title: item.authorName,
              body: item.text,
              mediaUrl: item.videoUrl,
              mediaKind: item.videoUrl ? 'video' : 'text',
            })
          }
        />
      );
    },
    [currentUser, toggleCommentLike]
  );

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;

  const canPublish = Boolean(text.trim() || videoUri);

  return (
    <View style={styles.root}>
      <StackTopChrome />
      <Screen keyboard hasTabBar={false}>
      <FlatList
        style={{ flex: 1 }}
        data={discussions}
        keyExtractor={(item) => item.id}
        {...listChrome}
        contentContainerStyle={[
          styles.list,
          { paddingTop: topPad },
          listChrome.contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        ListHeaderComponent={
          <View style={styles.header}>
            <Muted>{t('forums.subtitle', { sec: FORUM_VIDEO_MAX_SEC })}</Muted>
            <Card style={styles.composer}>
              <Subtitle>{t('forums.addComment')}</Subtitle>
              <Input
                label={t('forums.contribution')}
                value={text}
                onChangeText={setText}
                placeholder={t('forums.placeholder')}
                multiline
              />

              <Muted>
                {t('common.video')} ({FORUM_VIDEO_MAX_SEC}s)
              </Muted>
              <MediaUploadSpecs kind="forumVideo" title={t('media.specs.videoTitle')} />
              <View style={styles.videoActions}>
                <Button
                  label={picking ? '...' : t('forums.pickVideo')}
                  variant="outline"
                  onPress={() => void pickVideoFromLibrary()}
                  disabled={picking}
                  style={styles.actionBtn}
                />
                <Button
                  label={picking ? '...' : t('common.video')}
                  variant="outline"
                  onPress={() => void recordVideo()}
                  disabled={picking}
                  style={styles.actionBtn}
                />
                {videoUri ? (
                  <Button
                    label={t('common.cancel')}
                    variant="ghost"
                    onPress={clearVideo}
                    style={styles.actionBtn}
                  />
                ) : null}
              </View>

              {accountVideos.length > 0 ? (
                <View style={styles.accountVideos}>
                  <Muted>{t('screens.competitionMedia')}</Muted>
                  <View style={styles.accountRow}>
                    {accountVideos.slice(0, 6).map((v) => {
                      const selected = videoUri === v.url;
                      return (
                        <Pressable
                          key={v.id}
                          onPress={() =>
                            attachVideo(
                              v.url,
                              v.url === videoUri ? videoDurationSec : null,
                              true
                            )
                          }
                          style={[
                            styles.accountChip,
                            {
                              borderColor: selected
                                ? theme.colors.accent
                                : theme.colors.border,
                              backgroundColor: selected
                                ? theme.colors.accentSoft
                                : theme.colors.surfaceElevated,
                            },
                          ]}
                        >
                          <Ionicons
                            name="videocam"
                            size={16}
                            color={theme.colors.accent}
                          />
                          <Text
                            style={{
                              color: theme.colors.text,
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                            numberOfLines={1}
                          >
                            {t('common.video')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {videoUri ? (
                <View style={styles.previewWrap}>
                  <Video
                    source={{ uri: videoUri }}
                    style={styles.preview}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    onLoad={(status) => {
                      if (!status.isLoaded || status.durationMillis == null) {
                        return;
                      }
                      const sec = status.durationMillis / 1000;
                      if (!isForumVideoWithinLimit(sec)) {
                        clearVideo();
                        toast({
                          variant: 'destructive',
                          title: t('toasts.t018_d72661'),
                          description: t('forums.subtitle', {
                            sec: FORUM_VIDEO_MAX_SEC,
                          }),
                        });
                        return;
                      }
                      setVideoDurationSec(sec);
                    }}
                  />
                  <Muted>
                    {currentUser.name}
                    {videoDurationSec
                      ? ` · ${Math.round(videoDurationSec)}s`
                      : ''}
                  </Muted>
                </View>
              ) : null}

              <Button
                label={t('screens.publishForum')}
                onPress={publish}
                disabled={!canPublish}
              />
            </Card>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('forums.empty')}
            description={t('forums.subtitle', { sec: FORUM_VIDEO_MAX_SEC })}
            icon="chatbox-ellipses-outline"
          />
        }
        renderItem={renderItem}
      />
      </Screen>
      <ShareTargetModal
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingTop: 12, gap: 10, paddingBottom: 120 },
  header: { gap: 10, marginBottom: 8 },
  composer: { gap: 10 },
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { fontWeight: '800', textAlign: 'left' },
  body: {
    textAlign: 'left',
    lineHeight: 22,
  },
  mediaWrap: { position: 'relative' },
  mediaShare: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  video: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  videoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: { flexGrow: 1, minWidth: 100 },
  accountVideos: { gap: 8 },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: '48%',
  },
  previewWrap: { gap: 6 },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#000',
  },
});
