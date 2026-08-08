import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
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

export default function FreelancerLayout() {
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
        href: '/(freelancer)',
        icon: 'home-outline',
      },
      {
        key: 'offers',
        label: t('nav.offers'),
        href: '/(freelancer)/offers',
        icon: 'mail-outline',
      },
      {
        key: 'messages',
        label: t('nav.messages'),
        href: '/(freelancer)/messages',
        icon: 'chatbubbles-outline',
      },
      {
        key: 'settings',
        label: t('settings.title'),
        href: '/(freelancer)/settings',
        icon: 'settings-outline',
      },
    ],
    [t]
  );

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'freelancer') {
    return <Redirect href={routeForRole(active) as any} />;
  }

  return (
    <DesktopShell
      items={desktopItems}
      accountHref="/(freelancer)/settings"
      settingsHref="/(freelancer)/settings"
    >
      <View style={styles.root}>
        <Tabs
          screenOptions={{
            ...transparentHeaderOptions(theme, insets.top),
            headerRightContainerStyle: {
              direction: 'ltr',
              marginEnd: 8,
              paddingTop: 2,
            },
            headerRight: () =>
              desktop ? null : (
                <AccountHeaderButton accountHref="/(freelancer)/settings" />
              ),
            tabBarStyle: desktop
              ? { display: 'none', height: 0, overflow: 'hidden' }
              : tabBarChromeStyle(theme, insets.bottom),
            tabBarActiveTintColor: theme.colors.accent,
            tabBarInactiveTintColor: theme.colors.textMuted,
            tabBarLabelStyle: cairoTabLabelStyle,
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
            name="offers"
            options={{
              title: t('nav.offers'),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="mail" color={color} size={size} />
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
                  accountHref="/(freelancer)/settings"
                  settingsHref="/(freelancer)/settings"
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
            name="settings"
            options={{
              title: t('settings.title'),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="settings" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              href: null,
              title: t('nav.profile'),
            }}
          />
        </Tabs>
      </View>
    </DesktopShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
