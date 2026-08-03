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

export default function FreelancerLayout() {
  const { currentUser, loading, routeForRole } = useTournament();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'freelancer') {
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
            <AccountHeaderButton accountHref="/(freelancer)/settings" />
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
