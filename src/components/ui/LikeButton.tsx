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
  const iconSize = androidSm ? 18 : size === 'sm' ? 22 : 26;
  const fontSize = androidSm ? 13 : size === 'sm' ? 14 : 15;
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
          alignSelf: 'center',
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
        {String(count)}
      </Text>
    </Pressable>
  );
}

export const LikeButton = memo(LikeButtonComponent);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 36,
  },
  count: {},
});
