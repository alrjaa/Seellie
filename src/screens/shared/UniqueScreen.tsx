import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatArabicDate } from '@/utils';
import { ANALYST_TERMS, isActiveAnalyst, isAnalystSuspendActive } from '@/utils/analyst';
import {
  ANALYSIS_VIDEO_MAX_SEC,
  isVideoWithinLimit,
  videoDurationSecFromPicker,
} from '@/utils/media-limits';
import { ar } from '@/i18n/locales/ar';
import { en } from '@/i18n/locales/en';

type FeedFilter = 'all' | 'video' | 'text';

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

const AnalysisCard = memo(function AnalysisCard({
  item,
  liked,
  onLike,
  onShare,
}: {
  item: AnalysisItem;
  liked: boolean;
  onLike: () => void;
  onShare?: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const hasVideo = !!item.videoUrl;
  const isTextOnly = !hasVideo;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.author, { color: theme.colors.accent }]}>
            {item.authorHandle || item.authorName}
          </Text>
          <Muted>{formatArabicDate(item.timestamp)}</Muted>
        </View>
        {onShare && !hasVideo ? <TinyShareButton onPress={onShare} /> : null}
        <View
          style={[
            styles.kindBadge,
            { backgroundColor: theme.colors.accentSoft },
          ]}
        >
          <Ionicons
            name={hasVideo ? 'videocam' : 'document-text'}
            size={16}
            color={theme.colors.accent}
          />
        </View>
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>
        {item.title}
      </Text>

      {item.content && !isVisualAnalysisPlaceholder(item.content) ? (
        <Text style={[styles.body, { color: theme.colors.text }]}>
          {item.content}
        </Text>
      ) : null}

      {hasVideo ? (
        <View style={styles.mediaWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('unique.playAnalysisVideoA11y')}
            onPress={() => {
              void Linking.openURL(item.videoUrl!).catch(() => undefined);
            }}
            style={[
              styles.videoBox,
              { backgroundColor: theme.colors.surfaceElevated },
            ]}
          >
            <Ionicons name="play-circle" size={56} color={theme.colors.accent} />
            <Muted>{t('unique.analysisVideoTap')}</Muted>
          </Pressable>
          {onShare ? (
            <View style={styles.mediaShare}>
              <TinyShareButton onPress={onShare} />
            </View>
          ) : null}
        </View>
      ) : null}

      {isTextOnly ? (
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
    addAnalysis,
    toggleAnalysisLike,
    applyAsAnalyst,
    verifyAnalystAccessCode,
  } = useTournament();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const { tablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const saveToPrivate = useSaveToPrivateSpace();
  const topPad = stackTopChromePad(insets.top);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  /** الانضمام اختياري — لا نفرض نموذج الطلب على كل زائر */
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [showGatePanel, setShowGatePanel] = useState(false);
  const [sharePayload, setSharePayload] = useState<ContentSharePayload | null>(
    null
  );

  const analyses = useMemo(() => {
    const items: AnalysisItem[] = [];
    users.forEach((u) => {
      u.analysisContent
        .filter((a) => a.status !== 'blocked' && a.status !== 'suspended')
        .forEach((a) => {
          items.push({
            id: a.id,
            title: a.title,
            content: a.content,
            videoUrl: a.videoUrl,
            posterUrl: a.posterUrl,
            timestamp: new Date(a.timestamp),
            likes: a.likes,
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
    if (filter === 'text') return analyses.filter((a) => !a.videoUrl);
    return analyses;
  }, [analyses, filter]);

  const counts = useMemo(
    () => ({
      all: analyses.length,
      video: analyses.filter((a) => !!a.videoUrl).length,
      text: analyses.filter((a) => !a.videoUrl).length,
    }),
    [analyses]
  );

  const fullScreenData = useMemo<FullScreenContent[]>(() => {
    if (!currentUser) return [];
    return filtered.map((item) => {
      const hasVideo = !!item.videoUrl;
      const body =
        item.content && !isVisualAnalysisPlaceholder(item.content)
          ? item.content
          : '';
      return {
        id: item.id,
        kind: hasVideo ? 'video' : 'text',
        mediaUrl: item.videoUrl,
        posterUrl: item.posterUrl,
        title: item.title,
        text: hasVideo
          ? [item.title, body].filter(Boolean).join('\n')
          : body || item.title,
        authorId: item.authorId,
        authorName: item.authorName,
        authorAvatar: item.authorAvatar,
        authorHandle: item.authorHandle,
        subtitle: undefined,
        likes: item.likes,
        liked: item.likes.includes(currentUser.id),
      };
    });
  }, [currentUser, filtered]);

  const analystStatus = currentUser?.analyst?.status || 'none';
  const canPublish = isActiveAnalyst(currentUser);

  const pickVideo = useCallback(async () => {
    try {
      setPicking(true);
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
      setVideoUrl(asset.uri);
    } catch {
      toast({
        variant: 'destructive',
        title: t('unique.videoPickFailed'),
      });
    } finally {
      setPicking(false);
    }
  }, [toast, t]);

  const publish = useCallback(() => {
    if (!canPublish) return;
    const ok = addAnalysis({
      title,
      content,
      videoUrl: videoUrl.trim() || undefined,
    });
    if (ok) {
      setTitle('');
      setContent('');
      setVideoUrl('');
      setShowGatePanel(false);
    }
  }, [addAnalysis, canPublish, content, title, videoUrl]);

  const onFullLike = useCallback(
    (item: FullScreenContent) => {
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
          <Input
            label={t('unique.videoUrlOptional')}
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder={t('unique.videoUrlPlaceholder')}
            autoCapitalize="none"
            ltr
          />
          <MediaUploadSpecs
            kind="analysisVideo"
            title={t('media.specs.videoTitle')}
          />
          <Button
            label={
              picking ? t('unique.pickingVideo') : t('unique.pickVideoFromDevice')
            }
            variant="secondary"
            loading={picking}
            onPress={() => void pickVideo()}
          />
          <Button
            label={t('unique.publishToUnique')}
            onPress={publish}
            disabled={!title.trim() || (!content.trim() && !videoUrl.trim())}
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
              if (verifyAnalystAccessCode(accessCodeInput)) {
                setAccessCodeInput('');
              }
            }}
            disabled={!accessCodeInput.trim()}
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
            onPress={() => applyAsAnalyst(termsAccepted)}
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
          onPress={() => applyAsAnalyst(termsAccepted)}
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
          { key: 'all' as const, icon: 'grid-outline' as const, count: counts.all, label: t('unique.filterAll', { count: counts.all }) },
          { key: 'video' as const, icon: 'videocam-outline' as const, count: counts.video, label: t('unique.filterVideo', { count: counts.video }) },
          { key: 'text' as const, icon: 'document-text-outline' as const, count: counts.text, label: t('unique.filterText', { count: counts.text }) },
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
              {f.key === 'all'
                ? t('screens.all')
                : f.key === 'video'
                  ? t('screens.videos')
                  : t('sharesUi.texts')}
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
          emptyTitle={t('unique.emptyTitle')}
          emptyDescription={t('unique.emptyDesc')}
          emptyIcon="analytics-outline"
          topOverlaySafeArea
          topOverlay={
            <View style={styles.mobileOverlay} pointerEvents="box-none">
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
                    styles.mobilePanel,
                    { backgroundColor: theme.colors.surface },
                  ]}
                  contentContainerStyle={styles.mobilePanelContent}
                  keyboardShouldPersistTaps="handled"
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
              liked={item.likes.includes(currentUser.id)}
              onLike={() => toggleAnalysisLike(item.authorId, item.id)}
              onShare={() =>
                setSharePayload({
                  kind: 'content',
                  title: item.title,
                  body: item.content,
                  mediaUrl: item.videoUrl,
                  mediaKind: item.videoUrl ? 'video' : 'text',
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
    direction: 'ltr',
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
  mobileBar: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  topTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    direction: 'ltr',
  },
  mobilePanel: {
    maxHeight: 420,
    marginHorizontal: 12,
    borderRadius: 16,
  },
  mobilePanelContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 20,
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
