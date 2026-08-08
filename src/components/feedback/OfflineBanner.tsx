import React, { memo, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

/** Lightweight offline banner (best-effort via fetch probe). */
function OfflineBannerComponent() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    const probe = async () => {
      try {
        if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
          if (active) setOffline(!navigator.onLine);
          return;
        }
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
    probe();
    const id = setInterval(probe, 15000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') probe();
    });
    return () => {
      active = false;
      clearInterval(id);
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
