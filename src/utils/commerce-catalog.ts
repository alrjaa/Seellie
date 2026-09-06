import type { CertificateCatalogItem } from '@/services/commerce/types';
import type { SupportLevel } from '@/data/initial-data';
import {
  RECOGNITION_CERTIFICATE_CATALOG,
  recognitionSlugForPrice,
} from '@/data/recognition-certificate-catalog';

const NAME_SLUG_MAP: Record<string, string> = {
  'تقدير متداول': 'cert_trending',
  'trending recognition': 'cert_trending',
  'تقدير مؤهل': 'cert_qualified',
  'qualified recognition': 'cert_qualified',
};

for (const item of RECOGNITION_CERTIFICATE_CATALOG) {
  NAME_SLUG_MAP[item.nameAr] = item.slug;
  NAME_SLUG_MAP[item.nameEn.toLowerCase()] = item.slug;
  NAME_SLUG_MAP[`تقدير ${item.price}`] = item.slug;
  NAME_SLUG_MAP[`recognition ${item.price}`] = item.slug;
}

/** يطابق مستوى التقدير المحلي بعنصر الكتالوج السحابي عبر السعر أو الاسم. */
export function catalogSlugForSupportLevel(
  level: Pick<SupportLevel, 'name' | 'price'>,
  catalog: CertificateCatalogItem[]
): string | null {
  const byPrice = catalog.find((c) => c.credits_price === level.price);
  if (byPrice) return byPrice.slug;

  const fromSeed = recognitionSlugForPrice(level.price);
  if (fromSeed) {
    const hit = catalog.find((c) => c.slug === fromSeed);
    if (hit) return hit.slug;
  }

  const key = level.name.trim().toLowerCase();
  const mapped =
    NAME_SLUG_MAP[level.name.trim()] || NAME_SLUG_MAP[key];
  if (mapped) {
    const hit = catalog.find((c) => c.slug === mapped);
    if (hit) return hit.slug;
  }

  const tierMatch = level.name.match(/(\d+)/);
  if (tierMatch) {
    const hit = catalog.find((c) => c.slug === `cert_${tierMatch[1]}`);
    if (hit) return hit.slug;
  }
  return null;
}

export function catalogItemForSupportLevel(
  level: Pick<SupportLevel, 'name' | 'price'>,
  catalog: CertificateCatalogItem[]
): CertificateCatalogItem | null {
  const slug = catalogSlugForSupportLevel(level, catalog);
  if (!slug) return null;
  return catalog.find((c) => c.slug === slug) || null;
}
