import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';

/**
 * زر رجوع بنفس شكل أزرار الفلتر الأيقونية (دائري صغير).
 */
function HeaderBackButtonComponent() {
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { currentUser, routeForRole } = useTournament();

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
      <Ionicons name="arrow-back" size={15} color={theme.colors.primary} />
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
