import React, {
  createElement,
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  AppState,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
  type LayoutChangeEvent,
  type ListRenderItem,
  type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useTournamentCore } from '@/providers/TournamentProvider';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LikeButton } from '@/components/ui';
import { useFloatingVisibility } from '@/hooks/useFloatingVisibility';
import {
  claimFloatingScrollSource,
  forceFloatingVisible,
  noteFloatingScrollBegin,
  noteFloatingScrollOffset,
  noteFloatingScrollSettle,
  releaseFloatingScrollSource,
  setFloatingSuppressed,
} from '@/services/floating-scroll-bus';
import {
  setContentAuthorFocus,
} from '@/services/content-author-bus';
import { setPrivateChatComposerFocused } from '@/services/private-chat-focus';
import {
  addContentItemComment,
  getContentItemComments,
  seedContentItemComments,
  subscribeContentItemComments,
  type ContentItemComment,
} from '@/services/content-item-comments';
import { createId } from '@/utils/id';
import { cairoText } from '@/theme/fonts';
import { FAB_COLUMN_WIDTH } from '@/theme/navigation';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';
import { WEB_INPUT_MIN_FONT_SIZE } from '@/theme/web-keyboard-viewport';
import { NATIVE_AD_HOOK_MS } from '@/services/native-ads';

export type FullScreenContentComment = {
  id: string;
  text: string;
  authorId?: string;
  authorName: string;
  authorAvatar?: string;
  timestamp?: number | Date | string;
};

