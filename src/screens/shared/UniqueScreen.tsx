import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { HeaderBackButton } from '@/components/layout/HeaderBackButton';
import {
  StackTopChrome,
  stackTopChromePad,
} from '@/components/layout/StackTopChrome';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import {
  FullScreenFeed,
  type FullScreenContent,
} from '@/components/media/FullScreenFeed';
import { InlineVideoPlayer } from '@/components/media/InlineVideoPlayer';
import {
  ShareTargetModal,
  TinyShareButton,
  type ContentSharePayload,
} from '@/components/share/ShareTargetModal';
import {
  Button,
  Card,
  Input,
  LikeButton,
  Muted,
  Subtitle,
} from '@/components/ui';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import { useResponsive } from '@/hooks/useResponsive';
import { useSaveToPrivateSpace } from '@/hooks/useSaveToPrivateSpace';
import { resolveLocationLabel } from '@/utils/location-label';
import { useEffectiveNativeAds } from '@/hooks/useEffectiveNativeAds';
import { useAdPreferences } from '@/hooks/useAdPreferences';
import { injectNativeAds } from '@/services/native-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatArabicDate } from '@/utils';
import { ANALYST_TERMS, isActiveAnalyst, isAnalystSuspendActive } from '@/utils/analyst';
import {
  ANALYSIS_VIDEO_MAX_SEC,
  MEDIA_SPECS,
  isVideoWithinLimit,
  validatePickerAsset,
  videoDurationSecFromPicker,
} from '@/utils/media-limits';
import { setFloatingSuppressed } from '@/services/floating-scroll-bus';
import { fetchOwnAnalystAccessCode } from '@/services/analyst-secrets';
import { isUuid } from '@/services/supabase-messages';
import { isSupabaseConfigured } from '@/services/supabase';
import { ar } from '@/i18n/locales/ar';
import { en } from '@/i18n/locales/en';

type FeedFilter = 'all' | 'video' | 'photo' | 'text';

type AnalysisItem = {
  id: string;
  title: string;
  content: string;
  videoUrl?: string;
  posterUrl?: string;
  timestamp: Date;
  likes: string[];
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorHandle?: string;
};

function isVisualAnalysisPlaceholder(content: string) {
  return (
    content === ar.toasts.visualAnalysis || content === en.toasts.visualAnalysis
  );
}

/** أي نص كتبه المحلل (المحتوى أو العنوان دون وسائط فقط) */
function analysisWrittenBody(item: Pick<AnalysisItem, 'content'>) {
  const body = (item.content || '').trim();
  if (!body || isVisualAnalysisPlaceholder(body)) return '';
  return body;
}

function analysisBelongsInTextFilter(
  item: Pick<AnalysisItem, 'title' | 'content' | 'videoUrl' | 'posterUrl'>
) {
  if (analysisWrittenBody(item)) return true;
  // تحليل نصي بحت: العنوان وحده يكفي إن لم تُرفق وسائط
  return !item.videoUrl && !item.posterUrl && !!(item.title || '').trim();
}

function analysisIsPhotoOnly(item: Pick<AnalysisItem, 'videoUrl' | 'posterUrl'>) {
  return !!item.posterUrl && !item.videoUrl;
}

