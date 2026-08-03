const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const shimPath = path.resolve(__dirname, 'src/shims/react-native.js');
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

  if (typeof defaultResolveRequest === 'function') {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
