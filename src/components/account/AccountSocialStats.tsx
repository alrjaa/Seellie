import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { AppText, Card, Muted, Subtitle } from '@/components/ui';
import type { User } from '@/data/initial-data';
import { getAccountSocialCounts } from '@/utils/social-stats';

type Props = {
  user: User | null | undefined;
  /** عنوان اختياري فوق الأرقام */
  title?: string;
};

/**
 * شريط إحصائيات أسفل الحساب: إعجابات · متابعون · يتابع
 */
function AccountSocialStatsComponent({ user, title }: Props) {
  const theme = useAppTheme();
  const { t, isRTL } = useTranslation();
  const counts = useMemo(() => getAccountSocialCounts(user), [user]);

  if (!user) return null;

  const items = [
    {
      key: 'likes',
      value: counts.likes,
      label: t('account.stats.likes'),
    },
    {
      key: 'followers',
      value: counts.followers,
      label: t('account.stats.followers'),
    },
    {
      key: 'following',
      value: counts.following,
      label: t('account.stats.following'),
    },
  ];

  return (
    <Card style={styles.card}>
      <Subtitle style={{ textAlign: 'left' }}>
        {title ?? t('account.stats.title')}
      </Subtitle>
      <Muted style={{ textAlign: 'left' }}>
        {t('account.stats.hint')}
      </Muted>
      <View
        style={[
          styles.row,
          {
            borderColor: theme.colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        {items.map((item, index) => (
          <View
            key={item.key}
            style={[
              styles.cell,
              index < items.length - 1 && {
                borderColor: theme.colors.border,
                ...(isRTL
                  ? { borderLeftWidth: StyleSheet.hairlineWidth }
                  : { borderRightWidth: StyleSheet.hairlineWidth }),
              },
            ]}
          >
            <AppText
              style={[
                styles.value,
                { color: theme.colors.accent, fontSize: theme.fontSize.lg },
              ]}
            >
              {item.value}
            </AppText>
            <Muted style={styles.label}>{item.label}</Muted>
          </View>
        ))}
      </View>
    </Card>
  );
}

export const AccountSocialStats = memo(AccountSocialStatsComponent);

const styles = StyleSheet.create({
  card: { gap: 8, width: '100%' },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 4,
  },
  value: {
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
  },
});
