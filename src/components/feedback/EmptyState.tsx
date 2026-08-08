import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { cairoText } from '@/theme/fonts';

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
  const { isRTL } = useLanguage();
  const edge = isRTL ? 'flex-end' : 'flex-start';

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
          alignItems: edge,
          direction: isRTL ? 'rtl' : 'ltr',
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: theme.colors.accentSoft,
            alignSelf: edge,
          },
        ]}
      >
        <Ionicons name={icon} size={28} color={theme.colors.accent} />
      </View>
      <Text
        style={[
          styles.title,
          cairoText('extraBold'),
          {
            color: theme.colors.text,
            fontSize: theme.fontSize.md + 1,
            textAlign: 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          },
        ]}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            styles.desc,
            cairoText('regular'),
            {
              color: theme.colors.textMuted,
              fontSize: theme.fontSize.sm,
              textAlign: 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={[styles.action, { alignItems: edge }]}>
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
    gap: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    width: '100%',
    flexShrink: 1,
  },
  desc: {
    lineHeight: 20,
    marginBottom: 8,
    width: '100%',
    flexShrink: 1,
  },
  action: {
    width: '100%',
    marginTop: 4,
  },
});
