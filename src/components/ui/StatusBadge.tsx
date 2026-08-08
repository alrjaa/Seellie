import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

type Status =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'active'
  | 'suspended'
  | 'warned'
  | 'blocked';

type Props = {
  status: Status;
};

function StatusBadgeComponent({ status }: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const color =
    status === 'accepted' || status === 'active'
      ? theme.colors.accent
      : status === 'pending' || status === 'warned'
        ? theme.colors.warning
        : status === 'blocked'
          ? theme.colors.textMuted
          : theme.colors.danger;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}22`,
          borderColor: color,
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <Text style={[styles.text, cairoText('bold'), { color }]}>
        {t(`status.${status}`)}
      </Text>
    </View>
  );
}

export const StatusBadge = memo(StatusBadgeComponent);

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontSize: 11 },
});
