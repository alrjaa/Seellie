import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { SuperAdminGuard } from '@/screens/superadmin/SuperAdminGuard';
import { transparentHeaderOptions } from '@/theme/navigation';

export default function SuperAdminLayout() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <SuperAdminGuard>
      <Stack
        screenOptions={{
          ...transparentHeaderOptions(theme, insets.top),
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_left',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
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
          options={{ title: t('screens.competitions') }}
        />
        <Stack.Screen
          name="competition-requests"
          options={{ title: t('nav.requestCompetition') }}
        />
        <Stack.Screen name="analytics" options={{ title: t('nav.analytics') }} />
        <Stack.Screen name="messages" options={{ title: t('nav.messages') }} />
        <Stack.Screen name="emails" options={{ title: t('nav.emails') }} />
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
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      </Stack>
    </SuperAdminGuard>
  );
}
