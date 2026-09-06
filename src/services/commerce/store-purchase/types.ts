import type { StorePlatform } from '../types';

/** Normalized store receipt — platform-agnostic shape for server verification. */
export type StorePurchaseReceipt = {
  platform: StorePlatform;
  productId: string;
  transactionId: string;
  purchaseToken?: string;
  receiptData?: string;
};

export type StorePurchaseState =
  | 'idle'
  | 'purchasing'
  | 'verifying'
  | 'done'
  | 'error';

/**
 * Adapter for Apple IAP / Google Play Billing.
 * Production implementations call native SDKs; tests use stubs only.
 */
export interface StorePurchaseProvider {
  readonly platform: StorePlatform | null;
  init(productIds: string[]): Promise<boolean>;
  end(): Promise<void>;
  purchase(productId: string): Promise<StorePurchaseReceipt | null>;
  finish(receipt: StorePurchaseReceipt, isConsumable?: boolean): Promise<void>;
  listPendingPurchases(): Promise<StorePurchaseReceipt[]>;
}

export type VerifyPurchaseFn = (input: {
  receipt: StorePurchaseReceipt;
  idempotencyKey: string;
}) => Promise<{ ok: boolean; error?: string; duplicate?: boolean }>;
