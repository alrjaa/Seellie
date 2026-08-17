import { Image, type ImageSourcePropType } from 'react-native';
import { brandPalette } from '@/theme/colors';

/** اسم العرض الافتراضي للتطبيق */
export const APP_DISPLAY_NAME = 'Seellie';

/** ألوان الهوية البصرية */
export const BRAND_COLORS = brandPalette;

/** وحدة الشعار المضمّنة (F12-P2-08: WebP مضغوط للـLCP) */
export const DEFAULT_LOGO_MODULE =
  require('../../assets/seellie-logo.webp') as ImageSourcePropType;

/**
 * URI للشعار الافتراضي — متوافق مع native وweb
 * (Image.resolveAssetSource غير موثوق على الويب).
 */
function resolveDefaultLogoUri(): string {
  const mod = DEFAULT_LOGO_MODULE as unknown;

  if (typeof mod === 'string' && mod.length > 0) return mod;

  if (mod && typeof mod === 'object') {
    const obj = mod as { uri?: string; default?: string | { uri?: string } };
    if (typeof obj.uri === 'string' && obj.uri) return obj.uri;
    if (typeof obj.default === 'string' && obj.default) return obj.default;
    if (
      obj.default &&
      typeof obj.default === 'object' &&
      typeof obj.default.uri === 'string'
    ) {
      return obj.default.uri;
    }
  }

  try {
    if (typeof Image.resolveAssetSource === 'function') {
      const resolved = Image.resolveAssetSource(DEFAULT_LOGO_MODULE);
      if (resolved?.uri) return resolved.uri;
    }
  } catch {
    // ignore
  }

  return '';
}

export const DEFAULT_LOGO: string = resolveDefaultLogoUri();
