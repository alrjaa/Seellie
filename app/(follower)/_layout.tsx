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
import { cairoTabLabelStyle } from '@/theme/fonts';
import {
  tabBarChromeStyle,
  transparentHeaderOptions,
} from '@/theme/navigation';

export default function FollowerLayout() {
  const { currentUser, loading, routeForRole } = useTournament();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'follower') {
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
          headerLeftContainerStyle: {
            direction: 'ltr',
            marginStart: 4,
            paddingTop: 2,
          },
          headerTitleContainerStyle: {
            paddingTop: 2,
          },
          headerRight: () => (
            <AccountHeaderButton
              accountHref="/(follower)/settings/account"
              settingsHref="/(follower)/settings"
              compact
            />
          ),
          tabBarStyle: {
            ...tabBarChromeStyle(theme, insets.bottom),
            // ترتيب ثابت: الرئيسية يسار ثم اللقطات · عام · شخصية
            direction: 'ltr',
            flexDirection: 'row',
          },
          tabBarActiveTintColor: theme.colors.primary,
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
              <SettingsHeader title={t('screens.highlights')} titleSize={12} />
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
        <Tabs.Screen name="analysis/[id]" options={{ href: null, title: t('home.createAnalysis') }} />
        <Tabs.Screen name="content/create" options={{ href: null, title: t('home.createAnalysis') }} />
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
