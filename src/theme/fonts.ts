import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
} from '@expo-google-fonts/cairo';
import type { TextStyle } from 'react-native';

/** Loaded face names — use as `fontFamily` (not CSS weight alone on Android). */
export const fontFamily = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semiBold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extraBold: 'Cairo_800ExtraBold',
  black: 'Cairo_900Black',
} as const;

export type FontWeightKey = keyof typeof fontFamily;

export const cairoFontMap = {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
};

/** Shared navigation chrome styles */
export const cairoHeaderTitleStyle = {
  fontFamily: fontFamily.bold,
  fontWeight: 'normal' as const,
  fontSize: 14,
};

export const cairoTabLabelStyle = {
  fontSize: 11,
  fontFamily: fontFamily.bold,
  fontWeight: 'normal' as const,
  textAlign: 'center' as const,
};

/** Map numeric/string weights to a Cairo face for Android-safe bold. */
export function cairoForWeight(
  weight?: TextStyle['fontWeight']
): string {
  const w = String(weight ?? '400');
  if (w === '900' || w === 'black') return fontFamily.black;
  if (w === '800' || w === 'heavy') return fontFamily.extraBold;
  if (w === '700' || w === 'bold') return fontFamily.bold;
  if (w === '600' || w === 'semibold') return fontFamily.semiBold;
  if (w === '500' || w === 'medium') return fontFamily.medium;
  return fontFamily.regular;
}

/** Style helpers: pick the face and neutralize synthetic weight. */
export function cairoText(weight: FontWeightKey = 'regular'): TextStyle {
  return {
    fontFamily: fontFamily[weight],
    fontWeight: 'normal',
  };
}

/**
 * Kept for call sites in root layout. Actual global application is done by
 * `src/shims/react-native.js` via Metro (RN 0.81 has no Text.render to patch).
 */
export function applyGlobalCairoFonts() {
  // no-op — shim handles Text / TextInput
}
