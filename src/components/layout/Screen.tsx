import React, { memo, useContext, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from 'react-native-safe-area-context';
import { HeaderHeightContext } from '@react-navigation/elements';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useResponsive } from '@/hooks/useResponsive';
import { useFloatingChrome } from '@/providers/FloatingChromeProvider';
import { screenContentBottomPadding } from '@/theme/navigation';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  centered?: boolean;
  /** Edge-to-edge content (no gutters / max width). Ideal for full-screen mobile feeds. */
  bleed?: boolean;
  /** Defaults to left/right only (good under stack/tab headers). */
  edges?: Edge[];
  /** لف المحتوى بـ KeyboardAvoidingView (نماذج) */
  keyboard?: boolean;
  /**
   * خلوص سفلي للأزرار العائمة.
   * الافتراضي: مفعّل إلا في وضع bleed.
   */
  fabClearance?: boolean;
  /**
   * الشاشة داخل تبويبات؟ يؤثر على حساب المساحة السفلية.
   * الافتراضي true.
   */
  hasTabBar?: boolean;
};

function ScreenComponent({
  children,
  scroll,
  style,
  contentStyle,
  centered,
  bleed,
  edges = ['left', 'right'],
  keyboard = false,
  fabClearance,
  hasTabBar = true,
}: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { contentWidth, gutter } = useResponsive();
  const {
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
  } = useFloatingChrome();
  const headerHeight = useContext(HeaderHeightContext) ?? 0;

  const clearFab = fabClearance ?? !bleed;
  const bottomPad = bleed
    ? 0
    : screenContentBottomPadding({
        bottomInset: insets.bottom,
        hasTabBar,
        fabClearance: clearFab,
      });

  const body = (
    <View
      style={[
        scroll ? styles.innerScroll : styles.innerFill,
        bleed
          ? { width: '100%', flex: 1 }
          : {
              width: '100%',
              maxWidth: contentWidth + gutter * 2,
              alignSelf: 'center',
              paddingHorizontal: gutter,
              paddingTop: headerHeight > 0 ? headerHeight : undefined,
            },
        !scroll && !bleed ? { paddingBottom: Math.min(bottomPad, 32) } : null,
        centered && styles.centered,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  const scrollView = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      style={styles.scroll}
      onScroll={onScroll}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      scrollEventThrottle={16}
    >
      {body}
    </ScrollView>
  ) : (
    body
  );

  const main = keyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(headerHeight, 0) : 0}
    >
      {scrollView}
    </KeyboardAvoidingView>
  ) : (
    scrollView
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.safe,
        {
          backgroundColor: bleed ? 'transparent' : theme.colors.background,
        },
        style,
      ]}
    >
      {main}
    </SafeAreaView>
  );
}

export const Screen = memo(ScreenComponent);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  innerFill: { flex: 1 },
  innerScroll: { flexGrow: 1 },
  centered: { justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
