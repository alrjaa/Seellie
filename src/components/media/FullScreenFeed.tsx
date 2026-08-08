import React, {
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
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
import { EmptyState } from '@/components/feedback/EmptyState';
import { LikeButton } from '@/components/ui';
import { useFloatingVisibility } from '@/hooks/useFloatingVisibility';
import {
  claimFloatingScrollSource,
  forceFloatingVisible,
  noteFloatingScrollOffset,
  noteFloatingScrollSettle,
  releaseFloatingScrollSource,
} from '@/services/floating-scroll-bus';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';

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
};

type Props = {
  data: FullScreenContent[];
  onLike: (item: FullScreenContent) => void;
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

const Slide = memo(function Slide({
  item,
  height,
  active,
  onLike,
  onPressAuthor,
  onDoubleTap,
}: {
  item: FullScreenContent;
  height: number;
  active: boolean;
  onLike: () => void;
  onPressAuthor?: () => void;
  onDoubleTap?: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [paused, setPaused] = useState(false);
  const lastTapRef = useRef(0);
  const handleLabel =
    item.authorHandle?.trim() ||
    (item.authorName.startsWith('@')
      ? item.authorName
      : item.authorName
        ? `@${item.authorName.replace(/\s+/g, '').slice(0, 16)}`
        : undefined);
  const bottomPad = Math.max(insets.bottom, 6) + 4;
  // right/left تنعكس مع RTL+swap — نحسب الحافة اليمنى فيزيائياً
  const dockSide =
    I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL
      ? ({ left: 14 } as const)
      : ({ right: 14 } as const);

  const handleContentPress = useCallback(() => {
    const now = Date.now();
    if (onDoubleTap && now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      onDoubleTap();
      return;
    }
    lastTapRef.current = now;
    if (item.kind === 'video') {
      setPaused((v) => !v);
    }
  }, [item.kind, onDoubleTap]);

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

      {item.kind === 'video' && item.mediaUrl ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            paused ? t('media.playVideo') : t('media.pauseVideo')
          }
          onPress={handleContentPress}
          style={styles.videoFill}
        >
          {item.posterUrl && (!active || paused) ? (
            <Image
              source={{ uri: item.posterUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : null}
          <Video
            source={{ uri: item.mediaUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={active && !paused}
            isLooping
            isMuted={false}
            usePoster={!!item.posterUrl}
            posterSource={
              item.posterUrl ? { uri: item.posterUrl } : undefined
            }
          />
          {paused || !active ? (
            <View style={styles.playWrap}>
              <Ionicons name="play-circle" size={72} color="#fff" />
              <Text style={styles.playLabel}>
                {t('media.analysisVideoTapPlay')}
              </Text>
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
          style={[styles.caption, { bottom: bottomPad + 44 }]}
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
            bottom: bottomPad,
            direction: 'ltr',
          },
        ]}
      >
        <LikeButton
          count={item.likes.length}
          liked={item.liked}
          onPress={onLike}
          tone="light"
          size="sm"
        />
        <Pressable
          style={styles.handlePress}
          onPress={onPressAuthor}
          disabled={!onPressAuthor}
          accessibilityRole="button"
          accessibilityLabel={handleLabel || t('ui.profileA11y')}
        >
          {handleLabel ? (
            <Text
              style={styles.handleOnly}
              numberOfLines={1}
              {...({ ltr: true } as object)}
            >
              {handleLabel}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
});

/**
 * Mobile immersive feed: one content item fills the viewport; snap scroll vertically.
 */
function FullScreenFeedComponent({
  data,
  onLike,
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
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const overlayTranslate = useRef(new Animated.Value(0)).current;
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
  }).current;

  useEffect(() => {
    if (!focused) {
      releaseFloatingScrollSource(sourceId);
      return;
    }
    claimFloatingScrollSource(sourceId);
    return () => releaseFloatingScrollSource(sourceId);
  }, [focused, sourceId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && focused) forceFloatingVisible();
    });
    return () => sub.remove();
  }, [focused]);

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
    if (visible) {
      overlayOpacity.setValue(1);
      overlayTranslate.setValue(0);
    }
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 180 : 120,
        useNativeDriver: true,
      }),
      Animated.timing(overlayTranslate, {
        toValue: visible ? 0 : -12,
        duration: visible ? 180 : 120,
        useNativeDriver: true,
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
        setActiveId((first.item as FullScreenContent).id);
      }
    }
  ).current;

  const renderItem = useCallback<ListRenderItem<FullScreenContent>>(
    ({ item }) => (
      <Slide
        item={item}
        height={height}
        active={item.id === activeId}
        onLike={() => onLike(item)}
        onPressAuthor={
          onPressAuthor ? () => onPressAuthor(item) : undefined
        }
        onDoubleTap={onDoubleTap ? () => onDoubleTap(item) : undefined}
      />
    ),
    [activeId, height, onLike, onPressAuthor, onDoubleTap]
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
