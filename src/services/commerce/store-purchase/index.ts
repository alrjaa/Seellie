import { Platform } from 'react-native';
import type { CreditPackage } from '../types';
import { NativeStorePurchaseProvider } from './native-store-provider';
import { UnavailableStorePurchaseProvider } from './unavailable-store-provider';
import type { StorePurchaseProvider } from './types';

export { productIdForPackage } from './product-ids';

let cachedProvider: StorePurchaseProvider | null = null;

export function getStorePurchaseProvider(): StorePurchaseProvider {
  if (cachedProvider) return cachedProvider;
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    cachedProvider = new NativeStorePurchaseProvider();
  } else {
    cachedProvider = new UnavailableStorePurchaseProvider();
  }
  return cachedProvider;
}

/** Test-only: inject a stub provider without touching production flow. */
export function setStorePurchaseProviderForTests(
  provider: StorePurchaseProvider | null
): void {
  cachedProvider = provider;
}

export type {
  StorePurchaseProvider,
  StorePurchaseReceipt,
  StorePurchaseState,
  VerifyPurchaseFn,
} from './types';
