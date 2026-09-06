import type { StorePurchaseProvider } from './types';

/** Web and unsupported environments — no store connection. */
export class UnavailableStorePurchaseProvider implements StorePurchaseProvider {
  readonly platform = null;

  async init(): Promise<boolean> {
    return false;
  }

  async end(): Promise<void> {
    // no-op
  }

  async purchase(_productId: string): Promise<null> {
    return null;
  }

  async finish(): Promise<void> {
    // no-op
  }

  async listPendingPurchases() {
    return [];
  }
}
