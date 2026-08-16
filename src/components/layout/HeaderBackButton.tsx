import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTournamentCore } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';

/**
 * زر رجوع بنفس شكل أزرار الفلتر الأيقونية (دائري صغير).
 */
function HeaderBackButtonComponent() {
  const theme = useAppTheme();
  const router = useRouter();
  const { t, isRTL } = useTranslation();
  const { currentUser, routeForRole } = useTournamentCore();

  const onPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (currentUser) {
      router.replace(routeForRole(currentUser.role) as any);
      return;
    }
    router.replace('/(auth)/login');
  }, [currentUser, routeForRole, router]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={4}
      onPress={onPress}
      style={[
        styles.btn,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Ionicons
        name={isRTL ? 'arrow-forward' : 'arrow-back'}
        size={15}
        color={theme.colors.accent}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const HeaderBackButton = memo(HeaderBackButtonComponent);
