import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

type Props = {
  /** أصغر للأشرطة الضيقة */
  compact?: boolean;
};

/**
 * زر ظاهر مباشرة في الهيدر: خروج ثم بوابة المشرف.
 */
function AdminEntryChipComponent({ compact }: Props) {
  const { currentUser, logout } = useTournament();
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();

  const onPress = useCallback(() => {
    logout({ to: 'admin' });
  }, [logout]);

  if (!currentUser || currentUser.role === 'superadmin') return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('menu.enterAdmin')}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        {
          borderColor: theme.colors.accent,
          backgroundColor: theme.colors.accentSoft,
          opacity: pressed ? 0.75 : 1,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      <Ionicons
        name="shield-checkmark"
        size={compact ? 12 : 14}
        color={theme.colors.accent}
      />
      <Text
        style={[
          styles.label,
          compact && styles.labelCompact,
          cairoText('bold'),
          { color: theme.colors.accent },
        ]}
        numberOfLines={1}
      >
        {t('menu.enterAdmin')}
      </Text>
    </Pressable>
  );
}

export const AdminEntryChip = memo(AdminEntryChipComponent);

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 140,
  },
  chipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    maxWidth: 110,
  },
  label: {
    fontSize: 11,
  },
  labelCompact: {
    fontSize: 9,
  },
});
