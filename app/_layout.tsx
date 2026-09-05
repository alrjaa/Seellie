import 'react-native-get-random-values';
import 'react-native-gesture-handler';
// تفعيل RTL للتطبيق العربي قبل أي واجهة
import '@/theme/rtl-setup';
// التقاط رموز الاستعادة من رابط البريد قبل أن يمسحها الراوتر
import { captureWebAuthUrlEarly } from '@/services/pending-auth-url';
captureWebAuthUrlEarly();
import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProviders } from '@/providers/AppProviders';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { FloatingActionMenu } from '@/components/layout/FloatingActionMenu';
import { AuthDeepLinkHandler } from '@/components/auth/AuthDeepLinkHandler';
import {
  applyGlobalCairoFonts,
  cairoFontMap,
} from '@/theme/fonts';
import { transparentHeaderOptions } from '@/theme/navigation';
import { layoutDirectionStyle } from '@/theme/direction';
import { injectDesktopWebStyles } from '@/theme/desktop-web';
import { installMediaUserActivation } from '@/services/media-user-activation';
import { ensureNativeFeedAudioSession } from '@/services/native-feed-autoplay';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const theme = useAppTheme();
  const { isRTL } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    injectDesktopWebStyles();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ensureNativeFeedAudioSession();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return installMediaUserActivation();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent');
    }
  }, []);

  const header = transparentHeaderOptions(theme, insets.top);

  return (
    <View
      style={[
        layoutDirectionStyle(isRTL),
        { backgroundColor: theme.colors.background, flex: 1 },
      ]}
    >
      <OfflineBanner />
      <StatusBar style={theme.isDark ? 'light' : 'dark'} translucent />
      <View style={[layoutDirectionStyle(isRTL), { flex: 1 }]}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'fade',
            ...header,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="ads" options={{ headerShown: false }} />
          <Stack.Screen name="(follower)" />
          <Stack.Screen name="(organizer)" />
          <Stack.Screen name="(freelancer)" />
          <Stack.Screen
            name="forums"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
          <Stack.Screen
            name="search"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
          <Stack.Screen
            name="shares"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
          <Stack.Screen
            name="unique"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
          <Stack.Screen
            name="share-cards"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
          <Stack.Screen
            name="privacy"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
          <Stack.Screen
            name="terms"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
          <Stack.Screen
            name="about"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
          <Stack.Screen
            name="profile/[id]"
            options={{
              headerShown: false,
              title: '',
              ...header,
            }}
          />
        </Stack>
      </View>
      <FloatingActionMenu />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(cairoFontMap);

  if (fontsLoaded) {
    applyGlobalCairoFonts();
  }

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
      return;
    }
    // الويب: لا تُبقِ الشاشة البيضاء طويلاً بانتظار الخطوط
    if (Platform.OS === 'web') {
      const id = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => undefined);
      }, 280);
      return () => clearTimeout(id);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && Platform.OS !== 'web') return null;

  return (
    <AppProviders>
      <AuthDeepLinkHandler />
      <RootNavigator />
    </AppProviders>
  );
}
