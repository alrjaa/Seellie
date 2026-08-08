export type ThemeMode = 'light' | 'dark';

/**
 * هوية Seellie البصرية:
 * خلفية #0d1a26 · أساسي أبيض · ثانوي سماوي · نصوص أبيض
 */
export const brandPalette = {
  background: '#0d1a26',
  primary: '#FFFFFF',
  accent: '#25F4EE',
  text: '#FFFFFF',
} as const;

export type AppColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  border: string;
  primary: string;
  primaryMuted: string;
  primarySoft: string;
  /** اللون الثانوي — سماوي */
  accent: string;
  accentMuted: string;
  accentSoft: string;
  text: string;
  textMuted: string;
  textInverse: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
  overlay: string;
  white: string;
  black: string;
  inputBg: string;
  tabBar: string;
  skeleton: string;
};

/** الوضع الداكن = الهوية الافتراضية */
export const darkColors: AppColors = {
  background: brandPalette.background,
  surface: '#132433',
  surfaceElevated: '#1A3042',
  card: 'rgba(19, 36, 51, 0.96)',
  border: 'rgba(255,255,255,0.12)',
  primary: brandPalette.primary,
  primaryMuted: '#D4D4D4',
  primarySoft: 'rgba(255, 255, 255, 0.14)',
  accent: brandPalette.accent,
  accentMuted: '#12D4CE',
  accentSoft: 'rgba(37, 244, 238, 0.14)',
  text: brandPalette.text,
  textMuted: 'rgba(255,255,255,0.72)',
  /** نص على زر أبيض */
  textInverse: '#0d1a26',
  danger: '#FF4D6A',
  dangerSoft: 'rgba(255, 77, 106, 0.16)',
  success: brandPalette.accent,
  warning: '#FFC107',
  overlay: 'rgba(13, 26, 38, 0.72)',
  white: '#FFFFFF',
  black: '#000000',
  inputBg: '#0A1520',
  tabBar: '#0A1420',
  skeleton: 'rgba(255,255,255,0.08)',
};

/**
 * الوضع الفاتح: الأساسي يصبح أسود للتباين على خلفية فاتحة،
 * مع الإبقاء على السماوي كلون ثانوي.
 */
export const lightColors: AppColors = {
  background: '#F3F6F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  border: 'rgba(13, 26, 38, 0.12)',
  primary: '#0d1a26',
  primaryMuted: '#0A1420',
  primarySoft: 'rgba(13, 26, 38, 0.1)',
  accent: '#0DBDB8',
  accentMuted: '#0AA9A4',
  accentSoft: 'rgba(37, 244, 238, 0.16)',
  text: '#0d1a26',
  textMuted: '#5A6B7A',
  textInverse: '#FFFFFF',
  danger: '#E11D48',
  dangerSoft: 'rgba(225, 29, 72, 0.12)',
  success: '#0DBDB8',
  warning: '#D97706',
  overlay: 'rgba(13, 26, 38, 0.45)',
  white: '#FFFFFF',
  black: '#000000',
  inputBg: '#E8EEF3',
  tabBar: '#FFFFFF',
  skeleton: 'rgba(13, 26, 38, 0.06)',
};
