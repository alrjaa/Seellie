import React, { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

type Props = {
  label?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
};

function LoadingStateComponent({
  label,
  fullScreen = true,
  style,
}: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.loading');

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={resolvedLabel}
      style={[
        fullScreen ? styles.full : styles.inline,
        { backgroundColor: fullScreen ? theme.colors.background : 'transparent' },
        style,
      ]}
    >
      <ActivityIndicator color={theme.colors.accent} size="large" />
      <Text style={[styles.label, cairoText('semiBold'), { color: theme.colors.textMuted }]}>
        {resolvedLabel}
      </Text>
    </View>
  );
}

export const LoadingState = memo(LoadingStateComponent);

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  inline: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontSize: 13,
    textAlign: 'center',
  },
});
