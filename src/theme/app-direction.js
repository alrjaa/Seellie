'use strict';

/**
 * اتجاه التطبيق الفعلي (من LanguageProvider).
 * يقرأه Text shim لأن I18nManager غالباً لا يتزامن في Expo Go.
 */
let appIsRTL = true;
const listeners = new Set();

function setAppRTL(next) {
  const value = !!next;
  if (appIsRTL === value) return;
  appIsRTL = value;
  listeners.forEach((listener) => {
    try {
      listener(appIsRTL);
    } catch {
      // ignore
    }
  });
}

function getAppRTL() {
  return appIsRTL;
}

function subscribeAppRTL(listener) {
  listeners.add(listener);
  listener(appIsRTL);
  return () => listeners.delete(listener);
}

module.exports = {
  setAppRTL,
  getAppRTL,
  subscribeAppRTL,
};
