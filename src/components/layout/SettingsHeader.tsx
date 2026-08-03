import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { AccountHeaderButton } from '@/components/layout/AccountHeaderButton';
import { fontFamily } from '@/theme/fonts';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';

type Props = {
  title?: string;
  /** إن وُجد يظهر بين العنوان والمعرّف */
  subtitle?: string;
  titleSize?: number;
  accountHref?: string;
  settingsHref?: string;
};

/**
 * رأس تحت شريط الحالة/الشبكة بالكامل ثم الأزرار.
 */
function SettingsHeaderComponent({
  title,
  subtitle,
  titleSize = 14,
  accountHref = '/(follower)/settings/account',
  settingsHref = '/(follower)/settings',
}: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const resolvedTitle = title ?? t('settings.title');

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.row,
          {
            direction: isRTL ? 'rtl' : 'ltr',
            paddingTop: HEADER_BELOW_STATUS_GAP,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontSize: titleSize,
              writingDirection: isRTL ? 'rtl' : 'ltr',
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
          numberOfLines={1}
        >
          {resolvedTitle}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : (
          <View style={styles.spacer} />
        )}
        <AccountHeaderButton
          accountHref={accountHref}
          settingsHref={settingsHref}
          compact
        />
      </View>
    </SafeAreaView>
  );
}

export const SettingsHeader = memo(SettingsHeaderComponent);

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 44,
    gap: 8,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontWeight: 'normal',
    flexShrink: 1,
    flexGrow: 0,
  },
  subtitle: {
    flex: 1,
    fontSize: 11,
    fontFamily: fontFamily.regular,
    fontWeight: 'normal',
    textAlign: 'center',
    minWidth: 0,
  },
  spacer: { flex: 1 },
});
