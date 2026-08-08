import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { AppText, Muted } from '@/components/ui/Text';

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  right?: React.ReactNode;
  /** عدد غير مقروء — شارة تنبيه صغيرة */
  badge?: number;
};

/**
 * صف قائمة — يتبع اتجاه اللغة (عربي من اليمين).
 */
function ListRowComponent({
  title,
  subtitle,
  icon,
  onPress,
  right,
  badge,
}: Props) {
  const theme = useAppTheme();
  const { isRTL } = useLanguage();
  const showBadge = typeof badge === 'number' && badge > 0;
  const resolvedIcon =
    icon ?? (isRTL ? 'chevron-back' : 'chevron-forward');
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
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      {onPress ? (
        <View style={styles.iconWrap}>
          <Ionicons name={resolvedIcon} size={20} color={theme.colors.textMuted} />
          {showBadge ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.danger || '#E11D48',
                  ...(isRTL ? { left: -8, right: undefined } : { right: -8 }),
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {badge > 99 ? '99+' : String(badge)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {right}
      <View style={styles.textCol}>
        <AppText
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontSize: theme.fontSize.sm,
            },
          ]}
          numberOfLines={2}
        >
          {title}
        </AppText>
        {subtitle ? (
          <Muted style={styles.subtitle} numberOfLines={3}>
            {subtitle}
          </Muted>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        showBadge ? `${title}, ${badge}` : title
      }
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
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  iconWrap: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  textCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {},
  subtitle: {
    lineHeight: 18,
  },
});
