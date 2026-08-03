import { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFloatingChrome } from '@/providers/FloatingChromeProvider';
import { screenContentBottomPadding } from '@/theme/navigation';

type Options = {
  hasTabBar?: boolean;
  fabClearance?: boolean;
  /** دمج مع style قائمة موجود */
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * خصائص موحّدة لـ FlatList / SectionList:
 * - إخفاء الأزرار العائمة أثناء التمرير
 * - paddingBottom يمنع قصّ آخر عنصر خلف FAB / الشريط
 */
export function useListChrome(options: Options = {}) {
  const insets = useSafeAreaInsets();
  const {
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
  } = useFloatingChrome();

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
      onMomentumScrollEnd,
      scrollEventThrottle: 16 as const,
      contentContainerStyle: [
        { flexGrow: 1, paddingBottom },
        options.contentContainerStyle,
      ] as StyleProp<ViewStyle>,
    }),
    [
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollEnd,
      paddingBottom,
      options.contentContainerStyle,
    ]
  );
}
