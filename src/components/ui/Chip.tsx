import React, { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';

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
      style={[
        styles.chip,
        {
          backgroundColor: active
            ? theme.colors.primary
            : theme.colors.inputBg,
          borderColor: active ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: active ? theme.colors.textInverse : theme.colors.textMuted,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const Chip = memo(ChipComponent);

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
