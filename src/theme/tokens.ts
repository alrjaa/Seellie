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

export function contentMaxWidth(width: number) {
  if (width >= 1024) return 760;
  if (width >= 768) return 600;
  // هواتف كبيرة (Plus / Pro Max) تستفيد من عرض أوسع دون الوصول لحواف الشاشة
  return Math.min(width - 32, Math.max(360, Math.min(width * 0.96, 480)));
}

export function formMaxWidth(width: number) {
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
  sm: moderateScale(13),
  md: moderateScale(15),
  lg: moderateScale(17),
  xl: moderateScale(22),
  xxl: moderateScale(28),
  display: moderateScale(34),
} as const;
