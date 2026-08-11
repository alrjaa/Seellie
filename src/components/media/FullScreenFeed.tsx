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
  I18nManager,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
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
import { useTournament } from '@/providers/TournamentProvider';
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
} from '@/services/floating-scroll-bus';
import {
  setContentAuthorFocus,
} from '@/services/content-author-bus';
import {
  addContentItemComment,
  getContentItemComments,
  seedContentItemComments,
  subscribeContentItemComments,
  type ContentItemComment,
} from '@/services/content-item-comments';
import { createId } from '@/utils/id';
import { cairoText } from '@/theme/fonts';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';

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
  likes: string[];
  liked: boolean;
  /** تعليقات مرتبطة بالمحتوى (وسائط / تحليل …) */
  comments?: FullScreenContentComment[];
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
    return subscribeContentItemComments(() => setTick((n) => n + 1));
  }, []);
  useEffect(() => {
    if (!seed?.length) return;
    seedContentItemComments(contentId, seed.map(toStoreComment));
  }, [contentId, seed]);
  return getContentItemComments(contentId);
}

const Slide = memo(function Slide({
  item,
  height,
  active,
  onLike,
  onComment,
  onDoubleTap,
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
}) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const { currentUser } = useTournament();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const htmlVideoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<TextInput>(null);
  /** تشغيل تلقائي عند الظهور — بدون زر تشغيل */
  const [paused, setPaused] = useState(!active);
  const [loadError, setLoadError] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const lastTapRef = useRef(0);
  const comments = useContentComments(item.id, item.comments);
  const bottomPad = Math.max(insets.bottom, 6) + 4;
  // زر الإعجاب على اليمين فيزيائياً — المعرّف انتقل للأزرار العائمة
  const dockSide =
    I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL
      ? ({ left: 14 } as const)
      : ({ right: 14 } as const);

  useEffect(() => {
    if (!active) {
      setComposerOpen(false);
      setListOpen(false);
      setDraft('');
      Keyboard.dismiss();
    }
  }, [active, item.id]);

  useEffect(() => {
    if (composerOpen) {
      const tmr = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(tmr);
    }
  }, [composerOpen]);

  const playableUri =
    !!item.mediaUrl && /^https?:\/\//i.test(item.mediaUrl.trim());

  useEffect(() => {
    setLoadError(false);
    setFrameReady(false);
    setPaused(true);
    void videoRef.current?.pauseAsync().catch(() => undefined);
    const el = htmlVideoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, [item.id, item.mediaUrl]);

  useEffect(() => {
    if (!active) {
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
      if (Platform.OS === 'web') {
        void videoRef.current?.unloadAsync().catch(() => undefined);
      }
      return;
    }
    // ظاهر على الشاشة → شغّل فوراً
    setPaused(false);
  }, [active]);

  // ويب: تشغيل تلقائي صامت (سياسة المتصفح) عند الظهور
  useEffect(() => {
    if (Platform.OS !== 'web' || !active || !playableUri || loadError || paused) {
      return;
    }
    const el = htmlVideoRef.current;
    if (!el || !item.mediaUrl) return;
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
          setFrameReady(true);
          setPaused(false);
        })
        .catch(() => {
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
    void videoRef.current?.playAsync().catch(() => {
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

  const dismissOverlays = useCallback(() => {
    setComposerOpen(false);
    setListOpen(false);
    Keyboard.dismiss();
  }, []);

  const handleLikePress = useCallback(() => {
    onLike();
    setListOpen(false);
    setComposerOpen(true);
  }, [onLike]);

  const submitComment = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) {
      dismissOverlays();
      return;
    }
    if (!currentUser) return;
    if (currentUser.permissions?.canComment === false) {
      dismissOverlays();
      return;
    }
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
    setComposerOpen(false);
    Keyboard.dismiss();
  }, [draft, currentUser, onComment, item, dismissOverlays]);

  const handleContentPress = useCallback(() => {
    if (composerOpen || listOpen) {
      dismissOverlays();
      return;
    }
    const now = Date.now();
    if (onDoubleTap && now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      onDoubleTap();
      return;
    }
    lastTapRef.current = now;
    if (item.kind === 'video') {
      void toggleVideoPlayback();
    }
  }, [
    composerOpen,
    listOpen,
    dismissOverlays,
    item.kind,
    onDoubleTap,
    toggleVideoPlayback,
  ]);

  return (
    <View style={[styles.slide, { height, backgroundColor: '#000' }]}>
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
                preload: 'auto',
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
            { backgroundColor: theme.colors.surfaceElevated },
          ]}
        >
          {item.title ? (
            <Text style={[styles.textTitle, { color: theme.colors.text }]}>
              {item.title}
            </Text>
          ) : null}
          <Text style={[styles.textBody, { color: theme.colors.text }]}>
            {item.text || ''}
          </Text>
        </Pressable>
      ) : null}

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

      {item.kind !== 'text' && item.text ? (
        <Text
          style={[
            styles.caption,
            { bottom: bottomPad + (composerOpen ? 108 : listOpen ? 160 : 52) },
          ]}
          numberOfLines={3}
        >
          {item.text}
        </Text>
      ) : null}

      {/*
        رصيف ثابت على الحافة اليمنى فيزيائياً.
        حاوية direction:'ltr' حتى لا يعكس I18nManager/RTL موضع flex-end.
      */}
      <View
        pointerEvents="box-none"
        style={[
          styles.actionsDock,
          dockSide,
          {
            bottom: bottomPad + (composerOpen ? 64 : 36),
            direction: 'ltr',
          },
        ]}
      >
        <LikeButton
          count={item.likes.length}
          liked={item.liked}
          onPress={handleLikePress}
          tone="light"
          size="md"
        />
      </View>

      {listOpen ? (
        <View
          pointerEvents="box-none"
          style={[styles.commentsPanel, { bottom: bottomPad + 36 }]}
        >
          <ScrollView
            style={styles.commentsScroll}
            contentContainerStyle={styles.commentsScrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {comments.length === 0 ? (
              <Text style={[styles.commentEmpty, cairoText('medium')]}>
                {t('ui.noItemComments')}
              </Text>
            ) : (
              comments.map((c) => (
                <Text
                  key={c.id}
                  style={[styles.commentLine, cairoText('regular')]}
                  numberOfLines={4}
                >
                  <Text style={[styles.commentAuthor, cairoText('semiBold')]}>
                    {c.authorName}{' '}
                  </Text>
                  {c.text}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      {composerOpen ? (
        <View
          style={[
            styles.composerBar,
            {
              bottom: bottomPad + 28,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('ui.optionalCommentPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={[
              styles.composerInput,
              cairoText('regular'),
              { textAlign: isRTL ? 'right' : 'left' },
            ]}
            multiline
            maxLength={400}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={submitComment}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.send')}
            onPress={submitComment}
            style={({ pressed }) => [
              styles.composerSend,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.comments')}
        onPress={() => {
          setComposerOpen(false);
          Keyboard.dismiss();
          setListOpen((v) => !v);
        }}
        style={[styles.commentsLink, { bottom: bottomPad }]}
        hitSlop={8}
      >
        <Text style={[styles.commentsLinkText, cairoText('medium')]}>
          {t('ui.comments')}
          {comments.length > 0 ? ` · ${comments.length}` : ''}
        </Text>
      </Pressable>
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
    if (!active?.authorId) return;
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
    if (next > 0) setHeight(next);
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
      />
    ),
    [activeId, appActive, focused, height, onLike, onComment, onDoubleTap]
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
      style={[styles.root, { backgroundColor: theme.colors.background }]}
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
          maxToRenderPerBatch={3}
          windowSize={5}
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
  root: { flex: 1 },
  slide: {
    width: '100%',
    overflow: 'hidden',
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
    paddingHorizontal: 28,
    paddingVertical: 80,
    justifyContent: 'center',
    gap: 14,
  },
  textTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  textBody: {
    fontSize: 18,
    lineHeight: 30,
    fontWeight: '600',
  },
  /**
   * رصيف الإجراءات على يمين الشاشة فيزيائياً.
   * direction:'ltr' + right يمنع انعكاس RTL لـ flex/I18nManager.
   */
  actionsDock: {
    position: 'absolute',
    zIndex: 6,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Platform.OS === 'android' ? 10 : 12,
    maxWidth: '78%',
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
  caption: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 5,
    color: '#fff',
    fontSize: Platform.OS === 'android' ? 13 : 14,
    lineHeight: Platform.OS === 'android' ? 18 : 20,
    fontWeight: '600',
    textAlign: 'right',
  },
  commentsLink: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 7,
    alignItems: 'center',
    paddingVertical: 4,
  },
  commentsLinkText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  commentsPanel: {
    position: 'absolute',
    left: 16,
    right: 72,
    zIndex: 7,
    maxHeight: 140,
  },
  commentsScroll: {
    maxHeight: 140,
  },
  commentsScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  commentLine: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 17,
  },
  commentAuthor: {
    color: '#fff',
    fontSize: 12,
  },
  commentEmpty: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
  composerBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 8,
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 72,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  composerSend: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  empty: {
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
