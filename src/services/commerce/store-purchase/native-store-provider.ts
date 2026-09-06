import { Platform } from 'react-native';
import type { StorePlatform } from '../types';
import type { StorePurchaseProvider, StorePurchaseReceipt } from './types';

let iapModule: typeof import('react-native-iap') | null = null;

async function loadIap() {
  if (Platform.OS === 'web') return null;
  if (iapModule) return iapModule;
  try {
    iapModule = await import('react-native-iap');
    return iapModule;
  } catch {
    return null;
  }
}

function platform(): StorePlatform | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

function toReceipt(
  platformName: StorePlatform,
  tx: {
    productId?: string;
    transactionId?: string;
    transactionReceipt?: string;
    purchaseToken?: string;
  }
): StorePurchaseReceipt | null {
  const productId = tx.productId?.trim();
  if (!productId) return null;
  const transactionId =
    tx.transactionId ||
    tx.transactionReceipt ||
    tx.purchaseToken ||
    '';
  if (!transactionId) return null;
  return {
    platform: platformName,
    productId,
    transactionId,
    purchaseToken: tx.purchaseToken,
    receiptData: tx.transactionReceipt,
  };
}

/**
 * Native store adapter — connects to react-native-iap when available.
 * Does NOT grant credits; verification is always server-side.
 */
export class NativeStorePurchaseProvider implements StorePurchaseProvider {
  readonly platform = platform();

  async init(productIds: string[]): Promise<boolean> {
    const iap = await loadIap();
    if (!iap || !productIds.length || !this.platform) return false;
    try {
      await iap.initConnection();
      return true;
    } catch {
      return false;
    }
  }

  async end(): Promise<void> {
    const iap = await loadIap();
    if (!iap) return;
    try {
      await iap.endConnection();
    } catch {
      // ignore
    }
  }

  async purchase(productId: string): Promise<StorePurchaseReceipt | null> {
    const iap = await loadIap();
    if (!iap || !this.platform) return null;
    const purchase = await iap.requestPurchase({ sku: productId } as never);
    const tx = Array.isArray(purchase) ? purchase[0] : purchase;
    if (!tx) return null;
    return toReceipt(this.platform, tx);
  }

  async finish(
    receipt: StorePurchaseReceipt,
    isConsumable = true
  ): Promise<void> {
    const iap = await loadIap();
    if (!iap || !this.platform) return;
    const tx = {
      productId: receipt.productId,
      transactionId: receipt.transactionId,
      transactionReceipt: receipt.receiptData,
      purchaseToken: receipt.purchaseToken,
    };
    try {
      if (this.platform === 'android' && receipt.purchaseToken) {
        await iap.acknowledgePurchaseAndroid({ token: receipt.purchaseToken });
      }
      await iap.finishTransaction({ purchase: tx as never, isConsumable });
    } catch {
      // best-effort after server verification
    }
  }

  async listPendingPurchases(): Promise<StorePurchaseReceipt[]> {
    const iap = await loadIap();
    if (!iap || !this.platform) return [];
    try {
      const purchases = await iap.getAvailablePurchases();
      return purchases
        .map((tx) => toReceipt(this.platform!, tx))
        .filter((r): r is StorePurchaseReceipt => r !== null);
    } catch {
      return [];
    }
  }
}
