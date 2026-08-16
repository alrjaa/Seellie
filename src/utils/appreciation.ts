import type {
  AppreciationKind,
  GiftTransaction,
  SupportLevel,
} from '@/data/initial-data';

/** حالة عملية التقدير — جاهزة للدفع الحقيقي (بدون اعتبار الضغط = paid) */
export type AppreciationPurchaseStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  /** توافق سجلات قديمة من الخادم */
  | 'pending_demo';

export type { AppreciationKind };

export const CERTIFICATE_BASE_PRICE = 200;
export const CERTIFICATE_PRICE_STEP = 200;
export const DEFAULT_CERTIFICATE_TIER_COUNT = 6;

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

/** عرض موحد للحالة — pending_demo يُعامل كـ pending */
export function normalizeAppreciationStatus(
  status: string | undefined | null
): Exclude<AppreciationPurchaseStatus, 'pending_demo'> {
  if (status === 'paid') return 'paid';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  return 'pending';
}

export function isAppreciationPaid(status: string | undefined | null): boolean {
  return normalizeAppreciationStatus(status) === 'paid';
}

/**
 * FUTURE SERVER-SIDE: عند ربط بوابة الدفع يجب أن يكون الخادم مصدر الحقيقة لـ
 * amount / status / certificateNumber / timestamp / gifter / recipient.
 * العميل ينشئ Purchase Intent بحالة pending فقط — لا يعتبر الضغط paid.
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