const AnalysisCard = memo(function AnalysisCard({
  item,
  liked,
  onLike,
  onShare,
  textFocus = false,
}: {
  item: AnalysisItem;
  liked: boolean;
  onLike: () => void;
  onShare?: () => void;
  /** في فلتر النصوص نعرض النص فقط حتى لو وُجدت وسائط */
  textFocus?: boolean;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const hasVideo = !!item.videoUrl && !textFocus;
  const hasPhoto = !!item.posterUrl && !textFocus;
  const body = analysisWrittenBody(item);
  const isTextOnly = !item.videoUrl && !item.posterUrl;
  const kindIcon = textFocus
    ? 'document-text'
    : item.videoUrl
      ? 'videocam'
      : item.posterUrl
        ? 'image'
        : 'document-text';

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.author, { color: theme.colors.accent }]}>
            {item.authorHandle || item.authorName}
          </Text>
          <Muted>{formatArabicDate(item.timestamp)}</Muted>
        </View>
        {onShare && (isTextOnly || textFocus) ? (
          <TinyShareButton onPress={onShare} />
        ) : null}
        <View
          style={[
            styles.kindBadge,
            { backgroundColor: theme.colors.accentSoft },
          ]}
        >
          <Ionicons
            name={kindIcon}
            size={16}
            color={theme.colors.accent}
          />
        </View>
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>
        {item.title}
      </Text>

      {body ? (
        <Text style={[styles.body, { color: theme.colors.text }]}>
          {body}
        </Text>
      ) : textFocus && !body ? (
        <Muted>{t('unique.textContentFromAnalyst')}</Muted>
      ) : null}

      {hasVideo ? (
        <View style={styles.mediaWrap}>
          <InlineVideoPlayer uri={item.videoUrl!} height={220} />
          {onShare ? (
            <View style={styles.mediaShare}>
              <TinyShareButton onPress={onShare} />
            </View>
          ) : null}
        </View>
      ) : hasPhoto ? (
        <View style={styles.mediaWrap}>
          <Image
            source={{ uri: item.posterUrl! }}
            style={styles.posterImage}
            resizeMode="cover"
            accessibilityLabel={item.title}
          />
          {onShare ? (
            <View style={styles.mediaShare}>
              <TinyShareButton onPress={onShare} />
            </View>
          ) : null}
        </View>
      ) : null}

      {isTextOnly && !body ? (
        <View style={styles.textTag}>
          <Ionicons
            name="create-outline"
            size={14}
            color={theme.colors.textMuted}
          />
          <Muted>{t('unique.textContentFromAnalyst')}</Muted>
        </View>
      ) : null}

      <LikeButton count={item.likes.length} liked={liked} onPress={onLike} />
    </Card>
  );
});

/**
 * الفريد — مساحة المحلل: فيديوهات + نص بملء الشاشة على الجوال.
 * النشر يتطلب: حساب → موافقة الشروط → موافقة الإدارة → رمز من الإيميل.
 */
