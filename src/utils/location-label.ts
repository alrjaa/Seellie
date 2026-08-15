import { i18n } from '@/i18n';
import { localizeContentText } from '@/i18n/localize-content';

/**
 * تسمية موقع للعرض بجانب التعليقات — مدينة ثم منطقة من البيانات الموجودة فقط.
 * لا تُرجع قيمة وهمية عند الغياب.
 */
export function resolveLocationLabel(parts: {
  city?: string | null;
  region?: string | null;
}): string | undefined {
  const city = (parts.city || '').trim();
  const region = (parts.region || '').trim();
  const raw = city || region;
  if (!raw) return undefined;
  return i18n.locale === 'en' ? localizeContentText(raw) : raw;
}
