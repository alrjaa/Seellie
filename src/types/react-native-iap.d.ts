/** Ambient stub — react-native-iap is optional until native store IAP ships. */
declare module 'react-native-iap' {
  export type Purchase = {
    productId?: string;
    transactionId?: string;
    transactionReceipt?: string;
    purchaseToken?: string;
    [key: string]: unknown;
  };

  export type ProductPurchase = Purchase;
  export type SubscriptionPurchase = Purchase;

  export function initConnection(): Promise<boolean>;
  export function endConnection(): Promise<void>;
  export function getProducts(skus: string[]): Promise<unknown[]>;
  export function getSubscriptions(skus: string[]): Promise<unknown[]>;
  export function requestPurchase(
    sku: string,
    andDangerouslyFinishTransactionAutomaticallyIOS?: boolean
  ): Promise<Purchase>;
  export function finishTransaction(
    purchase: Purchase,
    isConsumable?: boolean
  ): Promise<void>;
  export function acknowledgePurchaseAndroid(opts: {
    token: string;
  }): Promise<void>;
  export function getAvailablePurchases(): Promise<Purchase[]>;
  export function purchaseUpdatedListener(
    listener: (purchase: Purchase) => void
  ): { remove: () => void };
  export function purchaseErrorListener(
    listener: (error: unknown) => void
  ): { remove: () => void };
}
