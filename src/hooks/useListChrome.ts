import { useMemo } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFloatingChromeScroll } from '@/providers/FloatingChromeProvider';
import { screenContentBottomPadding } from '@/theme/navigation';

type Options = {
  hasTabBar?: boolean;
  fabClearance?: boolean;
  /** دمج مع style قائمة موجود */
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * خصائص موحّدة لـ FlatList / SectionList:
 * تمرير أكثر مرونة بدون تردد، مع إخفاء FAB عند السحب فقط.
 */
export function useListChrome(options: Options = {}) {
  const insets = useSafeAreaInsets();
  const {
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
  } = useFloatingChromeScroll();

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
      // أقل ضغطاً على JS أثناء السحب
      scrollEventThrottle: 48 as const,
      // إزالة القصّ العدواني الذي يسبب وميضاً/تردد على أندرويد
      removeClippedSubviews: false,
      maxToRenderPerBatch: 8,
      updateCellsBatchingPeriod: 40,
      windowSize: 9,
      initialNumToRender: 8,
      // تمرير أنعم
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
