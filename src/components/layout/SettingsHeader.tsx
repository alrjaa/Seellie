import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { AccountHeaderButton } from '@/components/layout/AccountHeaderButton';
import { HeaderBackButton } from '@/components/layout/HeaderBackButton';
import { fontFamily } from '@/theme/fonts';
import { headerSafeTop } from '@/theme/navigation';

type Props = {
  title?: string;
  /** إن وُجد يظهر بين العنوان والمعرّف */
  subtitle?: string;
  titleSize?: number;
  accountHref?: string;
  settingsHref?: string;
  /** إخفاء زر المعرف (مثلاً في وضع سطح المكتب) */
  hideAccount?: boolean;
  /** زر رجوع (مطلوب في شاشات مثل البريد) */
  showBack?: boolean;
};

/**
 * رأس تحت شريط الحالة/الشبكة/البطارية بالكامل ثم العنوان والمعرّف.
 */
function SettingsHeaderComponent({
  title,
  subtitle,
  titleSize = 14,
  accountHref = '/(follower)/settings/account',
  settingsHref = '/(follower)/settings',
  hideAccount,
  showBack,
}: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const insets = useSafeAreaInsets();
  const resolvedTitle = title ?? t('settings.title');

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
          paddingTop: headerSafeTop(insets.top),
        },
      ]}
    >
      <View
        style={[
          styles.row,
          {
            direction: isRTL ? 'rtl' : 'ltr',
          },
        ]}
      >
        {showBack ? (
          <View style={styles.backSlot}>
            <HeaderBackButton />
          </View>
        ) : null}
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontSize: titleSize,
              writingDirection: isRTL ? 'rtl' : 'ltr',
              textAlign: 'left',
            },
          ]}
          numberOfLines={1}
        >
          {resolvedTitle}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.textMuted,
                writingDirection: isRTL ? 'rtl' : 'ltr',
                textAlign: 'center',
              },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : (
          <View style={styles.spacer} />
        )}
        {!hideAccount ? (
          <AccountHeaderButton
            accountHref={accountHref}
            settingsHref={settingsHref}
            compact
          />
        ) : (
          <View style={styles.accountPlaceholder} />
        )}
      </View>
    </View>
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
  backSlot: {
    flexShrink: 0,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontWeight: 'normal',
    flexShrink: 1,
    flexGrow: 0,
    maxWidth: '42%',
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
  accountPlaceholder: { width: 72 },
});
