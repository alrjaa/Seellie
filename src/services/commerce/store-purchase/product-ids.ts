import type { CreditPackage } from '../types';

export function productIdForPackage(
  pkg: CreditPackage,
  platform: 'ios' | 'android' | null
): string | null {
  if (platform === 'ios') return pkg.apple_product_id || null;
  if (platform === 'android') return pkg.google_product_id || null;
  return null;
}
