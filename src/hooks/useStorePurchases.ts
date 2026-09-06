import { createId } from '@/utils/id';
import type { CreditPackage } from '@/services/commerce/types';
import { verifyStorePurchase } from '@/services/commerce';
import {
  getStorePurchaseProvider,
  setStorePurchaseProviderForTests,
} from '@/services/commerce/store-purchase';
import { productIdForPackage } from '@/services/commerce/store-purchase/product-ids';
import type { StorePurchaseState } from '@/services/commerce/store-purchase/types';

export function storePlatform() {
  return getStorePurchaseProvider().platform;
}

export function productIdForPackageOnDevice(pkg: CreditPackage): string | null {
  return productIdForPackage(pkg, getStorePurchaseProvider().platform);
}

export { productIdForPackage };

type PurchaseListener = (state: StorePurchaseState) => void;

export async function initStorePurchases(productIds: string[]) {
  return getStorePurchaseProvider().init(productIds);
}

export async function endStorePurchases() {
  await getStorePurchaseProvider().end();
}

export async function buyCreditPackage(
  pkg: CreditPackage,
  onState?: PurchaseListener
): Promise<{ ok: boolean; error?: string }> {
  const provider = getStorePurchaseProvider();
  const platform = provider.platform;
  if (!platform) {
    return { ok: false, error: 'store_unavailable_on_web' };
  }

  const productId = productIdForPackage(pkg, platform);
  if (!productId) {
    return { ok: false, error: 'product_not_configured' };
  }

  const idempotencyKey = createId('iap');

  try {
    onState?.('purchasing');
    const receipt = await provider.purchase(productId);
    if (!receipt) {
      onState?.('error');
      return { ok: false, error: 'purchase_cancelled' };
    }

    onState?.('verifying');
    const verify = await verifyStorePurchase({
      platform: receipt.platform,
      productId: receipt.productId,
      transactionId: receipt.transactionId,
      purchaseToken: receipt.purchaseToken,
      receiptData: receipt.receiptData,
      idempotencyKey,
    });

    if (!verify.ok) {
      onState?.('error');
      return { ok: false, error: verify.error || 'verification_failed' };
    }

    try {
      await provider.finish(receipt, true);
    } catch {
      // verification succeeded; finishing is best-effort
    }

    onState?.('done');
    return { ok: true };
  } catch (e) {
    onState?.('error');
    const msg = e instanceof Error ? e.message : 'purchase_failed';
    if (/cancel/i.test(msg)) return { ok: false, error: 'purchase_cancelled' };
    return { ok: false, error: msg };
  }
}

export async function recoverPendingStorePurchases(
  packages: CreditPackage[]
): Promise<{ recovered: number }> {
  const provider = getStorePurchaseProvider();
  const platform = provider.platform;
  if (!platform || !packages.length) return { recovered: 0 };

  let recovered = 0;
  try {
    const pending = await provider.listPendingPurchases();
    for (const receipt of pending) {
      const pkg = packages.find(
        (p) => productIdForPackage(p, platform) === receipt.productId
      );
      if (!pkg) continue;

      const verify = await verifyStorePurchase({
        platform: receipt.platform,
        productId: receipt.productId,
        transactionId: receipt.transactionId,
        purchaseToken: receipt.purchaseToken,
        receiptData: receipt.receiptData,
        idempotencyKey: createId('iap-recover'),
      });

      if (verify.ok) {
        recovered += 1;
        try {
          await provider.finish(receipt, true);
        } catch {
          // best-effort
        }
      }
    }
  } catch {
    // ignore recovery errors
  }
  return { recovered };
}

export async function refreshCreditPackages() {
  const { fetchCreditPackages } = await import('@/services/commerce');
  return fetchCreditPackages();
}
