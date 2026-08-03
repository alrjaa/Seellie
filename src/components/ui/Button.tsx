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

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
};

function ButtonComponent({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  accessibilityHint,
}: Props) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'secondary'
        ? theme.colors.white
        : variant === 'danger'
          ? theme.colors.danger
          : variant === 'outline'
            ? 'transparent'
            : 'transparent';

  const textColor =
    variant === 'ghost' || variant === 'outline'
      ? theme.colors.primary
      : variant === 'secondary'
        ? theme.colors.background
        : theme.colors.textInverse;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderColor:
            variant === 'outline' ? theme.colors.primary : 'transparent',
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            cairoText('extraBold'),
            { color: textColor, fontSize: theme.fontSize.md },
          ]}
          numberOfLines={2}
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
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  label: {
    textAlign: 'center',
  },
});
