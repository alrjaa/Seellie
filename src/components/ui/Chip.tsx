import React, { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { cairoText } from '@/theme/fonts';

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
};

function ChipComponent({ label, active, onPress }: Props) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active
            ? theme.colors.accent
            : theme.colors.inputBg,
          borderColor: active ? theme.colors.accent : theme.colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          cairoText('semiBold'),
          {
            color: active ? theme.colors.textInverse : theme.colors.textMuted,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const Chip = memo(ChipComponent);

const styles = StyleSheet.create({
  chip: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontSize: 12,
    textAlign: 'center',
  },
});