export type FullScreenContent = {
  id: string;
  kind: 'photo' | 'video' | 'text';
  mediaUrl?: string;
  posterUrl?: string;
  title?: string;
  text?: string;
  authorId?: string;
  authorName: string;
  authorHandle?: string;
  authorAvatar?: string;
  subtitle?: string;
  /**
   * مدينة/منطقة للعرض بجانب زر التعليقات (نفس سطر وحجم خط التعليقات).
   * يُمرَّر من الشاشات عند توفر البيانات فقط.
   */
  locationLabel?: string;
  likes: string[];
  liked: boolean;
  /** تعليقات مرتبطة بالمحتوى (وسائط / تحليل …) */
  comments?: FullScreenContentComment[];
  /** إعلان مدمج داخل الفيد — بدون إعجاب/تعليق/حفظ */
  sponsored?: boolean;
  hookText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

type Props = {
  data: FullScreenContent[];
  onLike: (item: FullScreenContent) => void;
  /**
   * حفظ التعليق على المصدر (وسائط…).
   * إن أعاد تعليقاً يُعرض فوراً بنفس المعرّف.
   */
  onComment?: (
    item: FullScreenContent,
    text: string
  ) => FullScreenContentComment | null | void;
  onPressAuthor?: (item: FullScreenContent) => void;
  /** نقرتان على المحتوى → مساحة خاصة */
  onDoubleTap?: (item: FullScreenContent) => void;
  /** full = صورة + اسم · handleOnly = المعرّف فقط مثل @follower */
  authorPresentation?: 'full' | 'handleOnly';
  topOverlay?: ReactNode;
  /**
   * true = تحت شريط الحالة مباشرة (تبويبات بدون هيدر)
   * false = تحت هيدر Stack — مسافة خفيفة فقط
   */
  topOverlaySafeArea?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
};

function toStoreComment(c: FullScreenContentComment): ContentItemComment {
  const ts =
    typeof c.timestamp === 'number'
      ? c.timestamp
      : c.timestamp
        ? new Date(c.timestamp).getTime()
        : Date.now();
  return {
    id: c.id,
    text: c.text,
    authorId: c.authorId || '',
    authorName: c.authorName,
    authorAvatar: c.authorAvatar,
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
  };
}

function useContentComments(
  contentId: string,
  seed?: FullScreenContentComment[]
) {
  const [, setTick] = useState(0);
  useEffect(() => {
    return subscribeContentItemComments(contentId, () =>
      setTick((n) => n + 1)
    );
  }, [contentId]);
  const seedKey =
    seed && seed.length
      ? seed.map((c) => `${c.id}:${c.text}`).join('|')
      : '';
  useEffect(() => {
    if (!seed?.length) return;
    seedContentItemComments(contentId, seed.map(toStoreComment));
    // seedKey captures identity; avoid re-seed on new array refs with same data
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seedKey stands in for seed
  }, [contentId, seedKey]);
  return getContentItemComments(contentId);
}

const Slide = memo(function Slide({
  item,
  height,
  active,
  onLike,
  onComment,
  onDoubleTap,
  onComposerFocusChange,
}: {
  item: FullScreenContent;
  height: number;
  active: boolean;
  onLike: () => void;
  onComment?: (
    item: FullScreenContent,
    text: string
  ) => FullScreenContentComment | null | void;
  onDoubleTap?: () => void;
  /** يجمّد ارتفاع الـ feed أثناء التركيز — لا يُمرَّر ارتفاع visualViewport إلى الشريحة */
  onComposerFocusChange?: (focused: boolean) => void;
}) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { currentUser, featureFlags } = useTournamentCore();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const htmlVideoRef = useRef<HTMLVideoElement | null>(null);
  /** F12-P2-05 — ignore stale play()/setState after fast swipe away */
  const playGenRef = useRef(0);
  const inputRef = useRef<TextInput>(null);
  /** تشغيل تلقائي عند الظهور — بدون زر تشغيل */
  const [paused, setPaused] = useState(!active);
  const [loadError, setLoadError] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  /** لوحة تعليقات هذا المحتوى — تمتد أسفل شاشة المحتوى */
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  /** إزاحة لوحة المفاتيح فقط — لا تغيّر ارتفاع الـ feed الأساسي */
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const composerFocusedRef = useRef(false);
  const lastTapRef = useRef(0);
  const lockedScrollYRef = useRef(0);
  const insetRafRef = useRef<number | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comments = useContentComments(item.id, item.comments);
  const bottomPad = Math.max(insets.bottom, 6) + 4;
  const commentsPanelHeight = 210 + Math.max(insets.bottom, 8);
  const sponsored = !!item.sponsored;
  const [showHook, setShowHook] = useState(false);

  const clearComposerFocus = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    composerFocusedRef.current = false;
    setComposerFocused(false);
    setKeyboardInset(0);
    setPrivateChatComposerFocused(false);
    setFloatingSuppressed(false);
    onComposerFocusChange?.(false);
  }, [onComposerFocusChange]);

  const publishKeyboardInset = useCallback((inset: number) => {
    if (!composerFocusedRef.current) {
      setKeyboardInset(0);
      return;
    }
    // كامل ارتفاع اللوحة المحجوز أسفل الـ viewport — بدون سقف يمنع ظهور الحقل
    setKeyboardInset(Math.max(0, Math.round(inset)));
  }, []);

  useEffect(() => {
    if (!active) {
      setCommentsExpanded(false);
      setDraft('');
      Keyboard.dismiss();
      clearComposerFocus();
    }
  }, [active, item.id, clearComposerFocus]);

  useEffect(() => {
    if (!active || !sponsored || !item.hookText?.trim()) {
      setShowHook(false);
      return;
    }
    setShowHook(true);
    const timer = setTimeout(() => setShowHook(false), NATIVE_AD_HOOK_MS);
    return () => clearTimeout(timer);
  }, [active, sponsored, item.hookText, item.id]);

  // لا تركيز تلقائي: يبقى Composer ظاهرًا قبل الضغط على الحقل
  // (المستخدم يضغط «إضافة تعليق» لفتح اللوحة)

  // ويب: قياس keyboard inset من visualViewport — حجز سفلي فقط، بلا تحريك الشاشة
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!commentsExpanded || !composerFocused) {
      publishKeyboardInset(0);
      return;
    }

    const vv = window.visualViewport;
    lockedScrollYRef.current = window.scrollY || 0;

    const measure = () => {
      if (!composerFocusedRef.current) {
        publishKeyboardInset(0);
        return;
      }
      const layoutH = window.innerHeight;
      const vvH = vv?.height ?? layoutH;
      const vvTop = vv?.offsetTop ?? 0;
      publishKeyboardInset(Math.max(0, layoutH - vvH - vvTop));
    };

    const schedule = () => {
      if (insetRafRef.current != null) return;
      insetRafRef.current = requestAnimationFrame(() => {
        insetRafRef.current = null;
        const y = lockedScrollYRef.current;
        if (Math.abs((window.scrollY || 0) - y) > 1) {
          window.scrollTo({ top: y, left: 0, behavior: 'auto' });
        }
        measure();
      });
    };

    measure();
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);

    return () => {
      if (insetRafRef.current != null) {
        cancelAnimationFrame(insetRafRef.current);
        insetRafRef.current = null;
      }
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [commentsExpanded, composerFocused, publishKeyboardInset]);

  // أصلي: Keyboard API — حجز سفلي فقط
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!commentsExpanded) {
      setKeyboardInset(0);
      return;
    }
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      if (!composerFocusedRef.current) return;
      publishKeyboardInset(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      publishKeyboardInset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [commentsExpanded, publishKeyboardInset]);

  useEffect(() => {
    return () => {
      clearComposerFocus();
    };
  }, [clearComposerFocus]);

  const openCommentsPanel = useCallback(() => {
    setCommentsExpanded(true);
  }, []);

  const dismissCommentsPanel = useCallback(() => {
    setCommentsExpanded(false);
    Keyboard.dismiss();
    clearComposerFocus();
  }, [clearComposerFocus]);

  const onComposerFocus = useCallback(() => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    composerFocusedRef.current = true;
    setComposerFocused(true);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      lockedScrollYRef.current = window.scrollY || 0;
    }
    // أنظمة موجودة: إخفاء التبويب + FAB أثناء الكتابة (لا نظام جديد)
    setPrivateChatComposerFocused(true);
    setFloatingSuppressed(true);
    onComposerFocusChange?.(true);
  }, [onComposerFocusChange]);

  const onComposerBlur = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      clearComposerFocus();
    }, 140);
  }, [clearComposerFocus]);

  const playableUri =
    !!item.mediaUrl && /^https?:\/\//i.test(item.mediaUrl.trim());

  useEffect(() => {
    setLoadError(false);
    setFrameReady(false);
    setPaused(true);
    playGenRef.current += 1;
    void videoRef.current?.pauseAsync().catch(() => undefined);
    const el = htmlVideoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, [item.id, item.mediaUrl]);

  useEffect(() => {
    if (!active) {
      playGenRef.current += 1;
      setPaused(true);
      void videoRef.current?.pauseAsync().catch(() => undefined);
      const el = htmlVideoRef.current;
      if (el) {
        el.pause();
        try {
          el.removeAttribute('src');
          el.load();
        } catch {
          // ignore
        }
      }
      // FIX-04 P1 / F12-P2-05: unload on native (release AVPlayer / ExoPlayer)
      void videoRef.current?.unloadAsync().catch(() => undefined);
      return;
    }
    // ظاهر على الشاشة → شغّل فوراً
    setPaused(false);
  }, [active]);

  // Unmount: release any remaining player / web element
  useEffect(() => {
    return () => {
      playGenRef.current += 1;
      void videoRef.current?.pauseAsync().catch(() => undefined);
      void videoRef.current?.unloadAsync().catch(() => undefined);
      const el = htmlVideoRef.current;
      if (el) {
        try {
          el.pause();
          el.removeAttribute('src');
          el.load();
        } catch {
          // ignore
        }
      }
      htmlVideoRef.current = null;
    };
  }, []);

  // ويب: تشغيل تلقائي صامت (سياسة المتصفح) عند الظهور
  useEffect(() => {
    if (Platform.OS !== 'web' || !active || !playableUri || loadError || paused) {
      return;
    }
    const el = htmlVideoRef.current;
    if (!el || !item.mediaUrl) return;
    const gen = playGenRef.current;
    if (el.getAttribute('src') !== item.mediaUrl) {
      el.src = item.mediaUrl;
    }
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.loop = true;
    const run = el.play();
    if (run && typeof run.then === 'function') {
      void run
        .then(() => {
          if (playGenRef.current !== gen) return;
          setFrameReady(true);
          setPaused(false);
        })
        .catch(() => {
          if (playGenRef.current !== gen) return;
          // إن مُنع التشغيل نُبقي بدون زر — الإطار/البوستر يكفي
          setFrameReady(true);
        });
    } else {
      setFrameReady(true);
    }
  }, [active, playableUri, loadError, paused, item.mediaUrl]);

  // أصلي: تشغيل تلقائي عند الظهور
  useEffect(() => {
    if (Platform.OS === 'web' || !active || !playableUri || loadError || paused) {
      return;
    }
    const gen = playGenRef.current;
    void videoRef.current?.playAsync()
      .then(() => {
        if (playGenRef.current !== gen) {
          void videoRef.current?.pauseAsync().catch(() => undefined);
          void videoRef.current?.unloadAsync().catch(() => undefined);
        }
      })
      .catch(() => {
        if (playGenRef.current !== gen) return;
        setLoadError(true);
        setPaused(true);
      });
  }, [active, playableUri, loadError, paused]);

  const toggleVideoPlayback = useCallback(async () => {
    if (!playableUri || loadError) return;
    try {
      if (Platform.OS === 'web') {
        const el = htmlVideoRef.current;
        if (!el) return;
        if (paused) {
          el.muted = true;
          await el.play();
          setPaused(false);
        } else {
          el.pause();
          setPaused(true);
        }
        return;
      }
      if (paused) {
        setPaused(false);
        await videoRef.current?.playAsync();
      } else {
        setPaused(true);
        await videoRef.current?.pauseAsync();
      }
    } catch {
      setLoadError(true);
      setPaused(true);
    }
  }, [paused, playableUri, loadError]);

  const handleLikePress = useCallback(() => {
    if (sponsored) return;
    onLike();
  }, [onLike, sponsored]);

  const openCta = useCallback(() => {
    const url = (item.ctaUrl || '').trim();
    if (!url.startsWith('https://')) return;
    void Linking.openURL(url);
  }, [item.ctaUrl]);

  const submitComment = useCallback(() => {
    const trimmed = draft.trim().slice(0, 120);
    if (!trimmed) return;
    if (!currentUser) return;
    if (currentUser.permissions?.canComment === false) return;
    if (!featureFlags.commentComposerEnabled) return;
    const fromParent = onComment?.(item, trimmed);
    const stored = fromParent
      ? toStoreComment(fromParent)
      : {
          id: createId('cmt'),
          text: trimmed,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar,
          timestamp: Date.now(),
        };
    addContentItemComment(item.id, stored);
    setDraft('');
    // تبقى اللوحة مفتوحة لرؤية التعليق ضمن نفس المحتوى
  }, [draft, currentUser, featureFlags.commentComposerEnabled, onComment, item]);

  const handleContentPress = useCallback(() => {
    if (commentsExpanded) {
      dismissCommentsPanel();
      return;
    }
    const now = Date.now();
    if (!sponsored && onDoubleTap && now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      onDoubleTap();
      return;
    }
    lastTapRef.current = now;
    if (item.kind === 'video') {
      void toggleVideoPlayback();
    }
  }, [
    commentsExpanded,
    dismissCommentsPanel,
    item.kind,
    onDoubleTap,
    sponsored,
    toggleVideoPlayback,
  ]);

  return (
    <View style={[styles.slide, { height, backgroundColor: '#000' }]}>
      {/* شاشة المحتوى — تنكمش للأعلى عند امتداد لوحة التعليقات */}
      <View style={styles.contentPane}>
        {item.kind === 'photo' && item.mediaUrl ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={handleContentPress}>
            <Image
              source={{ uri: item.mediaUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={180}
            />
          </Pressable>
        ) : null}

        {item.kind === 'video' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              paused ? t('media.playVideo') : t('media.pauseVideo')
            }
            onPress={handleContentPress}
            style={styles.videoFill}
          >
            {playableUri && !loadError && active && Platform.OS === 'web'
              ? createElement('video', {
                  ref: (node: HTMLVideoElement | null) => {
                    htmlVideoRef.current = node;
                  },
                  src: item.mediaUrl,
                  muted: true,
                  defaultMuted: true,
                  autoPlay: true,
                  playsInline: true,
                  preload: 'metadata',
                  loop: true,
                  controls: false,
                  poster: item.posterUrl || undefined,
                  style: {
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    backgroundColor: '#000',
                  },
                  onError: () => {
                    setLoadError(true);
                    setPaused(true);
                  },
                  onLoadedData: () => setFrameReady(true),
                  onPlaying: () => {
                    setFrameReady(true);
                    setPaused(false);
                  },
                })
              : null}

            {playableUri && !loadError && active && Platform.OS !== 'web' ? (
              <Video
                ref={videoRef}
                source={{ uri: item.mediaUrl! }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                shouldPlay={!paused}
                isLooping
                isMuted={false}
                useNativeControls={false}
                pointerEvents="none"
                onReadyForDisplay={() => setFrameReady(true)}
                onError={() => {
                  setLoadError(true);
                  setPaused(true);
                }}
              />
            ) : null}

            {item.posterUrl &&
            (loadError || !playableUri || !active || (!frameReady && paused)) ? (
              <Image
                source={{ uri: item.posterUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : null}

            {loadError || !playableUri ? (
              <View style={styles.playWrap}>
                <Ionicons name="alert-circle-outline" size={56} color="#fff" />
                <Text style={styles.playLabel}>{t('media.videoPlayFailed')}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {item.kind === 'text' ? (
          <Pressable
            onPress={handleContentPress}
            style={[
              styles.textSlide,
              {
                // عمود FAB ثابت يساراً — لا عكس padding مع RTL
                paddingLeft: FAB_COLUMN_WIDTH + 12,
                paddingRight: 28,
              },
            ]}
          >
            {item.title ? (
              <Text
                style={[
                  styles.textTitleLight,
                  {
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                ]}
              >
                {item.title}
              </Text>
            ) : null}
            {item.text ? (
              <Text
                style={[
                  styles.textBodyLight,
                  {
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  },
                ]}
              >
                {item.text}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        {item.kind !== 'text' ? (
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.55)',
              'transparent',
              'transparent',
              'rgba(0,0,0,0.75)',
            ]}
            locations={[0, 0.18, 0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : null}

        {sponsored ? (
          <View
            pointerEvents="none"
            style={[
              styles.adBadge,
              { top: Math.max(insets.top, 10) + 8 },
            ]}
          >
            <Text style={[styles.adBadgeText, cairoText('semiBold')]}>
              {t('ui.sponsoredBadge')}
            </Text>
          </View>
        ) : null}

        {sponsored && showHook && item.hookText?.trim() ? (
          <View
            pointerEvents="none"
            style={[
              styles.hookBanner,
              { top: Math.max(insets.top, 10) + 40 },
            ]}
          >
            <Text
              style={[
                styles.hookText,
                cairoText('extraBold'),
                {
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
              ]}
              numberOfLines={2}
            >
              {item.hookText.trim()}
            </Text>
          </View>
        ) : null}

        <View
          pointerEvents="box-none"
          style={[
            styles.bottomBar,
            {
              bottom: bottomPad + 8,
            },
          ]}
        >
          {(item.kind === 'video' || item.kind === 'photo') &&
          (item.title || item.text) ? (
            <Text
              style={[
                styles.titleBesideComments,
                cairoText('semiBold'),
                {
                  // مساحة ثابتة يمين العنوان لأزرار الإعجاب/التعليقات (يمين فيزيائي)
                  left: 14,
                  right: 14 + 88,
                  // ارفع العنوان إن وُجدت تسمية موقع على سطر التعليقات
                  bottom: item.locationLabel?.trim() ? 28 : 8,
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
              ]}
              numberOfLines={2}
            >
              {(item.title || '').trim() || (item.text || '').trim()}
            </Text>
          ) : null}
          <View style={styles.actionsColumn}>
            {sponsored ? (
              item.ctaUrl ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.ctaLabel?.trim() || t('ui.adCtaDefault')
                  }
                  onPress={openCta}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.adCta,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Text
                    style={[styles.adCtaText, cairoText('semiBold')]}
                    numberOfLines={2}
                  >
                    {item.ctaLabel?.trim() || t('ui.adCtaDefault')}
                  </Text>
                </Pressable>
              ) : null
            ) : (
              <>
            <LikeButton
              count={item.likes.length}
              liked={item.liked}
              onPress={handleLikePress}
              tone="light"
              size="md"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('ui.comments')}
              onPress={() => {
                if (commentsExpanded) dismissCommentsPanel();
                else openCommentsPanel();
              }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.commentsLink,
                { opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text style={[styles.commentsLinkText, cairoText('medium')]}>
                {t('ui.comments')}
                {comments.length > 0 ? ` ${comments.length}` : ''}
              </Text>
            </Pressable>
              </>
            )}
          </View>
          {/* موقع المدينة/المنطقة — نفس سطر وحجم خط زر التعليقات (مرجع اللقطات) */}
          {item.locationLabel?.trim() ? (
            <Text
              style={[
                styles.locationBesideComments,
                styles.commentsLinkText,
                cairoText('medium'),
                {
                  left: 14,
                  right: 14 + 88,
                  // دائماً بجوار عمود التعليقات (يمين فيزيائي) — اتجاه الكتابة فقط يتبع اللغة
                  textAlign: 'right',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.locationLabel.trim()}
            </Text>
          ) : null}
        </View>
      </View>

      {/* تظهر فقط بعد النقر على «تعليقات»: Composer ظاهر ثم قائمة التعليقات */}
      {commentsExpanded && !sponsored ? (
        <View
          style={[
            styles.commentsExpandPanel,
            {
              height: commentsPanelHeight,
              // Safe area عندما لا توجد لوحة؛ مع اللوحة يُحجز ارتفاعها بـ marginBottom
              paddingBottom:
                keyboardInset > 0 ? 8 : Math.max(insets.bottom, 10),
              // حجز مساحة لوحة المفاتيح أسفل اللوحة (layout) — ليس translateY
              marginBottom: keyboardInset > 0 ? keyboardInset : 0,
            },
          ]}
        >
          {featureFlags.commentComposerEnabled &&
          currentUser?.permissions?.canComment !== false ? (
          <View
            style={[
              styles.addCommentRow,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={(v) =>
                setDraft(v.replace(/\n+/g, ' ').slice(0, 120))
              }
              placeholder={t('ui.addCommentPlaceholder')}
              placeholderTextColor="#666"
              onFocus={onComposerFocus}
              onBlur={onComposerBlur}
              style={[
                styles.addCommentInput,
                cairoText('regular'),
                { textAlign: isRTL ? 'right' : 'left' },
              ]}
              multiline
              numberOfLines={2}
              maxLength={120}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={submitComment}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.send')}
              onPress={submitComment}
              style={({ pressed }) => [
                styles.addCommentSend,
                { opacity: pressed ? 0.65 : draft.trim() ? 1 : 0.4 },
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={theme.colors.accent || '#2563eb'}
              />
            </Pressable>
          </View>
          ) : null}
          <ScrollView
            style={styles.commentsList}
            contentContainerStyle={styles.commentsListContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {comments.length === 0 ? (
              <Text
                style={[
                  styles.commentEmpty,
                  cairoText('medium'),
                  { textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('ui.noItemComments')}
              </Text>
            ) : (
              comments.map((c) => (
                <Text
                  key={c.id}
                  style={[
                    styles.commentLine,
                    cairoText('regular'),
                    { textAlign: isRTL ? 'right' : 'left' },
                  ]}
                  numberOfLines={2}
                >
                  {c.text}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
});

/**
 * Mobile immersive feed: one content item fills the viewport; snap scroll vertically.
 */
function FullScreenFeedComponent({
  data,
  onLike,
  onComment,
  onPressAuthor,
  onDoubleTap,
  authorPresentation = 'full',
  topOverlay,
  topOverlaySafeArea = true,
  emptyTitle,
  emptyDescription,
  emptyIcon = 'images-outline',
}: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { visible } = useFloatingVisibility(true);
  const reactId = useId();
  const sourceId = `feed:${reactId}`;
  const [height, setHeight] = useState(0);
  const heightRef = useRef(0);
  const freezeFeedHeightRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(data[0]?.id ?? null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const overlayTranslate = useRef(new Animated.Value(0)).current;
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
  }).current;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  // ويب: حماية لوحة المفاتيح/الزوم مركزية عبر injectWebKeyboardViewport في جذر التطبيق
  useEffect(() => {
    if (!focused) {
      releaseFloatingScrollSource(sourceId);
      return;
    }
    claimFloatingScrollSource(sourceId);
    return () => {
      releaseFloatingScrollSource(sourceId);
    };
  }, [focused, sourceId]);

  useEffect(() => {
    if (!focused) return;
    const active =
      data.find((item) => item.id === activeId) || data[0] || null;
    if (!active?.authorId || active.sponsored) return;
    setContentAuthorFocus({
      id: String(active.authorId),
      name: active.authorName || active.authorHandle || String(active.authorId),
      handle: active.authorHandle,
      avatar: active.authorAvatar,
    });
  }, [focused, activeId, data]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && focused) forceFloatingVisible();
    });
    return () => sub.remove();
  }, [focused]);

  const onScrollBeginDrag = useCallback(() => {
    if (!focused) return;
    noteFloatingScrollBegin(sourceId);
  }, [focused, sourceId]);
  const onMomentumScrollBegin = useCallback(() => {
    if (!focused) return;
    noteFloatingScrollBegin(sourceId);
  }, [focused, sourceId]);
  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (!focused) return;
      noteFloatingScrollOffset(sourceId, e.nativeEvent.contentOffset.y);
    },
    [focused, sourceId]
  );
  const onScrollEndDrag = useCallback(() => {
    if (!focused) return;
    noteFloatingScrollSettle(sourceId);
  }, [focused, sourceId]);
  const onMomentumScrollEnd = useCallback(() => {
    if (!focused) return;
    noteFloatingScrollSettle(sourceId);
  }, [focused, sourceId]);

  const overlayPadTop = topOverlaySafeArea
    ? insets.top + HEADER_BELOW_STATUS_GAP
    : 8;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';
    if (visible) {
      overlayOpacity.setValue(1);
      overlayTranslate.setValue(0);
    }
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 180 : 120,
        useNativeDriver: useNative,
      }),
      Animated.timing(overlayTranslate, {
        toValue: visible ? 0 : -12,
        duration: visible ? 180 : 120,
        useNativeDriver: useNative,
      }),
    ]).start();
  }, [overlayOpacity, overlayTranslate, visible]);

  useEffect(() => {
    setActiveId(data[0]?.id ?? null);
  }, [data]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    if (next <= 0) return;
    // أثناء تركيز حقل التعليق: لا تسمح لـ visualViewport/keyboard بتقليص ارتفاع الـ feed
    if (
      freezeFeedHeightRef.current &&
      heightRef.current > 0 &&
      next < heightRef.current - 1
    ) {
      return;
    }
    heightRef.current = next;
    setHeight(next);
  }, []);

  const onComposerFocusChange = useCallback((focused: boolean) => {
    freezeFeedHeightRef.current = focused;
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.item);
      if (first?.item && typeof first.item === 'object' && 'id' in first.item) {
        const item = first.item as FullScreenContent;
        setActiveId(item.id);
        // فوراً: صاحب المحتوى الظاهر في الأزرار العائمة
        if (item.authorId) {
          setContentAuthorFocus({
            id: String(item.authorId),
            name: item.authorName || item.authorHandle || String(item.authorId),
            handle: item.authorHandle,
            avatar: item.authorAvatar,
          });
        }
      }
    }
  ).current;

  const renderItem = useCallback<ListRenderItem<FullScreenContent>>(
    ({ item }) => (
      <Slide
        item={item}
        height={height}
        active={focused && appActive && item.id === activeId}
        onLike={() => onLike(item)}
        onComment={onComment}
        onDoubleTap={onDoubleTap ? () => onDoubleTap(item) : undefined}
        onComposerFocusChange={onComposerFocusChange}
      />
    ),
    [
      activeId,
      appActive,
      focused,
      height,
      onLike,
      onComment,
      onDoubleTap,
      onComposerFocusChange,
    ]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<FullScreenContent> | null | undefined, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height]
  );

  const resolvedEmptyTitle = emptyTitle ?? t('empty.defaultTitle');
  const resolvedEmptyDescription =
    emptyDescription ?? t('empty.defaultDescription');

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.colors.background },
      ]}
      onLayout={onLayout}
    >
      {height > 0 ? (
        <FlatList
          data={data}
          keyExtractor={(item, index) => `${item.id}__${index}`}
          renderItem={renderItem}
          pagingEnabled
          disableIntervalMomentum
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={height > 0 ? getItemLayout : undefined}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={false}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollBegin={onMomentumScrollBegin}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={
            <View style={[styles.empty, { height }]}>
              <EmptyState
                title={resolvedEmptyTitle}
                description={resolvedEmptyDescription}
                icon={emptyIcon}
              />
            </View>
          }
        />
      ) : null}

      {topOverlay ? (
        <Animated.View
          style={[
            styles.overlay,
            {
              paddingTop: overlayPadTop,
              opacity: overlayOpacity,
              transform: [{ translateY: overlayTranslate }],
            },
          ]}
          pointerEvents={visible ? 'box-none' : 'none'}
        >
          {topOverlay}
        </Animated.View>
      ) : null}
    </View>
  );
}

export const FullScreenFeed = memo(FullScreenFeedComponent);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // عزل مواضع absolute عن RTL الأب حتى لا يختلف الإطار بين ar/en
    direction: 'ltr',
  },
  slide: {
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
    direction: 'ltr',
  },
  contentPane: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  textSlide: {
    ...StyleSheet.absoluteFillObject,
    paddingVertical: 80,
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#0d1a26',
  },
  textTitleLight: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  textBodyLight: {
    fontSize: 18,
    lineHeight: 30,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  /**
   * إعجاب + تعليقات مثبتة يمين الشاشة فيزيائياً في اللغتين.
   * العنوان يسارهما؛ اتجاه النص فقط يتبع اللغة.
   */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 6,
    elevation: 6,
    minHeight: 72,
    direction: 'ltr',
  },
  titleBesideComments: {
    position: 'absolute',
    bottom: 8,
    zIndex: 5,
    color: '#fff',
    fontSize: Platform.OS === 'android' ? 13 : 14,
    lineHeight: Platform.OS === 'android' ? 18 : 20,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  /** محاذاة رأسية مع زر التعليقات داخل actionsColumn (bottom: 0) */
  locationBesideComments: {
    position: 'absolute',
    bottom: 2,
    zIndex: 5,
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionsColumn: {
    position: 'absolute',
    right: 14,
    bottom: 0,
    zIndex: 7,
    elevation: 7,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    width: 88,
  },
  handlePress: {
    maxWidth: 160,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  handleOnly: {
    color: '#fff',
    fontWeight: '800',
    fontSize: Platform.OS === 'android' ? 11 : 12,
    textAlign: 'left',
  },
  commentsLink: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  commentsLinkText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  commentsExpandPanel: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
    /** يترك مساحة لعمود الأزرار العائمة يساراً (~10 + 52 + فراغ) */
    paddingLeft: 78,
    paddingRight: 16,
    paddingTop: 8,
    zIndex: 8,
    direction: 'ltr',
  },
  addCommentRow: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    maxWidth: 420,
    alignSelf: 'stretch',
  },
  addCommentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 44,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#111',
    // ويب: ≥16 يمنع زوم iOS Safari عند التركيز — أصلي يبقى 14 كما كان
    fontSize: Platform.OS === 'web' ? WEB_INPUT_MIN_FONT_SIZE : 14,
    lineHeight: Platform.OS === 'web' ? 20 : 18,
    // ويب: منع إطار التركيز الأزرق الافتراضي
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
      : null),
  },
  addCommentSend: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  commentsList: {
    flex: 1,
    maxWidth: 420,
    alignSelf: 'stretch',
  },
  commentsListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  commentLine: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
    backgroundColor: 'transparent',
  },
  commentEmpty: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
  empty: {
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  adBadge: {
    position: 'absolute',
    left: 14,
    zIndex: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  adBadgeText: {
    color: '#fff',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  hookBanner: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hookText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  adCta: {
    minHeight: 44,
    minWidth: 72,
    maxWidth: 88,
    borderRadius: 12,
    backgroundColor: 'rgba(37,244,238,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  adCtaText: {
    color: '#0d1a26',
    fontSize: 11,
    textAlign: 'center',
  },
});
