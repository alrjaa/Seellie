/**
 * In-memory ledger simulator for LOCAL ARCHITECTURE TESTS only.
 * Mirrors critical server invariants — not used in production client flow.
 */

import { computeRevenueSplit, canDebit, nextBalanceAfter } from './ledger-math';

export type SimCatalogItem = {
  slug: string;
  creditsPrice: number;
  active: boolean;
};

export type SimCertificate = {
  id: string;
  idempotencyKey: string;
  catalogSlug: string;
  senderId: string;
  recipientId: string;
  creditsCost: number;
  platformFeeCredits: number;
  beneficiaryNetCredits: number;
  platformFeeBps: number;
  beneficiaryShareBps: number;
};

export type SimStorePurchase = {
  userId: string;
  platform: string;
  storeTransactionId: string;
  creditsAmount: number;
  status: 'pending' | 'verified' | 'refunded';
};

export type SimBeneficiaryEarning = {
  certificateId: string;
  beneficiaryId: string;
  grossCredits: number;
  platformFeeCredits: number;
  netCredits: number;
  status: 'pending' | 'available' | 'paid_out' | 'reversed';
};

export class LocalLedgerSimulator {
  private balances = new Map<string, number>();
  private ledgerKeys = new Set<string>();
  private certificates = new Map<string, SimCertificate>();
  private certByIdempotency = new Map<string, string>();
  private storePurchases = new Map<string, SimStorePurchase>();
  private earnings = new Map<string, SimBeneficiaryEarning>();
  private platformFeeBps = 3000;
  private beneficiaryShareBps = 7000;
  private certSeq = 0;

  getBalance(userId: string): number {
    return this.balances.get(userId) ?? 0;
  }

  grantCreditsFromVerifiedStorePurchase(input: {
    userId: string;
    platform: string;
    storeTransactionId: string;
    creditsAmount: number;
    idempotencyKey: string;
  }): { ok: boolean; duplicate?: boolean; error?: string } {
    const storeKey = `${input.platform}:${input.storeTransactionId}`;
    const existing = this.storePurchases.get(storeKey);
    if (existing?.status === 'verified') {
      return { ok: true, duplicate: true };
    }
    if (this.ledgerKeys.has(input.idempotencyKey)) {
      return { ok: true, duplicate: true };
    }

    this.storePurchases.set(storeKey, {
      userId: input.userId,
      platform: input.platform,
      storeTransactionId: input.storeTransactionId,
      creditsAmount: input.creditsAmount,
      status: 'verified',
    });
    this.appendLedger(input.userId, input.creditsAmount, input.idempotencyKey);
    return { ok: true };
  }

  purchaseCertificate(input: {
    senderId: string;
    recipientId: string;
    catalogSlug: string;
    catalog: SimCatalogItem[];
    idempotencyKey: string;
    reason?: string;
  }):
    | { ok: true; certificate: SimCertificate; duplicate?: boolean }
    | { ok: false; error: string } {
    if (!input.senderId || !input.recipientId) {
      return { ok: false, error: 'invalid_recipient' };
    }
    if (input.senderId === input.recipientId) {
      return { ok: false, error: 'invalid_recipient' };
    }

    const existingId = this.certByIdempotency.get(input.idempotencyKey);
    if (existingId) {
      const cert = this.certificates.get(existingId);
      if (cert) return { ok: true, certificate: cert, duplicate: true };
    }

    const item = input.catalog.find(
      (c) => c.slug === input.catalogSlug && c.active
    );
    if (!item) return { ok: false, error: 'invalid_catalog_item' };

    const split = computeRevenueSplit(
      item.creditsPrice,
      this.platformFeeBps,
      this.beneficiaryShareBps
    );

    const balance = this.getBalance(input.senderId);
    if (!canDebit(balance, item.creditsPrice)) {
      return { ok: false, error: 'insufficient_credits' };
    }

    const debitKey = input.idempotencyKey;
    if (this.ledgerKeys.has(debitKey)) {
      const existingCertId = this.certByIdempotency.get(debitKey);
      if (existingCertId) {
        const cert = this.certificates.get(existingCertId)!;
        return { ok: true, certificate: cert, duplicate: true };
      }
      return { ok: false, error: 'idempotency_in_progress' };
    }

    this.appendLedger(input.senderId, -item.creditsPrice, debitKey);

    const certId = `cert-${++this.certSeq}`;
    const certificate: SimCertificate = {
      id: certId,
      idempotencyKey: input.idempotencyKey,
      catalogSlug: item.slug,
      senderId: input.senderId,
      recipientId: input.recipientId,
      creditsCost: item.creditsPrice,
      platformFeeCredits: split.platformFeeCredits,
      beneficiaryNetCredits: split.beneficiaryNetCredits,
      platformFeeBps: split.platformFeeBps,
      beneficiaryShareBps: split.beneficiaryShareBps,
    };

    this.certificates.set(certId, certificate);
    this.certByIdempotency.set(input.idempotencyKey, certId);
    this.earnings.set(certId, {
      certificateId: certId,
      beneficiaryId: input.recipientId,
      grossCredits: split.grossCredits,
      platformFeeCredits: split.platformFeeCredits,
      netCredits: split.beneficiaryNetCredits,
      status: 'pending',
    });

    return { ok: true, certificate };
  }

  reverseStorePurchaseForUser(
    userId: string,
    platform: string,
    storeTransactionId: string
  ): { ok: boolean; duplicate?: boolean; error?: string; debited?: number } {
    const storeKey = `${platform}:${storeTransactionId}`;
    const purchase = this.storePurchases.get(storeKey);
    if (!purchase) return { ok: false, error: 'purchase_not_found' };
    if (purchase.userId !== userId) return { ok: false, error: 'purchase_not_found' };
    if (purchase.status === 'refunded') return { ok: true, duplicate: true };
    if (purchase.status !== 'verified') {
      return { ok: false, error: 'purchase_not_verified' };
    }
    return this.reverseForUser(userId, purchase);
  }

  private reverseForUser(
    userId: string,
    purchase: SimStorePurchase
  ): { ok: boolean; duplicate?: boolean; debited?: number } {
    const balance = this.getBalance(userId);
    const debit =
      balance >= purchase.creditsAmount ? purchase.creditsAmount : balance;
    if (debit > 0) {
      this.appendLedger(
        userId,
        -debit,
        `refund:${purchase.platform}:${purchase.storeTransactionId}`
      );
    }
    purchase.status = 'refunded';
    return { ok: true, debited: debit };
  }

  getEarning(certificateId: string): SimBeneficiaryEarning | undefined {
    return this.earnings.get(certificateId);
  }

  private appendLedger(
    userId: string,
    amount: number,
    idempotencyKey: string
  ): void {
    if (this.ledgerKeys.has(idempotencyKey)) return;
    const current = this.getBalance(userId);
    const next = nextBalanceAfter(current, amount);
    if (next === null) throw new Error('insufficient_credits');
    this.balances.set(userId, next);
    this.ledgerKeys.add(idempotencyKey);
  }
}
