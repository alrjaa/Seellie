import React, { useMemo, type ReactNode } from 'react';
import {
  ThemeProvider as NavigationThemeProvider,
  DarkTheme,
  DefaultTheme,
  type Theme,
} from '@react-navigation/native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { fontFamily } from '@/theme/fonts';

const cairoFonts: Theme['fonts'] = {
  regular: {
    fontFamily: fontFamily.regular,
    fontWeight: 'normal',
  },
  medium: {
    fontFamily: fontFamily.medium,
    fontWeight: 'normal',
  },
  bold: {
    fontFamily: fontFamily.bold,
    fontWeight: 'normal',
  },
  heavy: {
    fontFamily: fontFamily.extraBold,
    fontWeight: 'normal',
  },
};

/** Applies Cairo to React Navigation headers, tabs, and labels. */
export function NavigationCairoProvider({ children }: { children: ReactNode }) {
  const theme = useAppTheme();

  const navigationTheme = useMemo<Theme>(() => {
    const base = theme.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: theme.isDark,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
      fonts: cairoFonts,
    };
  }, [theme]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      {children}
    </NavigationThemeProvider>
  );
}
