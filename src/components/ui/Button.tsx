import React, { memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { cairoText } from '@/theme/fonts';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** الافتراضي sm ليناسب شاشات الجوال */
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
};

const SIZE_STYLES: Record<
  Size,
  {
    minHeight: number;
    paddingVertical: number;
    paddingHorizontal: number;
    fontSize: number;
    radius: number;
  }
> = {
  sm: {
    minHeight: 36,
    paddingVertical: 7,
    paddingHorizontal: 14,
    fontSize: 13,
    radius: 10,
  },
  md: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 18,
    fontSize: 14,
    radius: 12,
  },
  lg: {
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 22,
    fontSize: 16,
    radius: 14,
  },
};

function ButtonComponent({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
  accessibilityHint,
}: Props) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;
  const sizeStyle = SIZE_STYLES[size];

  const backgroundColor =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'secondary'
        ? theme.colors.accentSoft
        : variant === 'danger'
          ? theme.colors.danger
          : 'transparent';

  const textColor =
    variant === 'ghost'
      ? theme.colors.accent
      : variant === 'outline'
        ? theme.colors.primary
        : variant === 'secondary'
          ? theme.colors.accent
          : variant === 'danger'
            ? theme.colors.white
            : theme.colors.textInverse;

  const borderColor =
    variant === 'outline'
      ? theme.colors.primary
      : variant === 'ghost'
        ? theme.colors.border
        : variant === 'secondary'
          ? theme.colors.accent
          : variant === 'primary'
            ? theme.isDark
              ? 'rgba(255,255,255,0.2)'
              : theme.colors.border
            : 'transparent';

  const showBorder =
    variant === 'outline' ||
    variant === 'ghost' ||
    variant === 'secondary' ||
    (variant === 'primary' && theme.isDark);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderWidth: showBorder ? 1 : 0,
          borderRadius: sizeStyle.radius,
          minHeight: sizeStyle.minHeight,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          opacity: isDisabled ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            cairoText('bold'),
            { color: textColor, fontSize: sizeStyle.fontSize, lineHeight: sizeStyle.fontSize + 4 },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export const Button = memo(ButtonComponent);

const styles = StyleSheet.create({
  base: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
