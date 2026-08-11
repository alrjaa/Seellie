import { useCallback, useEffect, useId, useMemo } from 'react';
import { AppState, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  claimFloatingScrollSource,
  forceFloatingVisible,
  noteFloatingScrollOffset,
  noteFloatingScrollSettle,
  releaseFloatingScrollSource,
} from '@/services/floating-scroll-bus';
import { screenContentBottomPadding } from '@/theme/navigation';

type Options = {
  hasTabBar?: boolean;
  fabClearance?: boolean;
  /** false = لا تدّعِ مصدر التمرير (مثلاً جوال يستخدم FullScreenFeed) */
  enabled?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * خصائص FlatList: مصدر تمرير فريد + أحداث فقط عند التركيز.
 */
export function useListChrome(options: Options = {}) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const reactId = useId();
  const sourceId = `list:${reactId}`;
  const enabled = options.enabled !== false;

  useEffect(() => {
    if (!enabled) {
      releaseFloatingScrollSource(sourceId);
      return;
    }
    if (!focused) {
      releaseFloatingScrollSource(sourceId);
      return;
    }
    claimFloatingScrollSource(sourceId);
    return () => releaseFloatingScrollSource(sourceId);
  }, [enabled, focused, sourceId]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && focused) forceFloatingVisible();
    });
    return () => sub.remove();
  }, [enabled, focused]);

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (!enabled || !focused) return;
      noteFloatingScrollOffset(sourceId, e.nativeEvent.contentOffset.y);
    },
    [enabled, focused, sourceId]
  );

  const onScrollBeginDrag = useCallback(() => {
    // الاتجاه يُحسب من onScroll
  }, []);

  const onScrollEndDrag = useCallback(() => {
    if (!enabled || !focused) return;
    noteFloatingScrollSettle(sourceId);
  }, [enabled, focused, sourceId]);

  const onMomentumScrollBegin = useCallback(() => {
    // لا إخفاء عند بداية الزخم
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    if (!enabled || !focused) return;
    noteFloatingScrollSettle(sourceId);
  }, [enabled, focused, sourceId]);

  const paddingBottom = screenContentBottomPadding({
    bottomInset: insets.bottom,
    hasTabBar: options.hasTabBar !== false,
    fabClearance: options.fabClearance !== false,
  });

  return useMemo(
    () => ({
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      scrollEventThrottle: 16 as const,
      removeClippedSubviews: false,
      maxToRenderPerBatch: 8,
      updateCellsBatchingPeriod: 40,
      windowSize: 9,
      initialNumToRender: 8,
      decelerationRate: (Platform.OS === 'ios' ? 'normal' : 0.985) as
        | 'normal'
        | number,
      overScrollMode: 'never' as const,
      bounces: true,
      alwaysBounceVertical: false,
      contentContainerStyle: [
        { flexGrow: 1, paddingBottom },
        options.contentContainerStyle,
      ] as StyleProp<ViewStyle>,
    }),
    [
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      paddingBottom,
      options.contentContainerStyle,
    ]
  );
}
