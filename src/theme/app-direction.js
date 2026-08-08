'use strict';

/**
 * اتجاه التطبيق الفعلي (من LanguageProvider).
 * يقرأه Text shim لأن I18nManager غالباً لا يتزامن في Expo Go.
 */
let appIsRTL = true;

function setAppRTL(next) {
  appIsRTL = !!next;
}

function getAppRTL() {
  return appIsRTL;
}

module.exports = {
  setAppRTL,
  getAppRTL,
};
