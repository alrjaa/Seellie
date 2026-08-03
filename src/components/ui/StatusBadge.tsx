import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';

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
  const { t } = useTranslation();
  const color =
    status === 'accepted' || status === 'active'
      ? theme.colors.primary
      : status === 'pending' || status === 'warned'
        ? theme.colors.warning
        : status === 'blocked'
          ? theme.colors.textMuted
          : theme.colors.danger;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{t(`status.${status}`)}</Text>
    </View>
  );
}

export const StatusBadge = memo(StatusBadgeComponent);

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: { fontSize: 11, fontWeight: '800' },
});
