import React, { memo, useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

/** Lightweight offline banner — event-driven on web; no 15s network spam (P1-04). */
function OfflineBannerComponent() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;

    const applyNavigator = () => {
      if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
        if (active) setOffline(!navigator.onLine);
        return true;
      }
      return false;
    };

    const probeFetch = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (active) setOffline(false);
      } catch {
        if (active) setOffline(true);
      }
    };

    applyNavigator();
    if (typeof navigator === 'undefined' || !('onLine' in navigator)) {
      void probeFetch();
    }

    const onOnline = () => {
      if (active) setOffline(false);
    };
    const onOffline = () => {
      if (active) setOffline(true);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }

    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (!applyNavigator()) {
        void probeFetch();
      }
    });

    return () => {
      active = false;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
      sub.remove();
    };
  }, []);

  if (!offline) return null;

  return (
    <View style={[styles.banner, { backgroundColor: theme.colors.danger }]}>
      <Text style={[styles.text, cairoText('bold')]}>{t('offline.title')}</Text>
      <Text style={[styles.hint, cairoText('regular')]}>{t('offline.hint')}</Text>
    </View>
  );
}

export const OfflineBanner = memo(OfflineBannerComponent);

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    textAlign: 'center',
  },
});
