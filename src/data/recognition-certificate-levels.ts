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

type CatalogPrice = 25 | 50 | 100 | 300 | 500 | 700 | 900;

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

const EXPECTED_PRICES = new Set<CatalogPrice>(
  RECOGNITION_CERTIFICATE_CATALOG.map((item) => item.price as CatalogPrice)
);

const EXPECTED_PRICE_LIST = RECOGNITION_CERTIFICATE_CATALOG.map(
  (item) => item.price
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

/** استعادة كاملة للكتالوج الرسمي — للمشرف */
export function restoreDefaultRecognitionLevels(): SupportLevel[] {
  return buildInitialSupportLevels();
}

/** يملأ المستويات الناقصة ويرتّبها حسب السعر مع الإبقاء على تخصيصات الصور إن وُجدت */
export function repairRecognitionSupportLevels(
  levels: SupportLevel[]
): SupportLevel[] {
  const byPrice = new Map<CatalogPrice, SupportLevel>();

  for (const level of levels) {
    const price = Number(level.price) || 0;
    if (!EXPECTED_PRICES.has(price as CatalogPrice)) continue;
    const catalog = RECOGNITION_CERTIFICATE_CATALOG.find(
      (item) => item.price === price
    );
    if (!catalog) continue;

    byPrice.set(price as CatalogPrice, {
      id: level.id?.startsWith('cert-') ? level.id : `cert-${catalog.slug}`,
      kind: 'certificate',
      name: String(level.name || '').trim() || catalog.nameAr,
      price: catalog.price,
      description:
        String(level.description || '').trim() || catalog.descriptionAr,
      imageUrl:
        level.imageUrl?.trim() ||
        certificateImageUri(level.name) ||
        certificateImageUri(catalog.imageKey),
    });
  }

  return RECOGNITION_CERTIFICATE_CATALOG.map((item) => {
    const existing = byPrice.get(item.price as CatalogPrice);
    if (existing) return existing;
    return {
      id: `cert-${item.slug}`,
      kind: 'certificate' as const,
      name: item.nameAr,
      price: item.price,
      description: item.descriptionAr,
      imageUrl: certificateImageUri(item.imageKey),
    };
  });
}

/** يكتشف الكتالوج القديم أو الناقص لإصلاحه تلقائياً */
export function needsRecognitionCatalogRepair(
  levels: SupportLevel[]
): boolean {
  if (!levels?.length) return true;

  const gifts = levels.filter(
    (l) =>
      l.kind === 'gift' ||
      LEGACY_GIFT_NAMES.has(l.name) ||
      (l.price ?? 0) < RECOGNITION_ENTRY_MIN_PRICE
  );
  if (gifts.length > 0) return true;

  const certPrices = levels
    .filter(
      (l) =>
        l.kind === 'certificate' ||
        (l.price ?? 0) >= RECOGNITION_ENTRY_MIN_PRICE
    )
    .map((l) => Number(l.price) || 0)
    .sort((a, b) => a - b);

  if (certPrices.length !== EXPECTED_PRICE_LIST.length) return true;
  return !certPrices.every((price, index) => price === EXPECTED_PRICE_LIST[index]);
}

/** @deprecated use needsRecognitionCatalogRepair */
export function shouldMigrateLegacySupportLevels(
  levels: SupportLevel[]
): boolean {
  return needsRecognitionCatalogRepair(levels);
}

export function migrateToRecognitionCatalog(
  levels: SupportLevel[]
): SupportLevel[] {
  return repairRecognitionSupportLevels(levels);
}
