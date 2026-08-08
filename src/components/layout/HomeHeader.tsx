import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { Card, Muted } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AccountMenuButton } from '@/components/layout/AccountMenuButton';
import { AdminEntryChip } from '@/components/account/AdminEntryChip';
import { useResponsive } from '@/hooks/useResponsive';
import { cairoText } from '@/theme/fonts';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';

type Props = {
  accountHref: string;
  settingsHref?: string;
  pageTitle?: string;
  pageSubtitle?: string;
};

/**
 * رأس الصفحة الرئيسية — بدون SafeArea إضافي
 * (Screen يتكفّل بـ edges top عند الحاجة).
 */
function HomeHeaderComponent({
  accountHref,
  settingsHref,
  pageTitle,
  pageSubtitle,
}: Props) {
  const { currentUser } = useTournament();
  const theme = useAppTheme();
  const { isRTL } = useLanguage();
  const { desktop } = useResponsive();

  if (!currentUser) return null;

  const titleAlign = {
    textAlign: (isRTL ? 'right' : 'left') as 'left' | 'right',
    writingDirection: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
  } as const;

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: desktop ? 4 : HEADER_BELOW_STATUS_GAP },
      ]}
    >
      <Card style={[styles.card, desktop && styles.cardDesktop]} padded={false}>
        <View
          style={[
            styles.row,
            {
              direction: isRTL ? 'rtl' : 'ltr',
              flexDirection: 'row',
              paddingVertical: desktop ? 12 : 10,
              paddingHorizontal: desktop ? 16 : 12,
            },
          ]}
        >
          {!desktop ? (
            <AccountMenuButton
              accountHref={accountHref}
              settingsHref={settingsHref}
              variant="handle"
            />
          ) : null}
          <View
            style={[
              styles.info,
              {
                alignItems: isRTL ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            {pageTitle ? (
              <Text
                style={[
                  styles.meta,
                  cairoText('bold'),
                  {
                    color: theme.colors.text,
                    fontSize: desktop ? 18 : 13,
                    ...titleAlign,
                    width: '100%',
                  },
                ]}
                numberOfLines={1}
              >
                {pageTitle}
              </Text>
            ) : null}
            {pageSubtitle ? (
              <Muted numberOfLines={1} style={[titleAlign, { width: '100%' }]}>
                {pageSubtitle}
              </Muted>
            ) : null}
          </View>
          <AdminEntryChip />
          {!desktop ? <ThemeToggle /> : null}
        </View>
      </Card>
    </View>
  );
}

export const HomeHeader = memo(HomeHeaderComponent);

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  card: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardDesktop: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  row: {
    alignItems: 'center',
    gap: 8,
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  meta: {
    fontSize: 13,
  },
});
