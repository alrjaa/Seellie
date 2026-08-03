import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/Button';

type Props = {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
};

function EmptyStateComponent({
  title,
  description,
  icon = 'file-tray-outline',
  actionLabel,
  onAction,
}: Props) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: theme.colors.primarySoft },
        ]}
      >
        <Ionicons name={icon} size={28} color={theme.colors.primary} />
      </View>
      <Text
        style={[
          styles.title,
          { color: theme.colors.text, fontSize: theme.fontSize.md + 1 },
        ]}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            styles.desc,
            { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

export const EmptyState = memo(EmptyStateComponent);

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
    gap: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  title: {
    fontWeight: '800',
    textAlign: 'left',
    width: '100%',
    flexShrink: 1,
  },
  desc: {
    lineHeight: 20,
    textAlign: 'left',
    marginBottom: 8,
    width: '100%',
    flexShrink: 1,
  },
  action: {
    width: '100%',
    marginTop: 4,
  },
});
