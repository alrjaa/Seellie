const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const shimPath = path.resolve(__dirname, 'src/shims/react-native.js');
const firebaseWebStub = path.resolve(
  __dirname,
  'src/shims/firebase-web-stub.js'
);
const firebaseServiceWeb = path.resolve(
  __dirname,
  'src/shims/firebase-service-web.js'
);
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Only app/src imports use the Cairo Text shim.
  // Never shim node_modules — that breaks FlatList/StyleSheet lazy init.
  if (moduleName === 'react-native') {
    const origin = context.originModulePath || '';
    const fromShim =
      origin === shimPath ||
      origin.includes(`${path.sep}shims${path.sep}react-native`);
    const fromNodeModules = origin.includes(`${path.sep}node_modules${path.sep}`);

    if (!fromShim && !fromNodeModules) {
      return { filePath: shimPath, type: 'sourceFile' };
    }
  }

  // P1-01: keep Firebase out of the initial web bundle (Supabase is production SoT).
  // Native keeps real Firebase for rare legacy offline fallbacks.
  if (platform === 'web') {
    if (
      moduleName === 'firebase/app' ||
      moduleName === 'firebase/firestore' ||
      moduleName === 'firebase/auth' ||
      moduleName === 'firebase' ||
      (typeof moduleName === 'string' && moduleName.startsWith('firebase/'))
    ) {
      return { filePath: firebaseWebStub, type: 'sourceFile' };
    }
    if (
      moduleName === '@/services/firebase' ||
      (typeof moduleName === 'string' &&
        (moduleName.endsWith('/services/firebase') ||
          moduleName.endsWith(`${path.sep}services${path.sep}firebase`) ||
          moduleName.endsWith('/services/firebase.ts') ||
          moduleName.endsWith(`${path.sep}services${path.sep}firebase.ts`)))
    ) {
      return { filePath: firebaseServiceWeb, type: 'sourceFile' };
    }
  }

  if (typeof defaultResolveRequest === 'function') {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
