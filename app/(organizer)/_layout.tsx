import { View, StyleSheet } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { AccountHeaderButton } from '@/components/layout/AccountHeaderButton';
import { cairoTabLabelStyle } from '@/theme/fonts';
import {
  tabBarChromeStyle,
  transparentHeaderOptions,
} from '@/theme/navigation';

export default function OrganizerLayout() {
  const { currentUser, loading, routeForRole } = useTournament();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'organizer') {
    return <Redirect href={routeForRole(active) as any} />;
  }

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          ...transparentHeaderOptions(theme, insets.top),
          headerRightContainerStyle: {
            direction: 'ltr',
            marginEnd: 8,
            paddingTop: 2,
          },
          headerRight: () => (
            <AccountHeaderButton accountHref="/(organizer)/settings" />
          ),
          tabBarStyle: tabBarChromeStyle(theme, insets.bottom),
          tabBarActiveTintColor: theme.colors.primary,
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
          name="settings"
          options={{ href: null, title: t('settings.title') }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
