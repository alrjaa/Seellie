import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

type Props = {
  count: number;
  liked?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  /** Better contrast on dark full-screen slides */
  tone?: 'default' | 'light';
};

function LikeButtonComponent({
  count,
  liked,
  onPress,
  disabled,
  size = 'md',
  tone = 'default',
}: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const androidSm = Platform.OS === 'android' && size === 'sm';
  const iconSize = androidSm ? 14 : size === 'sm' ? 16 : 18;
  const fontSize = androidSm ? 11 : size === 'sm' ? 12 : 13;
  const color = liked
    ? theme.colors.accent
    : tone === 'light'
      ? 'rgba(255,255,255,0.92)'
      : theme.colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        liked ? t('ui.unlikeA11y') : t('ui.likeA11y')
      }
      accessibilityState={{
        disabled: !!disabled || !onPress,
        selected: !!liked,
      }}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.row,
        {
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignSelf: isRTL ? 'flex-start' : 'flex-end',
          opacity: pressed ? 0.7 : disabled || !onPress ? 0.55 : 1,
        },
      ]}
    >
      <Ionicons
        name={liked ? 'heart' : 'heart-outline'}
        size={iconSize}
        color={color}
      />
      <Text style={[styles.count, cairoText('bold'), { color, fontSize }]}>
        {t('ui.likesCount', { count })}
      </Text>
    </Pressable>
  );
}

export const LikeButton = memo(LikeButtonComponent);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  count: {},
});
