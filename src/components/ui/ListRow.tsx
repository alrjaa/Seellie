import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  right?: React.ReactNode;
};

/**
 * صف قائمة.
 * مع I18nManager RTL: flexDirection:'row' يبدأ من اليمين تلقائياً.
 */
function ListRowComponent({
  title,
  subtitle,
  icon = 'chevron-back',
  onPress,
  right,
}: Props) {
  const theme = useAppTheme();
  const content = (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md + 2,
          paddingVertical: theme.spacing.sm + 6,
          paddingHorizontal: theme.spacing.sm + 6,
          gap: theme.spacing.sm + 4,
        },
      ]}
    >
      {onPress ? (
        <Ionicons name={icon} size={20} color={theme.colors.textMuted} />
      ) : null}
      {right}
      <View style={styles.textCol}>
        <Text
          style={[
            styles.title,
            { color: theme.colors.text, fontSize: theme.fontSize.md },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
            ]}
            numberOfLines={3}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export const ListRow = memo(ListRowComponent);

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  textCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontWeight: '800',
    textAlign: 'left',
  },
  subtitle: {
    textAlign: 'left',
  },
});
