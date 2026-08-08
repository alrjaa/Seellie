import { Image, type ImageSourcePropType } from 'react-native';

export type CertificateLevelName =
  | 'إبداع'
  | 'برونزي'
  | 'فضي'
  | 'ذهبي'
  | 'ماسي';

const CERTIFICATE_MODULES: Record<CertificateLevelName, ImageSourcePropType> = {
  إبداع: require('../../assets/certificates/creativity.jpg'),
  برونزي: require('../../assets/certificates/bronze.jpg'),
  فضي: require('../../assets/certificates/silver.jpg'),
  ذهبي: require('../../assets/certificates/gold.jpg'),
  ماسي: require('../../assets/certificates/diamond.jpg'),
};

/** أسماء عربية + إنجليزية (بعد تعريب البذرة) */
const CERTIFICATE_NAME_ALIASES: Record<string, CertificateLevelName> = {
  إبداع: 'إبداع',
  Creativity: 'إبداع',
  creativity: 'إبداع',
  برونزي: 'برونزي',
  Bronze: 'برونزي',
  bronze: 'برونزي',
  فضي: 'فضي',
  Silver: 'فضي',
  silver: 'فضي',
  ذهبي: 'ذهبي',
  Gold: 'ذهبي',
  gold: 'ذهبي',
  ماسي: 'ماسي',
  Diamond: 'ماسي',
  diamond: 'ماسي',
};

function resolveModuleUri(mod: ImageSourcePropType): string {
  const value = mod as unknown;

  if (typeof value === 'string' && value.length > 0) return value;

  if (value && typeof value === 'object') {
    const obj = value as { uri?: string; default?: string | { uri?: string } };
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
      const resolved = Image.resolveAssetSource(mod);
      if (resolved?.uri) return resolved.uri;
    }
  } catch {
    // ignore
  }

  return '';
}

export function resolveCertificateLevelName(
  name: string
): CertificateLevelName | null {
  return CERTIFICATE_NAME_ALIASES[name] ?? null;
}

export function isCertificateLevelName(
  name: string
): name is CertificateLevelName {
  return resolveCertificateLevelName(name) != null;
}

/** URI محلي لصورة الشهادة حسب اسم المستوى */
export function certificateImageUri(name: string): string {
  const key = resolveCertificateLevelName(name);
  if (!key) return '';
  return resolveModuleUri(CERTIFICATE_MODULES[key]);
}

export function certificateImageSource(
  name: string
): ImageSourcePropType | null {
  const key = resolveCertificateLevelName(name);
  if (!key) return null;
  return CERTIFICATE_MODULES[key];
}
