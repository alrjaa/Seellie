import { certificateImageUri } from '@/theme/certificates';
import type { SupportLevel } from '@/data/initial-data';
import {
  RECOGNITION_CERTIFICATE_CATALOG,
  RECOGNITION_ENTRY_MIN_PRICE,
} from '@/data/recognition-certificate-catalog';

export {
  RECOGNITION_CERTIFICATE_CATALOG,
  RECOGNITION_ENTRY_MIN_PRICE,
  RECOGNITION_STANDARD_BASE_PRICE,
  RECOGNITION_STANDARD_STEP,
  recognitionSlugForPrice,
} from '@/data/recognition-certificate-catalog';

const LEGACY_GIFT_NAMES = new Set([
  'إبداع',
  'Creativity',
  'برونزي',
  'Bronze',
  'فضي',
  'Silver',
  'ذهبي',
  'Gold',
  'ماسي',
  'Diamond',
]);

const EXPECTED_PRICES = new Set(
  RECOGNITION_CERTIFICATE_CATALOG.map((item) => item.price)
);

export function buildInitialSupportLevels(): SupportLevel[] {
  return RECOGNITION_CERTIFICATE_CATALOG.map((item) => ({
    id: `cert-${item.slug}`,
    kind: 'certificate' as const,
    name: item.nameAr,
    price: item.price,
    description: item.descriptionAr,
    imageUrl: certificateImageUri(item.imageKey),
  }));
}

/** يكتشف الكتالوج القديم (هدايا + تقدير 200…) لترقيته تلقائياً */
export function shouldMigrateLegacySupportLevels(
  levels: SupportLevel[]
): boolean {
  if (!levels.length) return false;
  const gifts = levels.filter(
    (l) =>
      l.kind === 'gift' ||
      LEGACY_GIFT_NAMES.has(l.name) ||
      (l.price ?? 0) < RECOGNITION_ENTRY_MIN_PRICE
  );
  if (gifts.length > 0) return true;

  const certs = levels.filter((l) => l.kind === 'certificate' || (l.price ?? 0) >= RECOGNITION_ENTRY_MIN_PRICE);
  if (certs.length !== RECOGNITION_CERTIFICATE_CATALOG.length) return true;
  return certs.some((l) => !EXPECTED_PRICES.has((l.price ?? 0) as 25 | 50 | 100 | 300 | 500 | 700 | 900));
}

export function migrateToRecognitionCatalog(
  levels: SupportLevel[]
): SupportLevel[] {
  if (!shouldMigrateLegacySupportLevels(levels)) return levels;
  return buildInitialSupportLevels();
}
