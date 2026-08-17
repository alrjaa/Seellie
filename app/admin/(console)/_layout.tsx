import { useMemo } from 'react';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useTournament } from '@/providers/TournamentProvider';
import { SuperAdminGuard } from '@/screens/superadmin/SuperAdminGuard';
import { SettingsHeader } from '@/components/layout/SettingsHeader';
import {
  DesktopShell,
  type DesktopNavItem,
} from '@/components/layout/DesktopShell';
import { ADMIN_MODULES } from '@/screens/superadmin/modules';
import { transparentHeaderOptions } from '@/theme/navigation';
import { useResponsive } from '@/hooks/useResponsive';
import { ADMIN_HOME, adminPath } from '@/utils/admin-portal';

export default function AdminConsoleLayout() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { desktop } = useResponsive();
  const { currentUser, messages } = useTournament();

  const unreadMessages = useMemo(
    () =>
      currentUser
        ? messages.filter((m) => m.recipientId === currentUser.id && !m.read)
            .length
        : 0,
    [messages, currentUser]
  );

  const desktopItems = useMemo<DesktopNavItem[]>(() => {
    const home: DesktopNavItem = {
      key: 'dashboard',
      label: t('superadmin.dashboard.title'),
      href: ADMIN_HOME,
      icon: 'grid-outline',
      section: t('superadmin.dashboard.title'),
    };
    const modules = ADMIN_MODULES.map((m) => ({
      key: m.key,
      label: t(`superadmin.modules.${m.key}.title`),
      href: m.href,
      icon: m.icon,
      section: t(`superadmin.groups.${m.group}`),
    }));
    return [home, ...modules];
  }, [t]);

  return (
    <SuperAdminGuard>
      <DesktopShell
        items={desktopItems}
        accountHref={adminPath('settings')}
        settingsHref={adminPath('settings')}
        brandLabel="Seellie Admin"
      >
        <Stack
          screenOptions={{
            ...transparentHeaderOptions(theme, insets.top),
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'slide_from_left',
            headerBackTitle: '',
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen
            name="home"
            options={{
              headerShown: false,
              title: t('superadmin.dashboard.title'),
            }}
          />
          <Stack.Screen name="users" options={{ title: t('nav.users') }} />
          <Stack.Screen
            name="referees"
            options={{ title: t('searchUi.kindReferee') }}
          />
          <Stack.Screen
            name="competitions/index"
            options={{ title: t('screens.competitions') }}
          />
          <Stack.Screen
            name="competitions/[id]"
            options={{
              title: t('screens.competitions'),
              headerBackTitle: t('screens.competitions'),
            }}
          />
          <Stack.Screen
            name="competition-requests"
            options={{ title: t('nav.requestCompetition') }}
          />
          <Stack.Screen
            name="analytics"
            options={{ title: t('nav.analytics') }}
          />
          <Stack.Screen
            name="messages"
            options={{
              title: t('nav.messages'),
              headerTitle: () => null,
              headerLeft: () => null,
              headerRight: () => null,
              header: () => (
                <SettingsHeader
                  title={t('nav.messages')}
                  subtitle={
                    unreadMessages > 0
                      ? t('home.messagesSubUnread', { count: unreadMessages })
                      : undefined
                  }
                  accountHref={adminPath('settings')}
                  settingsHref={adminPath('settings')}
                  hideAccount={desktop}
                  showBack
                />
              ),
            }}
          />
          <Stack.Screen
            name="emails"
            options={{
              title: t('nav.emails'),
              headerTitle: () => null,
              headerLeft: () => null,
              headerRight: () => null,
              header: () => (
                <SettingsHeader
                  title={t('nav.emails')}
                  accountHref={adminPath('settings')}
                  settingsHref={adminPath('settings')}
                  hideAccount={desktop}
                  showBack
                />
              ),
            }}
          />
          <Stack.Screen
            name="discussions"
            options={{ title: t('menu.forumsTitle') }}
          />
          <Stack.Screen name="analysts" options={{ title: t('menu.unique') }} />
          <Stack.Screen
            name="quick-comments"
            options={{ title: t('menu.forums') }}
          />
          <Stack.Screen
            name="ads"
            options={{ title: t('superadmin.modules.ads.title') }}
          />
          <Stack.Screen
            name="support"
            options={{ title: t('home.certificates') }}
          />
          <Stack.Screen name="invoices" options={{ title: t('nav.invoices') }} />
          <Stack.Screen
            name="invoices/[id]"
            options={{ title: t('nav.invoiceDetails') }}
          />
          <Stack.Screen name="icons" options={{ title: t('nav.fabIcons') }} />
          <Stack.Screen
            name="organizers/[id]"
            options={{ title: t('roles.organizer') }}
          />
          <Stack.Screen
            name="settings"
            options={{ title: t('settings.title') }}
          />
        </Stack>
      </DesktopShell>
    </SuperAdminGuard>
  );
}
