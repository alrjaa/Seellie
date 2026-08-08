import React, { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';

function ThemeToggleComponent() {
  const theme = useAppTheme();
  const { toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        theme.isDark ? t('common.enableLight') : t('common.enableDark')
      }
      onPress={toggleTheme}
      hitSlop={8}
      style={[
        styles.btn,
        {
          backgroundColor: theme.colors.accentSoft,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Ionicons
        name={theme.isDark ? 'sunny-outline' : 'moon-outline'}
        size={18}
        color={theme.colors.accent}
      />
    </Pressable>
  );
}

export const ThemeToggle = memo(ThemeToggleComponent);

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
