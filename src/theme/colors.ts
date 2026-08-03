export type ThemeMode = 'light' | 'dark';

export type AppColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  border: string;
  primary: string;
  primaryMuted: string;
  primarySoft: string;
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

export const darkColors: AppColors = {
  background: '#0B1F17',
  surface: '#122A20',
  surfaceElevated: '#1A372A',
  card: 'rgba(26, 55, 42, 0.94)',
  border: 'rgba(255,255,255,0.09)',
  primary: '#2ECC71',
  primaryMuted: '#1E8F4E',
  primarySoft: 'rgba(46, 204, 113, 0.14)',
  text: '#F4F7F5',
  textMuted: '#9BB0A5',
  textInverse: '#0B1F17',
  danger: '#E74C3C',
  dangerSoft: 'rgba(231, 76, 60, 0.15)',
  success: '#2ECC71',
  warning: '#F39C12',
  overlay: 'rgba(0,0,0,0.55)',
  white: '#FFFFFF',
  black: '#000000',
  inputBg: '#0E241A',
  tabBar: '#122A20',
  skeleton: 'rgba(255,255,255,0.08)',
};

export const lightColors: AppColors = {
  background: '#F3F7F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  border: 'rgba(11, 31, 23, 0.1)',
  primary: '#1E9E55',
  primaryMuted: '#167A41',
  primarySoft: 'rgba(30, 158, 85, 0.12)',
  text: '#0F1F18',
  textMuted: '#5B7167',
  textInverse: '#FFFFFF',
  danger: '#D64539',
  dangerSoft: 'rgba(214, 69, 57, 0.12)',
  success: '#1E9E55',
  warning: '#D68910',
  overlay: 'rgba(0,0,0,0.4)',
  white: '#FFFFFF',
  black: '#000000',
  inputBg: '#EEF4F1',
  tabBar: '#FFFFFF',
  skeleton: 'rgba(11, 31, 23, 0.06)',
};
