/**
 * Pure commerce ledger math — mirrors server-side RPC logic for local tests.
 * Production balance changes happen only in Supabase RPCs, not here.
 */

export type RevenueSplit = {
  grossCredits: number;
  platformFeeCredits: number;
  beneficiaryNetCredits: number;
  platformFeeBps: number;
  beneficiaryShareBps: number;
};

/** Matches `purchase_certificate_with_credits` fee calculation. */
export function computeRevenueSplit(
  creditsPrice: number,
  platformFeeBps = 3000,
  beneficiaryShareBps = 7000
): RevenueSplit {
  if (creditsPrice <= 0) {
    throw new Error('invalid_credits_price');
  }
  const platformFeeCredits = Math.floor((creditsPrice * platformFeeBps) / 10000);
  const beneficiaryNetCredits = Math.max(creditsPrice - platformFeeCredits, 0);
  return {
    grossCredits: creditsPrice,
    platformFeeCredits,
    beneficiaryNetCredits,
    platformFeeBps,
    beneficiaryShareBps,
  };
}

export function canDebit(balance: number, amount: number): boolean {
  return Number.isFinite(balance) && Number.isFinite(amount) && amount > 0 && balance >= amount;
}

export function nextBalanceAfter(current: number, delta: number): number | null {
  const next = current + delta;
  if (!Number.isFinite(next) || next < 0) return null;
  return next;
}

export type LedgerLine = {
  idempotencyKey: string;
  amountCredits: number;
};

/**
 * Derives balance from ledger lines — audit helper; server uses wallet_accounts + ledger.
 */
export function deriveBalanceFromLedger(lines: LedgerLine[]): number {
  return lines.reduce((sum, line) => sum + line.amountCredits, 0);
}

export type RefundOutcome =
  | { kind: 'full'; amount: number }
  | { kind: 'partial'; amount: number; requested: number }
  | { kind: 'none'; reason: 'already_refunded' | 'not_verified' };

/** Mirrors `reverse_store_purchase` refund amount logic. */
export function computeRefundDebit(
  balance: number,
  purchasedCredits: number,
  status: 'pending' | 'verified' | 'failed' | 'cancelled' | 'refunded'
): RefundOutcome {
  if (status === 'refunded') return { kind: 'none', reason: 'already_refunded' };
  if (status !== 'verified') return { kind: 'none', reason: 'not_verified' };
  if (balance >= purchasedCredits) {
    return { kind: 'full', amount: purchasedCredits };
  }
  return { kind: 'partial', amount: balance, requested: purchasedCredits };
}

/** Client must never send price/credits amount for certificate purchase — slug only. */
export function assertClientCertificatePayload(payload: {
  catalogSlug?: string;
  creditsPrice?: number;
  platformFeeBps?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!payload.catalogSlug?.trim()) {
    return { ok: false, reason: 'catalog_slug_required' };
  }
  if (payload.creditsPrice !== undefined) {
    return { ok: false, reason: 'client_price_not_allowed' };
  }
  if (payload.platformFeeBps !== undefined) {
    return { ok: false, reason: 'client_fee_not_allowed' };
  }
  return { ok: true };
}
