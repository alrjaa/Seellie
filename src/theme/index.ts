import { darkColors, lightColors, type AppColors, type ThemeMode } from './colors';
import { fontFamily } from './fonts';
import { fontSize, radius, spacing } from './tokens';

export type AppTheme = {
  mode: ThemeMode;
  colors: AppColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontFamily: typeof fontFamily;
  isDark: boolean;
};

export function createTheme(mode: ThemeMode): AppTheme {
  return {
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    fontSize,
    fontFamily,
    isDark: mode === 'dark',
  };
}

export * from './colors';
export * from './tokens';
export * from './fonts';