export default function UniqueScreen() {
  const {
    currentUser,
    loading,
    users,
    messages,
    addAnalysis,
    toggleAnalysisLike,
    applyAsAnalyst,
    verifyAnalystAccessCode,
    refreshCurrentUserFromCloud,
    refreshCloudMessages,
    syncCloudUsers,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const { tablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const saveToPrivate = useSaveToPrivateSpace();
  const nativeAds = useEffectiveNativeAds();
  const { hideAd, reportAd } = useAdPreferences();
  const topPad = stackTopChromePad(insets.top);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  /** فيديو محلي من الجهاز — يُرفع للسحابة عند النشر */
  const [videoUri, setVideoUri] = useState('');
  /** صورة محلية من الجهاز — تُرفع كـ posterUrl */
  const [photoUri, setPhotoUri] = useState('');
  /** رابط فيديو خارجي اختياري (https) */
  const [videoLink, setVideoLink] = useState('');
  const [pickingVideo, setPickingVideo] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  /** الانضمام اختياري — لا نفرض نموذج الطلب على كل زائر */
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [showGatePanel, setShowGatePanel] = useState(false);
  const [sharePayload, setSharePayload] = useState<ContentSharePayload | null>(
    null
  );

  const publishPanelOpen = showGatePanel || showJoinForm;

  // إخفاء الأزرار العائمة أثناء نموذج النشر/الانضمام في الفريد
  useFocusEffect(
    useCallback(() => {
      setFloatingSuppressed(publishPanelOpen);
      return () => setFloatingSuppressed(false);
    }, [publishPanelOpen])
  );

  const analyses = useMemo(() => {
    const items: AnalysisItem[] = [];
    users.forEach((u) => {
      (u.analysisContent || [])
        .filter((a) => a.status !== 'blocked' && a.status !== 'suspended')
        .forEach((a) => {
          items.push({
            id: a.id,
            title: a.title,
            content: a.content,
            videoUrl: a.videoUrl,
            posterUrl: a.posterUrl,
            timestamp: new Date(a.timestamp),
            likes: a.likes || [],
            authorId: u.id,
            authorName: u.name,
            authorAvatar: u.avatar,
            authorHandle: u.handle,
          });
        });
    });
    return items.sort((a, b) => {
      const videoBoost = (x: AnalysisItem) => (x.videoUrl ? 1 : 0);
      const boost = videoBoost(b) - videoBoost(a);
      if (boost !== 0) return boost;
      return (
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });
  }, [users]);

  const filtered = useMemo(() => {
    if (filter === 'video') return analyses.filter((a) => !!a.videoUrl);
    if (filter === 'photo') return analyses.filter((a) => analysisIsPhotoOnly(a));
    if (filter === 'text')
      return analyses.filter((a) => analysisBelongsInTextFilter(a));
    return analyses;
  }, [analyses, filter]);

  const counts = useMemo(
    () => ({
      all: analyses.length,
      video: analyses.filter((a) => !!a.videoUrl).length,
      photo: analyses.filter((a) => analysisIsPhotoOnly(a)).length,
      text: analyses.filter((a) => analysisBelongsInTextFilter(a)).length,
    }),
    [analyses]
  );

  const fullScreenData = useMemo<FullScreenContent[]>(() => {
    if (!currentUser) return [];
    const mapped: FullScreenContent[] = filtered.map((item) => {
      const hasVideo = !!item.videoUrl;
      const hasPhoto = !!item.posterUrl;
      const body = analysisWrittenBody(item);
      // في فلتر النصوص نعرض دائماً شريحة نصية حتى لو وُجدت وسائط
      const kind: FullScreenContent['kind'] =
        filter === 'text'
          ? 'text'
          : hasVideo
            ? 'video'
            : hasPhoto
              ? 'photo'
              : 'text';
      return {
        id: item.id,
        kind,
        mediaUrl:
          kind === 'text'
            ? undefined
            : hasVideo
              ? item.videoUrl
              : hasPhoto
                ? item.posterUrl
                : undefined,
        posterUrl: kind === 'text' ? undefined : item.posterUrl,
        title: item.title,
        text:
          kind === 'text'
            ? body && body !== item.title.trim()
              ? body
              : ''
            : '',
        authorId: item.authorId,
        authorName: item.authorName,
        authorAvatar: item.authorAvatar,
        authorHandle: item.authorHandle,
        subtitle: undefined,
        likes: item.likes || [],
        liked: (item.likes || []).includes(currentUser.id),
        locationLabel: (() => {
          const author = users.find((u) => u.id === item.authorId);
          return resolveLocationLabel({
            city: author?.city,
            region: author?.region,
          });
        })(),
      };
    });
    if (filter === 'text') return mapped;
    try {
      return injectNativeAds(mapped, nativeAds, 'unique') as FullScreenContent[];
    } catch (error) {
      console.warn('[UniqueScreen] native ads inject failed', error);
      return mapped;
    }
  }, [currentUser, filter, filtered, nativeAds, users]);

  const analystStatus = currentUser?.analyst?.status || 'none';
  const canPublish = isActiveAnalyst(currentUser);
  const [ownAccessCode, setOwnAccessCode] = useState('');
  const codeFromMessage = useMemo(() => {
    if (!currentUser) return '';
    const mine = messages
      .filter((m) => m.recipientId === currentUser.id)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    for (const m of mine) {
      const body = m.body || '';
      const match =
        body.match(/رمز الوصول:\s*(\S+)/) ||
        body.match(/Access code:\s*(\S+)/i);
      if (match?.[1]) return match[1].trim();
    }
    return '';
  }, [messages, currentUser]);
  // لا تعتمد على profiles.content — فقط RPC للمالك أو رسالة التسليم
  const storedAccessCode = ownAccessCode || codeFromMessage;

  useEffect(() => {
    if (
      analystStatus !== 'approved' ||
      !currentUser ||
      !isUuid(currentUser.id) ||
      !isSupabaseConfigured()
    ) {
      setOwnAccessCode('');
      return;
    }
    let cancelled = false;
    void fetchOwnAnalystAccessCode().then((code) => {
      if (!cancelled) setOwnAccessCode(code || '');
    });
    return () => {
      cancelled = true;
    };
  }, [analystStatus, currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshCurrentUserFromCloud();
      void refreshCloudMessages();
      void syncCloudUsers();
    }, [refreshCurrentUserFromCloud, refreshCloudMessages, syncCloudUsers])
  );

  // بعد الموافقة افتح لوحة الرمز تلقائياً وأظهر الرمز إن وُجد
  useEffect(() => {
    if (analystStatus === 'approved') {
      setShowGatePanel(true);
    }
  }, [analystStatus]);

  useEffect(() => {
    if (analystStatus !== 'approved' || !storedAccessCode) return;
    setAccessCodeInput((prev) => (prev.trim() ? prev : storedAccessCode));
  }, [analystStatus, storedAccessCode]);

  const pickVideo = useCallback(async () => {
    try {
      setPickingVideo(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast({
          variant: 'destructive',
          title: t('unique.permissionRequired'),
          description: t('unique.libraryPermissionDesc'),
        });
        return;
      }
      const maxSec = ANALYSIS_VIDEO_MAX_SEC;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.85,
        videoMaxDuration: maxSec,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const asset = result.assets[0];
      const durationSec = videoDurationSecFromPicker(asset.duration);
      if (!isVideoWithinLimit(durationSec, maxSec)) {
        toast({
          variant: 'destructive',
          title: t('media.videoTooLong'),
          description: t('media.videoTooLongDesc', { sec: maxSec }),
        });
        return;
      }
      setVideoUri(asset.uri);
      setVideoLink('');
    } catch {
      toast({
        variant: 'destructive',
        title: t('unique.videoPickFailed'),
      });
    } finally {
      setPickingVideo(false);
    }
  }, [toast, t]);

  const pickPhoto = useCallback(async () => {
    try {
      setPickingPhoto(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast({
          variant: 'destructive',
          title: t('unique.permissionRequired'),
          description: t('unique.libraryPermissionDesc'),
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: Platform.OS !== 'web',
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const asset = result.assets[0];
      const check = validatePickerAsset('photo', {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
      });
      if (!check.ok) {
        if (check.reason === 'size') {
          toast({
            variant: 'destructive',
            title: t('media.fileTooLarge'),
            description: t('media.fileTooLargeDesc', {
              mb: MEDIA_SPECS.photo.maxMb,
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
      setPhotoUri(asset.uri);
    } catch {
      toast({
        variant: 'destructive',
        title: t('unique.photoPickFailed'),
      });
    } finally {
      setPickingPhoto(false);
    }
  }, [toast, t]);

  const publish = useCallback(() => {
    if (!canPublish || publishing) return;
    void (async () => {
      setPublishing(true);
      try {
        const ok = await addAnalysis({
          title,
          content,
          videoUrl: videoUri.trim() || videoLink.trim() || undefined,
          posterUrl: photoUri.trim() || undefined,
        });
        if (ok) {
          setTitle('');
          setContent('');
          setVideoUri('');
          setPhotoUri('');
          setVideoLink('');
          setShowGatePanel(false);
        }
      } finally {
        setPublishing(false);
      }
    })();
  }, [
    addAnalysis,
    canPublish,
    content,
    photoUri,
    publishing,
    title,
    videoLink,
    videoUri,
  ]);

  const canSubmitPublish = !!title.trim();

  const onFullLike = useCallback(
    (item: FullScreenContent) => {
      if (item.sponsored) return;
      const source = filtered.find((a) => a.id === item.id);
      if (!source) return;
      toggleAnalysisLike(source.authorId, source.id);
    },
    [filtered, toggleAnalysisLike]
  );

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;

  const publishGate = (() => {
    if (analystStatus === 'banned') {
      return (
        <Card style={styles.card}>
          <Subtitle>{t('unique.analystBannedTitle')}</Subtitle>
          <Muted>
            {t('unique.analystBannedDesc', {
              reason:
                currentUser.analyst?.banReason || t('unique.termsViolation'),
            })}
          </Muted>
        </Card>
      );
    }

    if (analystStatus === 'suspended' && isAnalystSuspendActive(currentUser.analyst)) {
      const from = currentUser.analyst?.suspendFrom
        ? formatArabicDate(currentUser.analyst.suspendFrom)
        : '—';
      const to = currentUser.analyst?.suspendTo
        ? formatArabicDate(currentUser.analyst.suspendTo)
        : '—';
      return (
        <Card style={styles.card}>
          <Subtitle>{t('unique.analystSuspendedTitle')}</Subtitle>
          <Muted>{t('unique.suspendFromTo', { from, to })}</Muted>
          <Muted>
            {t('unique.reasonLabel', {
              reason:
                currentUser.analyst?.suspendReason || t('unique.unspecified'),
            })}
          </Muted>
        </Card>
      );
    }

    if (canPublish) {
      return (
        <Card style={styles.card}>
          <Subtitle>{t('unique.publishNewAnalysis')}</Subtitle>
          {analystStatus === 'warned' ? (
            <Muted>
              {t('unique.warningNotice', {
                reason:
                  currentUser.analyst?.warningReason || t('unique.reviewTerms'),
              })}
            </Muted>
          ) : (
            <Muted>{t('unique.approvedAnalystHint')}</Muted>
          )}
          <Input
            label={t('unique.analysisTitle')}
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label={t('unique.textContent')}
            value={content}
            onChangeText={setContent}
            multiline
            placeholder={t('unique.writeAnalysisPlaceholder')}
            style={{ minHeight: 100, maxHeight: 180 }}
          />
          <MediaUploadSpecs
            kind="analysisVideo"
            title={t('media.specs.videoTitle')}
          />
          <Button
            label={
              pickingVideo
                ? t('unique.pickingVideo')
                : t('unique.pickVideoFromDevice')
            }
            variant="secondary"
            loading={pickingVideo}
            onPress={() => void pickVideo()}
          />
          {videoUri ? (
            <View style={styles.pickedBox}>
              <Muted>{t('unique.videoSelectedFromDevice')}</Muted>
              <InlineVideoPlayer uri={videoUri} height={180} />
              <Button
                label={t('unique.removeVideo')}
                variant="ghost"
                onPress={() => setVideoUri('')}
              />
            </View>
          ) : null}
          <MediaUploadSpecs
            kind="photo"
            title={t('media.specs.photoTitle')}
          />
          <Button
            label={
              pickingPhoto
                ? t('unique.pickingPhoto')
                : t('media.pickPhotoFromDevice')
            }
            variant="secondary"
            loading={pickingPhoto}
            onPress={() => void pickPhoto()}
          />
          {photoUri ? (
            <View style={styles.pickedBox}>
              <Muted>{t('unique.photoSelectedFromDevice')}</Muted>
              <Image
                source={{ uri: photoUri }}
                style={styles.posterImage}
                resizeMode="cover"
              />
              <Button
                label={t('unique.removePhoto')}
                variant="ghost"
                onPress={() => setPhotoUri('')}
              />
            </View>
          ) : null}
          <Input
            label={t('unique.videoUrlOptional')}
            value={videoLink}
            onChangeText={(v) => {
              setVideoLink(v);
              if (v.trim()) setVideoUri('');
            }}
            placeholder={t('unique.videoUrlPlaceholder')}
            autoCapitalize="none"
            ltr
          />
          <Muted>{t('unique.mediaUploadHint')}</Muted>
          <Button
            label={t('unique.publishToUnique')}
            onPress={publish}
            loading={publishing}
            disabled={!canSubmitPublish || publishing}
          />
        </Card>
      );
    }

    if (analystStatus === 'pending') {
      return (
        <Card style={styles.card}>
          <Subtitle>{t('unique.requestPendingTitle')}</Subtitle>
          <Muted>
            {t('unique.requestPendingDesc', { email: currentUser.email })}
          </Muted>
        </Card>
      );
    }

    if (analystStatus === 'approved') {
      return (
        <Card style={styles.card}>
          <Subtitle>{t('unique.enterAccessCodeTitle')}</Subtitle>
          <Muted>{t('unique.enterAccessCodeDesc')}</Muted>
          {storedAccessCode ? (
            <>
              <Muted>
                {t('unique.yourAccessCode', { code: storedAccessCode })}
              </Muted>
              <Button
                label={t('unique.useShownCode')}
                variant="secondary"
                onPress={() => setAccessCodeInput(storedAccessCode)}
              />
            </>
          ) : null}
          <Input
            label={t('unique.accessCode')}
            value={accessCodeInput}
            onChangeText={setAccessCodeInput}
            placeholder={t('unique.accessCodePlaceholder')}
            autoCapitalize="none"
            ltr
          />
          <Button
            label={t('unique.activateAnalyst')}
            onPress={() => {
              if (verifyingCode) return;
              void (async () => {
                setVerifyingCode(true);
                try {
                  if (await verifyAnalystAccessCode(accessCodeInput)) {
                    setAccessCodeInput('');
                    setOwnAccessCode('');
                  }
                } finally {
                  setVerifyingCode(false);
                }
              })();
            }}
            disabled={!accessCodeInput.trim() || verifyingCode}
            loading={verifyingCode}
          />
        </Card>
      );
    }

    if (analystStatus === 'rejected') {
      return (
        <Card style={styles.card}>
          <Subtitle>{t('unique.requestRejectedTitle')}</Subtitle>
          <Muted>
            {t('unique.requestRejectedDesc', {
              reason:
                currentUser.analyst?.rejectionReason || t('unique.unspecified'),
            })}
          </Muted>
          <Pressable
            onPress={() => setTermsAccepted((v) => !v)}
            style={styles.termsRow}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: theme.colors.accent,
                  backgroundColor: termsAccepted
                    ? theme.colors.accent
                    : 'transparent',
                },
              ]}
            >
              {termsAccepted ? (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={theme.colors.textInverse}
                />
              ) : null}
            </View>
            <Text style={[styles.termsLabel, { color: theme.colors.text }]}>
              {t('unique.acceptTermsAgain')}
            </Text>
          </Pressable>
          <Text style={[styles.termsBody, { color: theme.colors.textMuted }]}>
            {ANALYST_TERMS}
          </Text>
          <Button
            label={t('unique.resubmitAnalystRequest')}
            onPress={() => void applyAsAnalyst(termsAccepted)}
            disabled={!termsAccepted}
          />
        </Card>
      );
    }

    if (!showJoinForm) {
      return (
        <Card
          style={[
            styles.card,
            {
              borderWidth: 1.5,
              borderColor: theme.colors.accent,
            },
          ]}
        >
          <Subtitle>{t('unique.wantToPublishTitle')}</Subtitle>
          <Muted>{t('unique.wantToPublishDesc')}</Muted>
          <Button
            label={t('unique.joinAsAnalyst')}
            onPress={() => setShowJoinForm(true)}
          />
        </Card>
      );
    }

    return (
      <Card style={styles.card}>
        <Subtitle>{t('unique.joinAsAnalystTitle')}</Subtitle>
        <Muted>{t('unique.joinSteps')}</Muted>
        <Muted>
          {t('unique.yourAccount', {
            handle: currentUser.handle,
            email: currentUser.email,
          })}
        </Muted>
        <Text style={[styles.termsBody, { color: theme.colors.textMuted }]}>
          {ANALYST_TERMS}
        </Text>
        <Pressable
          onPress={() => setTermsAccepted((v) => !v)}
          style={styles.termsRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: theme.colors.accent,
                backgroundColor: termsAccepted
                  ? theme.colors.accent
                  : 'transparent',
              },
            ]}
          >
            {termsAccepted ? (
              <Ionicons
                name="checkmark"
                size={14}
                color={theme.colors.textInverse}
              />
            ) : null}
          </View>
          <Text style={[styles.termsLabel, { color: theme.colors.text }]}>
            {t('unique.acceptTermsToJoin')}
          </Text>
        </Pressable>
        {!termsAccepted ? (
          <Muted>{t('unique.enableTermsFirst')}</Muted>
        ) : null}
        <Button
          label={t('unique.submitRequestNow')}
          onPress={() => void applyAsAnalyst(termsAccepted)}
          disabled={!termsAccepted}
        />
        <Button
          label={t('common.cancel')}
          variant="ghost"
          onPress={() => {
            setShowJoinForm(false);
            setTermsAccepted(false);
          }}
        />
      </Card>
    );
  })();

  const filters = (
    <View style={styles.filters}>
      {(
        [
          {
            key: 'all' as const,
            icon: 'grid-outline' as const,
            count: counts.all,
            label: t('unique.filterAll', { count: counts.all }),
            short: t('screens.all'),
          },
          {
            key: 'video' as const,
            icon: 'videocam-outline' as const,
            count: counts.video,
            label: t('unique.filterVideo', { count: counts.video }),
            short: t('screens.videos'),
          },
          {
            key: 'photo' as const,
            icon: 'image-outline' as const,
            count: counts.photo,
            label: t('unique.filterPhoto', { count: counts.photo }),
            short: t('screens.photos'),
          },
          {
            key: 'text' as const,
            icon: 'document-text-outline' as const,
            count: counts.text,
            label: t('unique.filterText', { count: counts.text }),
            short: t('sharesUi.texts'),
          },
        ] as const
      ).map((f) => {
        const active = filter === f.key;
        return (
          <Pressable
            key={f.key}
            accessibilityRole="button"
            accessibilityLabel={f.label}
            onPress={() => setFilter(f.key)}
            hitSlop={4}
            style={[
              styles.filterIconBtn,
              {
                backgroundColor: active
                  ? theme.colors.accent
                  : theme.colors.surfaceElevated,
                borderColor: active
                  ? theme.colors.accent
                  : theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name={f.icon}
              size={14}
              color={active ? theme.colors.textInverse : theme.colors.textMuted}
            />
            <Text
              style={{
                color: active ? theme.colors.textInverse : theme.colors.textMuted,
                fontSize: 11,
                fontWeight: '700',
              }}
              numberOfLines={1}
            >
              {f.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!tablet) {
    const statusActionLabel =
      analystStatus === 'pending'
        ? t('unique.actionPending')
        : analystStatus === 'approved'
          ? t('unique.actionEnterCode')
          : analystStatus === 'rejected'
            ? t('unique.actionRejected')
            : canPublish
              ? t('unique.actionPublish')
              : t('unique.joinAsAnalyst');

    const showPanel = showGatePanel || showJoinForm;

    return (
      <Screen bleed edges={['left', 'right']}>
        <FullScreenFeed
          data={fullScreenData}
          onLike={onFullLike}
          authorPresentation="handleOnly"
          onDoubleTap={(item) => void saveToPrivate(item)}
          adPlacement="unique"
          sponsoredActions={{
            onHide: (adId) => {
              void hideAd(adId, 'unique');
            },
            onReport: (adId, reason) => {
              void reportAd(adId, reason, 'unique');
            },
          }}
          emptyTitle={t('unique.emptyTitle')}
          emptyDescription={t('unique.emptyDesc')}
          emptyIcon="analytics-outline"
          topOverlaySafeArea
          topOverlay={
            <View
              style={[
                styles.mobileOverlay,
                showPanel ? styles.mobileOverlayExpanded : null,
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.mobileBar}>
                <View style={styles.topTools}>
                  <HeaderBackButton />
                  {filters}
                </View>
                {!showPanel ? (
                  <Button
                    label={statusActionLabel}
                    onPress={() => setShowGatePanel(true)}
                  />
                ) : null}
              </View>

              {showPanel ? (
                <ScrollView
                  style={[
                    styles.uniquePublishPanel,
                    { backgroundColor: theme.colors.surface },
                  ]}
                  contentContainerStyle={[
                    styles.uniquePublishPanelContent,
                    { paddingBottom: Math.max(insets.bottom, 12) + 16 },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {publishGate}
                  <Button
                    label={t('unique.closeAndReturn')}
                    variant="ghost"
                    onPress={() => {
                      setShowGatePanel(false);
                      setShowJoinForm(false);
                      setTermsAccepted(false);
                    }}
                  />
                </ScrollView>
              ) : null}
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StackTopChrome>{filters}</StackTopChrome>
      <Screen
        scroll
        contentStyle={{ ...styles.content, paddingTop: topPad }}
        edges={['left', 'right']}
      >
        <Muted>{t('unique.subtitle')}</Muted>

        {publishGate}
        <Subtitle>{t('unique.analystContent')}</Subtitle>
        {filtered.length === 0 ? (
          <EmptyState
            title={t('unique.emptyTitle')}
            description={t('unique.emptyDesc')}
            icon="analytics-outline"
          />
        ) : (
          filtered.map((item) => (
            <AnalysisCard
              key={item.id}
              item={item}
              textFocus={filter === 'text'}
              liked={item.likes.includes(currentUser.id)}
              onLike={() => toggleAnalysisLike(item.authorId, item.id)}
              onShare={() =>
                setSharePayload({
                  kind: 'content',
                  title: item.title,
                  body: analysisWrittenBody(item) || item.title,
                  mediaUrl:
                    filter === 'text'
                      ? undefined
                      : item.videoUrl || item.posterUrl,
                  mediaKind:
                    filter === 'text'
                      ? 'text'
                      : item.videoUrl
                        ? 'video'
                        : item.posterUrl
                          ? 'photo'
                          : 'text',
                })
              }
            />
          ))
        )}
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
  content: { paddingTop: 12, gap: 14, paddingBottom: 120 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 6,

  },
  filterIconBtn: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mobileOverlay: {
    gap: 8,
  },
  /** لوحة النشر في الفريد فقط — تمتد من أسفل الشريط العلوي حتى أسفل الشاشة */
  mobileOverlayExpanded: {
    flex: 1,
    minHeight: 0,
  },
  mobileBar: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  topTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,

  },
  uniquePublishPanel: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
  },
  uniquePublishPanelContent: {
    padding: 12,
    gap: 10,
    flexGrow: 1,
  },
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { fontWeight: '800', textAlign: 'left' },
  title: {
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'left',
  },
  body: {
    textAlign: 'left',
    lineHeight: 22,
  },
  videoBox: {
    height: 180,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaWrap: { position: 'relative' },
  mediaShare: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  posterImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#00000022',
  },
  pickedBox: { gap: 8 },
  textTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
  },
  kindBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsLabel: {
    flex: 1,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'left',
  },
  termsBody: {
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'left',
  },
});
