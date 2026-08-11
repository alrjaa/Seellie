import { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
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

export default function FollowerLayout() {
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
        label: t('tabs.home'),
        href: '/(follower)',
        icon: 'home-outline',
        section: t('tabs.home'),
      },
      {
        key: 'highlights',
        label: t('tabs.highlights'),
        href: '/(follower)/highlights',
        icon: 'trophy-outline',
        section: t('tabs.home'),
      },
      {
        key: 'general',
        label: t('tabs.general'),
        href: '/(follower)/general',
        icon: 'compass-outline',
        section: t('tabs.home'),
      },
      {
        key: 'personality',
        label: t('tabs.personality'),
        href: '/(follower)/personality',
        icon: 'star-outline',
        section: t('tabs.home'),
      },
      {
        key: 'private',
        label: t('tabs.private'),
        href: '/(follower)/private',
        icon: 'lock-closed-outline',
        section: t('tabs.home'),
      },
      {
        key: 'unique',
        label: t('menu.unique'),
        href: '/unique',
        icon: 'diamond-outline',
        section: t('menu.forumsTitle'),
      },
      {
        key: 'forums',
        label: t('menu.forums'),
        href: '/forums',
        icon: 'chatbox-ellipses-outline',
        section: t('menu.forumsTitle'),
      },
      {
        key: 'shares',
        label: t('menu.shares'),
        href: '/shares',
        icon: 'share-social-outline',
        section: t('menu.forumsTitle'),
      },
      {
        key: 'messages',
        label: t('home.messages'),
        href: '/(follower)/messages',
        icon: 'mail-outline',
        section: t('menu.forumsTitle'),
      },
      {
        key: 'search',
        label: t('menu.search'),
        href: '/search',
        icon: 'search-outline',
        section: t('menu.forumsTitle'),
      },
      {
        key: 'certificates',
        label: t('home.certificates'),
        href: '/(follower)/certificates',
        icon: 'ribbon-outline',
        section: t('settings.title'),
      },
      {
        key: 'settings',
        label: t('settings.title'),
        href: '/(follower)/settings',
        icon: 'settings-outline',
        section: t('settings.title'),
      },
    ],
    [t]
  );

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'follower') {
    return <Redirect href={routeForRole(active) as any} />;
  }

  return (
    <DesktopShell
      items={desktopItems}
      accountHref="/(follower)/settings/account"
      settingsHref="/(follower)/settings"
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
            headerLeftContainerStyle: {
              direction: 'ltr',
              marginStart: 4,
              paddingTop: 2,
            },
            headerTitleContainerStyle: {
              paddingTop: 2,
            },
            headerRight: () => null,
            tabBarStyle: desktop
              ? { display: 'none', height: 0, overflow: 'hidden' }
              : {
                  ...tabBarChromeStyle(theme, insets.bottom),
                  direction: 'ltr',
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
              title: t('tabs.home'),
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="home" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="highlights"
            options={{
              title: t('tabs.highlights'),
              headerTitle: () => null,
              headerLeft: () => null,
              headerRight: () => null,
              header: () => (
                <SettingsHeader
                  title={t('screens.highlights')}
                  titleSize={12}
                  hideAccount
                />
              ),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="trophy" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="general"
            options={{
              title: t('tabs.general'),
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="compass" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="personality"
            options={{
              title: t('tabs.personality'),
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="star" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="private"
            options={{
              title: t('tabs.private'),
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="lock-closed" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen name="chat" options={{ href: null }} />
          <Tabs.Screen
            name="matches/index"
            options={{ href: null, title: t('screens.matches') }}
          />
          <Tabs.Screen
            name="matches/[id]"
            options={{ href: null, title: t('screens.matches') }}
          />
          <Tabs.Screen
            name="competitions/index"
            options={{ href: null, title: t('screens.competitions') }}
          />
          <Tabs.Screen
            name="competitions/[id]"
            options={{ href: null, title: t('screens.competitions') }}
          />
          <Tabs.Screen
            name="players/index"
            options={{ href: null, title: t('screens.players') }}
          />
          <Tabs.Screen
            name="players/[id]"
            options={{ href: null, title: t('screens.players') }}
          />
          <Tabs.Screen
            name="certificates"
            options={{
              href: null,
              title: t('home.certificates'),
              headerShown: false,
            }}
          />
          <Tabs.Screen
            name="messages"
            options={{
              href: null,
              title: t('home.messages'),
              headerTitle: () => null,
              headerLeft: () => null,
              headerRight: () => null,
              header: () => (
                <SettingsHeader
                  title={t('home.messages')}
                  subtitle={
                    unreadMessages > 0
                      ? t('home.messagesSubUnread', { count: unreadMessages })
                      : undefined
                  }
                  hideAccount
                />
              ),
            }}
          />
          <Tabs.Screen
            name="settings/index"
            options={{
              href: null,
              title: t('settings.title'),
              headerTitle: () => null,
              headerLeft: () => null,
              headerRight: () => null,
              header: () => (
                <SettingsHeader
                  title={t('settings.title')}
                  subtitle={t('settings.subtitle')}
                  hideAccount
                />
              ),
            }}
          />
          <Tabs.Screen
            name="settings/account"
            options={{ href: null, title: t('settings.account') }}
          />
          <Tabs.Screen
            name="analysis/create"
            options={{ href: null, title: t('home.createAnalysis') }}
          />
          <Tabs.Screen
            name="analysis/[id]"
            options={{ href: null, title: t('home.createAnalysis') }}
          />
          <Tabs.Screen
            name="content/create"
            options={{ href: null, title: t('create.contentTitle') }}
          />
          <Tabs.Screen
            name="profile/[id]"
            options={{
              href: null,
              title: t('settings.handle'),
              headerRight: () => null,
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
