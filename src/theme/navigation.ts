import { Platform, StatusBar } from 'react-native';
import type { AppTheme } from '@/theme';
import { cairoHeaderTitleStyle } from '@/theme/fonts';

/** مسافة إضافية واضحة تحت أيقونات الشبكة/البطارية/الساعة */
export const HEADER_BELOW_STATUS_GAP = 20;

/**
 * إزاحة أعلى الشاشة تحت منطقة الحالة بالكامل (iPhone + Android).
 */
export function headerSafeTop(topInset: number) {
  const androidStatus = StatusBar.currentHeight ?? 0;
  const base =
    Platform.OS === 'android'
      ? Math.max(topInset, androidStatus, 32)
      : Math.max(topInset, 54);
  return base + HEADER_BELOW_STATUS_GAP;
}

/** رأس تنقل — خلفية صلبة + مساحة حالة موثوقة حتى لا تختفي الأزرار خلف الساعة/البطارية */
export function transparentHeaderOptions(
  theme: AppTheme,
  topInset = 0
) {
  const top = headerSafeTop(topInset);
  return {
    // خلفية غير شفافة أضمن مع edge-to-edge على Android/iOS
    headerTransparent: false,
    headerStyle: {
      backgroundColor: theme.colors.background,
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
    },
    headerShadowVisible: false,
    headerTintColor: theme.colors.text,
    headerTitleAlign: 'center' as const,
    headerTitleStyle: {
      ...cairoHeaderTitleStyle,
      color: theme.colors.text,
      textAlign: 'left' as const,
    },
    headerStatusBarHeight: top,
    headerTopInsetEnabled: true,
    ...(Platform.OS === 'android'
      ? {
          statusBarTranslucent: true,
          statusBarColor: 'transparent',
        }
      : {}),
  };
}

const TAB_CONTENT_HEIGHT = 56;
const TAB_TOP_PAD = 6;

/** عرض عمود الأزرار العائمة (هامش يسار للمحتوى إن لزم) */
export const FAB_COLUMN_WIDTH = 72;

/** مساحة سفلية قياسية فوق شريط التبويب/المؤشر لتجنّب قصّ البطاقات والأزرار */
export const SCREEN_SCROLL_EXTRA = 24;

/** شريط تبويب بنفس ارتفاع المحتوى على iOS وAndroid مع احترام المساحة الآمنة السفلية */
export function tabBarChromeStyle(
  theme: AppTheme,
  bottomInset: number
) {
  const paddingBottom = Math.max(bottomInset, 8);
  return {
    backgroundColor: theme.colors.tabBar,
    borderTopColor: theme.colors.border,
    height: TAB_CONTENT_HEIGHT + TAB_TOP_PAD + paddingBottom,
    paddingBottom,
    paddingTop: TAB_TOP_PAD,
  };
}

export function tabBarTotalHeight(bottomInset: number) {
  const paddingBottom = Math.max(bottomInset, 8);
  return TAB_CONTENT_HEIGHT + TAB_TOP_PAD + paddingBottom;
}

/** إزاحة الزر العائم فوق شريط التبويب */
export function floatingAboveTabOffset(bottomInset: number) {
  return tabBarTotalHeight(bottomInset) + 8;
}

/**
 * paddingBottom موحّد لمحتوى Screen / FlatList.
 * - داخل تبويب: المشهد أصلاً فوق الشريط → خلوص عمود FAB فقط
 * - خارج تبويب (stack): نطابق إزاحة الزر العائم + inset
 */
export function screenContentBottomPadding(options?: {
  bottomInset?: number;
  /** هل الشاشة داخل تبويبات؟ الافتراضي true */
  hasTabBar?: boolean;
  /** خلوص للأزرار العائمة — الافتراضي true */
  fabClearance?: boolean;
}) {
  const bottomInset = options?.bottomInset ?? 0;
  const hasTabBar = options?.hasTabBar !== false;
  const fabClearance = options?.fabClearance !== false;

  if (!fabClearance) {
    return (hasTabBar ? 0 : Math.max(bottomInset, 8)) + SCREEN_SCROLL_EXTRA;
  }

  if (hasTabBar) {
    return 96 + SCREEN_SCROLL_EXTRA;
  }

  return floatingAboveTabOffset(bottomInset) + SCREEN_SCROLL_EXTRA;
}
