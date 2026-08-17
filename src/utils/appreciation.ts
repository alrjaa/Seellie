import type {
  AppreciationKind,
  AppreciationProcessStatus,
  GiftTransaction,
  SupportLevel,
} from '@/data/initial-data';

/** حالة عملية التقدير — جاهزة للدفع الحقيقي (بدون اعتبار الضغط = paid) */
export type AppreciationPurchaseStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'issued'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  /** توافق سجلات قديمة من الخادم — لا تُنشأ جديدًا */
  | 'pending_demo';

export type { AppreciationKind };

export const CERTIFICATE_BASE_PRICE = 200;
export const CERTIFICATE_PRICE_STEP = 200;
export const DEFAULT_CERTIFICATE_TIER_COUNT = 6;

/** Canonical status after server accepts a new purchase intent */
export const SERVER_INTENT_STATUS: AppreciationProcessStatus = 'awaiting_payment';

/** مستويات شهادات التقدير: 200، 400، … — قابل للتوسع دون إعادة بناء الواجهة */
export function buildCertificateAppreciationLevels(
  count = DEFAULT_CERTIFICATE_TIER_COUNT
): Array<{ tier: number; price: number; id: string; nameAr: string }> {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => {
    const tier = i + 1;
    const price = CERTIFICATE_BASE_PRICE + i * CERTIFICATE_PRICE_STEP;
    return {
      tier,
      price,
      id: `cert-tier-${tier}`,
      nameAr: `تقدير ${price}`,
    };
  });
}

export function certificateTierFromPrice(price: number): number {
  if (price < CERTIFICATE_BASE_PRICE) return 0;
  return Math.floor((price - CERTIFICATE_BASE_PRICE) / CERTIFICATE_PRICE_STEP) + 1;
}

export function resolveAppreciationKind(
  level: Pick<SupportLevel, 'kind' | 'price'>
): AppreciationKind {
  if (level.kind === 'gift' || level.kind === 'certificate') return level.kind;
  return level.price >= CERTIFICATE_BASE_PRICE ? 'certificate' : 'gift';
}

/**
 * عرض موحد للحالة.
 * pending_demo (legacy) → pending
 */
export function normalizeAppreciationStatus(
  status: string | undefined | null
): Exclude<AppreciationPurchaseStatus, 'pending_demo'> {
  if (status === 'paid') return 'paid';
  if (status === 'issued') return 'issued';
  if (status === 'awaiting_payment') return 'awaiting_payment';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  // pending_demo + pending + unknown → pending
  return 'pending';
}

/** إيراد / مدفوع فعليًا — paid أو issued فقط (ليس pending_demo) */
export function isAppreciationPaid(status: string | undefined | null): boolean {
  const n = normalizeAppreciationStatus(status);
  return n === 'paid' || n === 'issued';
}

/**
 * العميل ينشئ Purchase Intent بحالة pending فقط.
 * الخادم يرقّي إلى awaiting_payment عند append.
 */
export function createLocalPurchaseIntentStatus(): 'pending' {
  return 'pending';
}

export function filterLevelsByKind(
  levels: SupportLevel[],
  kind: AppreciationKind
): SupportLevel[] {
  return levels.filter((l) => resolveAppreciationKind(l) === kind);
}

export function giftsSentBy(
  gifts: GiftTransaction[],
  userId: string
): GiftTransaction[] {
  return gifts.filter((g) => g.gifterId === userId);
}

export function giftsReceivedBy(
  gifts: GiftTransaction[],
  userId: string
): GiftTransaction[] {
  return gifts.filter((g) => g.recipientId === userId);
}

export function resolveAppreciationKindFromTx(
  tx: Pick<GiftTransaction, 'appreciationKind' | 'amountPaid' | 'certificateType'>
): AppreciationKind {
  if (tx.appreciationKind === 'gift' || tx.appreciationKind === 'certificate') {
    return tx.appreciationKind;
  }
  return (tx.amountPaid ?? 0) >= CERTIFICATE_BASE_PRICE ? 'certificate' : 'gift';
}

/** هل الرقم شهادة رسمية صادرة من الخادم بعد الدفع؟ */
export function hasOfficialCertificateNumber(
  certificateNumber: string | undefined | null
): boolean {
  const v = (certificateNumber || '').trim();
  if (!v) return false;
  // Client provisional SUP-###### and empty are not official
  if (/^SUP-\d{6}$/i.test(v)) return false;
  if (/^INT-/i.test(v)) return false;
  return true;
}
