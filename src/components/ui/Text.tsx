import React, { memo, type ReactNode } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

type Props = TextProps & {
  children: ReactNode;
  tone?: 'default' | 'muted' | 'primary' | 'danger';
  /**
   * - 'start' = بداية السطر (يتبع اتجاه الحاوية)
   * - 'end' / 'right' = نهاية السطر
   */
  align?: 'auto' | 'start' | 'end' | 'left' | 'right' | 'center';
};

function resolveAlign(
  align: NonNullable<Props['align']>,
  isRTL: boolean
): 'left' | 'right' | 'center' {
  if (align === 'center') return 'center';
  if (align === 'left') return 'left';
  if (align === 'right') return 'right';
  // start / auto / end تتبع اتجاه اللغة
  if (align === 'end') return isRTL ? 'left' : 'right';
  return isRTL ? 'right' : 'left';
}

function AppTextComponent({
  children,
  tone = 'default',
  align = 'start',
  style,
  ...rest
}: Props) {
  const theme = useAppTheme();
  const { isRTL } = useLanguage();
  const color =
    tone === 'muted'
      ? theme.colors.textMuted
      : tone === 'primary'
        ? theme.colors.primary
        : tone === 'danger'
          ? theme.colors.danger
          : theme.colors.text;

  return (
    <Text
      {...rest}
      style={[
        styles.base,
        cairoText('regular'),
        {
          color,
          textAlign: resolveAlign(align, isRTL),
          writingDirection: isRTL ? 'rtl' : 'ltr',
          fontSize: theme.fontSize.sm + 1,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export const AppText = memo(AppTextComponent);

export const Title = memo(function Title(props: Omit<Props, 'tone'>) {
  const theme = useAppTheme();
  return (
    <AppText
      {...props}
      style={[
        { fontSize: theme.fontSize.xl },
        cairoText('extraBold'),
        props.style,
      ]}
    />
  );
});

export const Subtitle = memo(function Subtitle(props: Omit<Props, 'tone'>) {
  const theme = useAppTheme();
  return (
    <AppText
      {...props}
      style={[
        { fontSize: theme.fontSize.md },
        cairoText('bold'),
        props.style,
      ]}
    />
  );
});

export const Muted = memo(function Muted(props: Omit<Props, 'tone'>) {
  const theme = useAppTheme();
  return (
    <AppText
      {...props}
      tone="muted"
      style={[
        { fontSize: theme.fontSize.sm },
        cairoText('regular'),
        props.style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  base: {},
});
