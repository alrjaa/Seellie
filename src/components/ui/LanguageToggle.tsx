import React, { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

/** تبديل سريع عربية ↔ English (للدخول والإعدادات) */
function LanguageToggleComponent() {
  const theme = useAppTheme();
  const { language, setLanguage, t } = useLanguage();
  const next = language === 'ar' ? 'en' : 'ar';
  const label = language === 'ar' ? 'EN' : 'ع';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        next === 'en' ? t('settings.english') : t('settings.arabic')
      }
      onPress={() => {
        void setLanguage(next);
      }}
      hitSlop={8}
      style={[
        styles.btn,
        {
          backgroundColor: theme.colors.accentSoft,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          cairoText('semiBold'),
          { color: theme.colors.accent },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const LanguageToggle = memo(LanguageToggleComponent);

const styles = StyleSheet.create({
  btn: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
  },
});
