import { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { AccountHeaderButton } from '@/components/layout/AccountHeaderButton';
import { SettingsHeader } from '@/components/layout/SettingsHeader';
import {
  DesktopShell,
  type DesktopNavItem,
} from '@/components/layout/DesktopShell';
import { useResponsive } from '@/hooks/useResponsive';
import { cairoTabLabelStyle } from '@/theme/fonts';
import {
  tabBarChromeStyle,
  transparentHeaderOptions,
} from '@/theme/navigation';

export default function OrganizerLayout() {
  const { currentUser, loading, routeForRole, messages } = useTournament();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { desktop } = useResponsive();

  const unreadMessages = useMemo(
    () =>
      currentUser
        ? messages.filter((m) => m.recipientId === currentUser.id && !m.read)
            .length
        : 0,
    [messages, currentUser]
  );

  const desktopItems = useMemo<DesktopNavItem[]>(
    () => [
      {
        key: 'home',
        label: t('nav.home'),
        href: '/(organizer)',
        icon: 'home-outline',
        section: t('organizer.dashboard.title'),
      },
      {
        key: 'competitions',
        label: t('screens.competitions'),
        href: '/(organizer)/competitions',
        icon: 'trophy-outline',
        section: t('organizer.dashboard.title'),
      },
      {
        key: 'freelancers',
        label: t('nav.freelancers'),
        href: '/(organizer)/freelancers',
        icon: 'football-outline',
        section: t('organizer.dashboard.title'),
      },
      {
        key: 'messages',
        label: t('nav.messages'),
        href: '/(organizer)/messages',
        icon: 'chatbubbles-outline',
        section: t('organizer.dashboard.title'),
      },
      {
        key: 'more',
        label: t('nav.more'),
        href: '/(organizer)/more',
        icon: 'grid-outline',
        section: t('organizer.dashboard.title'),
      },
      {
        key: 'financials',
        label: t('nav.financials'),
        href: '/(organizer)/financials',
        icon: 'cash-outline',
        section: t('nav.more'),
      },
      {
        key: 'settings',
        label: t('settings.title'),
        href: '/(organizer)/settings',
        icon: 'settings-outline',
        section: t('nav.more'),
      },
    ],
    [t]
  );

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'organizer') {
    return <Redirect href={routeForRole(active) as any} />;
  }

  return (
    <DesktopShell
      items={desktopItems}
      accountHref="/(organizer)/settings"
      settingsHref="/(organizer)/settings"
    >
      <View style={styles.root}>
        <Tabs
          screenOptions={{
            ...transparentHeaderOptions(theme, insets.top),
            headerRightContainerStyle: {

              marginEnd: 8,
              paddingTop: 2,
            },
            headerRight: () =>
              desktop ? null : (
                <AccountHeaderButton accountHref="/(organizer)/settings" />
              ),
            tabBarStyle: desktop
              ? { display: 'none', height: 0, overflow: 'hidden' }
              : {
                  ...tabBarChromeStyle(theme, insets.bottom),

                  flexDirection: 'row',
                },
            tabBarActiveTintColor: theme.colors.accent,
            tabBarInactiveTintColor: theme.colors.textMuted,
            tabBarLabelStyle: {
              ...cairoTabLabelStyle,
              ...(Platform.OS === 'android'
                ? { fontSize: 10, textAlign: 'center' as const }
                : null),
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: t('nav.home'),
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="competitions/index"
            options={{
              title: t('screens.competitions'),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="trophy" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="competitions/[id]"
            options={{
              href: null,
              title: t('screens.competitions'),
            }}
          />
          <Tabs.Screen
            name="request-competition"
            options={{
              href: null,
              title: t('nav.requestCompetition'),
            }}
          />
          <Tabs.Screen
            name="freelancers"
            options={{
              title: t('nav.freelancers'),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="football" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
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
                  accountHref="/(organizer)/settings"
                  settingsHref="/(organizer)/settings"
                  hideAccount={desktop}
                />
              ),
              tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="chatbubbles" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="more"
            options={{
              title: t('nav.more'),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="grid" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="media"
            options={{ href: null, title: t('nav.media') }}
          />
          <Tabs.Screen
            name="stats"
            options={{ href: null, title: t('nav.stats') }}
          />
          <Tabs.Screen
            name="comments"
            options={{ href: null, title: t('menu.forums') }}
          />
          <Tabs.Screen
            name="prizes"
            options={{ href: null, title: t('nav.prizes') }}
          />
          <Tabs.Screen
            name="announcements"
            options={{ href: null, title: t('nav.announcements') }}
          />
          <Tabs.Screen
            name="financials"
            options={{ href: null, title: t('nav.financials') }}
          />
          <Tabs.Screen
            name="referees"
            options={{
              href: null,
              title: t('organizer.referees.title'),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{ href: null, title: t('settings.title') }}
          />
        </Tabs>
      </View>
    </DesktopShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
