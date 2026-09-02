/** بيانات كتالوج شهادات التقدير — بدون اعتماد على React Native */
export const RECOGNITION_CERTIFICATE_CATALOG = [
  {
    slug: 'cert_trending',
    price: 25,
    tier: 1,
    nameAr: 'تقدير متداول',
    nameEn: 'Trending Recognition',
    imageKey: 'فضي',
    descriptionAr: 'تقدير سريع ومتكرر — مناسب للدعم اليومي.',
    descriptionEn: 'Quick, frequent recognition for everyday support.',
  },
  {
    slug: 'cert_qualified',
    price: 50,
    tier: 2,
    nameAr: 'تقدير مؤهل',
    nameEn: 'Qualified Recognition',
    imageKey: 'ذهبي',
    descriptionAr: 'خطوة أعلى من التقدير المتداول — يظهر جدية أكبر.',
    descriptionEn: 'A step above trending — shows stronger appreciation.',
  },
  {
    slug: 'cert_100',
    price: 100,
    tier: 3,
    nameAr: 'تقدير 100',
    nameEn: 'Recognition 100',
    imageKey: 'ماسي',
    descriptionAr: 'شهادة تقدير — المستوى الأول.',
    descriptionEn: 'Recognition certificate — tier 1.',
  },
  {
    slug: 'cert_300',
    price: 300,
    tier: 4,
    nameAr: 'تقدير 300',
    nameEn: 'Recognition 300',
    imageKey: 'ذهبي',
    descriptionAr: 'شهادة تقدير — المستوى الثاني.',
    descriptionEn: 'Recognition certificate — tier 2.',
  },
  {
    slug: 'cert_500',
    price: 500,
    tier: 5,
    nameAr: 'تقدير 500',
    nameEn: 'Recognition 500',
    imageKey: 'ماسي',
    descriptionAr: 'شهادة تقدير — المستوى الثالث.',
    descriptionEn: 'Recognition certificate — tier 3.',
  },
  {
    slug: 'cert_700',
    price: 700,
    tier: 6,
    nameAr: 'تقدير 700',
    nameEn: 'Recognition 700',
    imageKey: 'ذهبي',
    descriptionAr: 'شهادة تقدير — المستوى الرابع.',
    descriptionEn: 'Recognition certificate — tier 4.',
  },
  {
    slug: 'cert_900',
    price: 900,
    tier: 7,
    nameAr: 'تقدير 900',
    nameEn: 'Recognition 900',
    imageKey: 'ماسي',
    descriptionAr: 'أعلى مستويات شهادة التقدير.',
    descriptionEn: 'The highest recognition certificate tier.',
  },
] as const;

export const RECOGNITION_ENTRY_MIN_PRICE = 25;
export const RECOGNITION_STANDARD_BASE_PRICE = 100;
export const RECOGNITION_STANDARD_STEP = 200;

export function recognitionSlugForPrice(price: number): string | null {
  const hit = RECOGNITION_CERTIFICATE_CATALOG.find((c) => c.price === price);
  return hit?.slug ?? null;
}
