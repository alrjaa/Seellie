import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Base design width (iPhone 14) */
const BASE_WIDTH = 390;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Scale size relative to screen width */
export function scale(size: number) {
  const scaled = (SCREEN_WIDTH / BASE_WIDTH) * size;
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/** Moderate scale — less aggressive on tablets */
export function moderateScale(size: number, factor = 0.35) {
  return size + (scale(size) - size) * factor;
}

export function isTablet(width = SCREEN_WIDTH) {
  return width >= 768;
}

/** سطح مكتب الويب فقط — هواتف/لمس تبقى بواجهة الجوال حتى لو اتسع العرض */
export function isDesktopWeb(width = SCREEN_WIDTH) {
  if (Platform.OS !== 'web') return false;
  if (typeof window !== 'undefined') {
    try {
      // جوال/تابلت بلمس: لا نُخفي الأزرار العائمة بسبب «طلب موقع سطح المكتب»
      const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
      const fineOnly = window.matchMedia?.('(pointer: fine)')?.matches;
      if (coarse && !fineOnly && width < 1280) return false;
      if (
        /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator?.userAgent || '') &&
        width < 1280
      ) {
        return false;
      }
    } catch {
      // ignore
    }
  }
  return width >= 1024;
}

export function contentMaxWidth(width: number) {
  if (isDesktopWeb(width)) return 980;
  if (width >= 1024) return 760;
  if (width >= 768) return 600;
  // هواتف كبيرة (Plus / Pro Max) تستفيد من عرض أوسع دون الوصول لحواف الشاشة
  return Math.min(width - 32, Math.max(360, Math.min(width * 0.96, 480)));
}

/** لوحات الإدارة والداشبورد على سطح المكتب */
export function dashboardMaxWidth(width: number) {
  if (isDesktopWeb(width)) return 1280;
  return contentMaxWidth(width);
}

/** خلاصات القراءة على سطح المكتب */
export function feedMaxWidth(width: number) {
  if (isDesktopWeb(width)) return 840;
  return contentMaxWidth(width);
}

export function formMaxWidth(width: number) {
  if (isDesktopWeb(width)) return 420;
  return Math.min(width - 40, isTablet(width) ? 400 : 340);
}

export const layout = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  isWeb: Platform.OS === 'web',
};

export const spacing = {
  xxs: moderateScale(2),
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(16),
  lg: moderateScale(24),
  xl: moderateScale(32),
  xxl: moderateScale(48),
} as const;

export const radius = {
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(24),
  full: 999,
} as const;

export const fontSize = {
  xs: moderateScale(11),
  sm: moderateScale(12),
  md: moderateScale(14),
  lg: moderateScale(16),
  xl: moderateScale(20),
  xxl: moderateScale(26),
  display: moderateScale(30),
} as const;
