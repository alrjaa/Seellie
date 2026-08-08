import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nManager, Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { reloadAppAsync } from 'expo';
import {
  LANGUAGE_STORAGE_KEY,
  setI18nLocale,
  shouldUseRTL,
  t,
  type AppLanguage,
} from '@/i18n';
import {
  layoutDirectionStyle,
  syncDocumentDirection,
} from '@/theme/direction';
import { setAppRTL } from '@/theme/app-direction';

type LanguageContextValue = {
  language: AppLanguage;
  isRTL: boolean;
  ready: boolean;
  t: typeof t;
  setLanguage: (lang: AppLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const RTL_SYNC_KEY = 'tajjd_rtl_sync_locale';

function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

async function readStoredLanguage(): Promise<AppLanguage> {
  try {
    const raw = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw === 'en' || raw === 'ar') return raw;
  } catch {
    // ignore
  }
  return 'ar';
}

/** فرض اتجاه النظام حسب اللغة (LTR للإنجليزية / RTL للعربية) */
function applyNativeDirection(lang: AppLanguage) {
  const wantRtl = shouldUseRTL(lang);
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(wantRtl);
    if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
      I18nManager.swapLeftAndRightInRTL(wantRtl);
    }
  } catch (e) {
    console.warn('applyNativeDirection failed', e);
  }
  return wantRtl;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('ar');
  const [ready, setReady] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const lang = await readStoredLanguage();
      if (!alive) return;
      setI18nLocale(lang);
      setLanguageState(lang);

      const wantRtl = shouldUseRTL(lang);
      const nativeMatches = I18nManager.isRTL === wantRtl;

      // إن كان الاتجاه الأصلي مطابقاً — لا حاجة لإعادة تحميل
      if (nativeMatches || Platform.OS === 'web') {
        setReady(true);
        return;
      }

      // مواءمة مرة واحدة فقط لكل لغة (يمنع حلقة لا نهائية في Expo Go)
      try {
        const syncedFor = await AsyncStorage.getItem(RTL_SYNC_KEY);
        if (syncedFor === lang) {
          // حاولنا مسبقاً وما زال غير متطابق — نعتمد على direction في الـ View
          setReady(true);
          return;
        }
        applyNativeDirection(lang);
        await AsyncStorage.setItem(RTL_SYNC_KEY, lang);
        // في Expo Go على Android قد لا يتغيّر isRTL — نكمّل بعد محاولة reload
        await reloadAppAsync('language-rtl-sync');
        if (alive) setReady(true);
      } catch (e) {
        console.warn('RTL sync skipped', e);
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    if (lang !== 'ar' && lang !== 'en') return;
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      // اسمح بمزامنة اتجاه جديدة لهذه اللغة
      await AsyncStorage.removeItem(RTL_SYNC_KEY);
    } catch (e) {
      console.warn('Failed to persist language', e);
    }
    setI18nLocale(lang);
    setLanguageState(lang);

    if (Platform.OS === 'web') return;

    applyNativeDirection(lang);
    try {
      await AsyncStorage.setItem(RTL_SYNC_KEY, lang);
      setReady(true);
      await reloadAppAsync('language-change');
    } catch (e) {
      console.warn('Language reload failed', e);
      setReady(true);
    }
  }, []);

  const isRTL = shouldUseRTL(language);

  useLayoutEffect(() => {
    setAppRTL(isRTL);
  }, [isRTL]);

  useEffect(() => {
    syncDocumentDirection(isRTL, language);
  }, [isRTL, language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isRTL,
      ready,
      t,
      setLanguage,
    }),
    [language, isRTL, ready, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {/* اتجاه تخطيطي يعمل حتى لو I18nManager لم يتحدّث في Expo Go */}
      <View style={layoutDirectionStyle(isRTL)}>{children}</View>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

export function useTranslation() {
  const { t: translate, language, isRTL } = useLanguage();
  return { t: translate, language, isRTL };
}
