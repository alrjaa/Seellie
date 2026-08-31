import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Seellie',
  slug: 'seellie-native',
  version: '1.0.112',
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'seellie',
  userInterfaceStyle: 'automatic',
  // تعطيل EAS Updates أثناء التطوير عبر Expo Go (يمنع خطأ Android: Failed to download remote update)
  updates: {
    enabled: false,
    checkAutomatically: 'NEVER',
    fallbackToCacheTimeout: 0,
  },
  // ثابت — بدون expo-updates لاستخدام policy appVersion
  runtimeVersion: '1.0.4',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0d1a26',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.seellie.app',
    buildNumber: '1',
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      CFBundleDevelopmentRegion: 'ar',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      backgroundColor: '#0d1a26',
    },
    package: 'com.seellie.app',
    versionCode: 110,
  },
  androidStatusBar: {
    translucent: true,
    backgroundColor: '#0d1a26',
    barStyle: 'light-content',
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-localization',
      {
        supportsRTL: true,
        // لا نفرض RTL دائماً — يتبع لغة التطبيق (عربي RTL / إنجليزي LTR)
        forcesRTL: false,
        supportedLocales: {
          ios: ['ar', 'en'],
          android: ['ar', 'en'],
        },
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './node_modules/@expo-google-fonts/cairo/400Regular/Cairo_400Regular.ttf',
          './node_modules/@expo-google-fonts/cairo/500Medium/Cairo_500Medium.ttf',
          './node_modules/@expo-google-fonts/cairo/600SemiBold/Cairo_600SemiBold.ttf',
          './node_modules/@expo-google-fonts/cairo/700Bold/Cairo_700Bold.ttf',
          './node_modules/@expo-google-fonts/cairo/800ExtraBold/Cairo_800ExtraBold.ttf',
          './node_modules/@expo-google-fonts/cairo/900Black/Cairo_900Black.ttf',
        ],
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'يسمح تطبيق Seellie بالوصول إلى صورك وفيديوهاتك لإضافتها لملف اللاعب.',
        cameraPermission:
          'يسمح تطبيق Seellie باستخدام الكاميرا لإضافة صور وفيديوهات للاعب.',
      },
    ],
  ],
  locales: {
    ar: './locales/ar.json',
    en: './locales/en.json',
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: { origin: false },
    supportsRTL: true,
    forcesRTL: false,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '9b6b2471-8e17-43ef-95ab-cc65fd95385a',
    },
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    },
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    /** يظهر على بطاقة الدخول للتحقق أن المتصفح حمّل آخر نشر */
    buildId:
      (process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.EXPO_PUBLIC_BUILD_ID ||
        '')
        .toString()
        .slice(0, 7) || `local-${Date.now().toString(36).slice(-5)}`,
  },
});
