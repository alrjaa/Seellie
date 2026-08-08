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
import { useLanguage } from '@/providers/LanguageProvider';
import { useResponsive } from '@/hooks/useResponsive';
import { useFloatingChromeScroll } from '@/providers/FloatingChromeProvider';
import { screenContentBottomPadding } from '@/theme/navigation';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  centered?: boolean;
  /** Edge-to-edge content (no gutters / max width). Ideal for full-screen mobile feeds. */
  bleed?: boolean;
  /**
   * كثافة العرض على سطح المكتب فقط:
   * default = content · feed = قراءة · wide/dashboard = لوحات
   */
  density?: 'default' | 'feed' | 'wide' | 'dashboard' | 'form';
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
  density = 'default',
  edges = ['left', 'right'],
  keyboard = false,
  fabClearance,
  hasTabBar = true,
}: Props) {
  const theme = useAppTheme();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const { contentWidth, feedWidth, dashboardWidth, formWidth, gutter, desktop } =
    useResponsive();
  const {
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
  } = useFloatingChromeScroll();
  // headerHeight يُستخدم فقط لتعويض لوحة المفاتيح، لا لإزاحة المحتوى
  const headerHeight = useContext(HeaderHeightContext) ?? 0;

  const clearFab = fabClearance ?? !bleed;
  const bottomPad = bleed
    ? 0
    : screenContentBottomPadding({
        bottomInset: desktop ? 16 : insets.bottom,
        hasTabBar: desktop ? false : hasTabBar,
        fabClearance: desktop ? false : clearFab,
      });

  const maxWidth = desktop
    ? density === 'dashboard' || density === 'wide'
      ? dashboardWidth
      : density === 'feed'
        ? feedWidth
        : density === 'form'
          ? formWidth
          : contentWidth
    : contentWidth;

  const body = (
    <View
      style={[
        scroll ? styles.innerScroll : styles.innerFill,
        {
          direction: isRTL ? 'rtl' : 'ltr',
          width: '100%',
        },
        bleed
          ? { flex: 1 }
          : {
              maxWidth: maxWidth + gutter * 2,
              alignSelf: 'center',
              paddingHorizontal: gutter,
              paddingTop: desktop ? 8 : 0,
            },
        !scroll && !bleed ? { paddingBottom: bottomPad } : null,
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
      onMomentumScrollBegin={onMomentumScrollBegin}
      onMomentumScrollEnd={onMomentumScrollEnd}
      scrollEventThrottle={48}
      removeClippedSubviews={false}
      decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.985}
      overScrollMode="never"
      bounces
      alwaysBounceVertical={false}
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
