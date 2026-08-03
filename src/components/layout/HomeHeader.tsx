import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { Card, Muted } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AccountMenuButton } from '@/components/layout/AccountMenuButton';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';

type Props = {
  accountHref: string;
  settingsHref?: string;
  pageTitle?: string;
  pageSubtitle?: string;
};

function HomeHeaderComponent({
  accountHref,
  settingsHref,
  pageTitle,
  pageSubtitle,
}: Props) {
  const { currentUser } = useTournament();
  const theme = useAppTheme();
  const { isRTL } = useLanguage();

  if (!currentUser) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={{ paddingTop: HEADER_BELOW_STATUS_GAP }}>
        <Card style={styles.card}>
          <View
            style={[
              styles.row,
              {
                direction: isRTL ? 'rtl' : 'ltr',
                flexDirection: 'row',
              },
            ]}
          >
            <AccountMenuButton
              accountHref={accountHref}
              settingsHref={settingsHref}
              variant="handle"
            />
            <View
              style={[
                styles.info,
                { alignItems: isRTL ? 'flex-end' : 'flex-start' },
              ]}
            >
              {pageTitle ? (
                <Text
                  style={[
                    styles.meta,
                    {
                      color: theme.colors.text,
                      writingDirection: isRTL ? 'rtl' : 'ltr',
                      textAlign: isRTL ? 'right' : 'left',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {pageTitle}
                </Text>
              ) : null}
              {pageSubtitle ? (
                <Muted numberOfLines={1}>{pageSubtitle}</Muted>
              ) : null}
            </View>
            <ThemeToggle />
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}

export const HomeHeader = memo(HomeHeaderComponent);

const styles = StyleSheet.create({
  safe: {
    width: '100%',
  },
  card: {
    paddingVertical: 12,
  },
  row: {
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  meta: {
    fontSize: 13,
    fontWeight: '700',
  },
});
