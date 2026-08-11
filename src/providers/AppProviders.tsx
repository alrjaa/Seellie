import React, { type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/providers/ThemeProvider';
import {
  LanguageProvider,
  useLanguage,
} from '@/providers/LanguageProvider';
import { NavigationCairoProvider } from '@/providers/NavigationCairoProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { NotificationsProvider } from '@/providers/NotificationsProvider';
import { TournamentProvider } from '@/providers/TournamentProvider';
import { FloatingChromeProvider } from '@/providers/FloatingChromeProvider';
import { LoadingState } from '@/components/feedback/LoadingState';

/** ينتظر جاهزية اللغة ثم يعيد إنشاء الشجرة بمفتاح اللغة (بيانات البذرة مترجمة) */
function LanguageReadyGate({ children }: { children: ReactNode }) {
  const { ready, language } = useLanguage();
  if (!ready) return <LoadingState />;
  return (
    <React.Fragment key={language}>{children}</React.Fragment>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <LanguageReadyGate>
              <NavigationCairoProvider>
                <ToastProvider>
                  <NotificationsProvider>
                    <TournamentProvider>
                      <FloatingChromeProvider>{children}</FloatingChromeProvider>
                    </TournamentProvider>
                  </NotificationsProvider>
                </ToastProvider>
              </NavigationCairoProvider>
            </LanguageReadyGate>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
