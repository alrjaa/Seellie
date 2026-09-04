export type WalletEntryType =
  | 'CREDIT_PURCHASE'
  | 'CREDIT_GRANT'
  | 'CERTIFICATE_PURCHASE'
  | 'CERTIFICATE_ISSUED'
  | 'REFUND'
  | 'REVERSAL'
  | 'BENEFICIARY_ACCRUAL'
  | 'PLATFORM_FEE';

export type WalletLedgerEntry = {
  id: string;
  entry_type: WalletEntryType;
  amount_credits: number;
  balance_after: number;
  currency: string;
  reference_type: string | null;
  reference_id: string | null;
  counterparty_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WalletSummary = {
  balanceCredits: number;
  ledger: WalletLedgerEntry[];
};

export type CreditPackage = {
  id: string;
  sku: string;
  apple_product_id: string | null;
  google_product_id: string | null;
  credits_amount: number;
  price_display_sar: number | null;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  display_order: number;
  active: boolean;
};

export type CertificateCatalogItem = {
  id: string;
  slug: string;
  credits_price: number;
  tier: number | null;
  kind: 'certificate' | 'gift';
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  image_key: string | null;
  active: boolean;
  display_order: number;
};

export type DigitalCertificate = {
  id: string;
  certificate_number: string;
  verification_code: string;
  catalog_id: string;
  sender_id: string;
  recipient_id: string;
  credits_cost: number;
  status: 'issued' | 'void' | 'refunded';
  reason: string | null;
  competition_name: string | null;
  team_name: string | null;
  platform_fee_credits: number;
  beneficiary_accrual_credits: number;
  catalog_slug?: string;
  name_en?: string;
  name_ar?: string;
  image_key?: string | null;
  kind?: string;
  issued_at: string;
};

export type StorePlatform = 'ios' | 'android';

export type VerifyPurchasePayload = {
  platform: StorePlatform;
  productId: string;
  transactionId: string;
  purchaseToken?: string;
  receiptData?: string;
  idempotencyKey: string;
};

export type VerifyPurchaseResult = {
  ok: boolean;
  balanceAfter?: number;
  creditsGranted?: number;
  duplicate?: boolean;
  error?: string;
  message?: string;
};

export type PurchaseCertificateResult = {
  ok: boolean;
  certificate?: DigitalCertificate;
  duplicate?: boolean;
  error?: string;
};

export type AdminCommerceUserSummary = {
  user_id: string;
  name: string;
  handle?: string | null;
  visible_id?: string | null;
  balance_credits: number;
  total_purchased: number;
  total_spent: number;
  certificates_sent: number;
  certificates_received: number;
};

export type AdminCommerceUserDetail = {
  profile: AdminCommerceUserSummary;
  ledger: WalletLedgerEntry[];
  purchases: Array<{
    id: string;
    platform: string;
    product_id: string;
    store_transaction_id: string;
    credits_amount: number;
    status: string;
    verified_at?: string | null;
    created_at: string;
  }>;
  sentCertificates: Array<{
    id: string;
    certificate_number: string;
    credits_cost: number;
    status: string;
    issued_at: string;
    reason?: string | null;
    name_ar?: string | null;
    name_en?: string | null;
    catalog_slug?: string | null;
    recipient_name?: string | null;
    recipient_handle?: string | null;
  }>;
  receivedCertificates: Array<{
    id: string;
    certificate_number: string;
    credits_cost: number;
    status: string;
    issued_at: string;
    reason?: string | null;
    name_ar?: string | null;
    name_en?: string | null;
    catalog_slug?: string | null;
    sender_name?: string | null;
    sender_handle?: string | null;
  }>;
};

/** Appreciation received from followers — admin roster row */
export type AdminAppreciationReceipt = {
  id: string;
  certificate_number?: string | null;
  status?: string | null;
  issued_at?: string | null;
  credits_cost?: number | null;
  reason?: string | null;
  appreciation_type: string;
  appreciation_type_ar?: string | null;
  appreciation_type_en?: string | null;
  catalog_slug?: string | null;
  recipient_id: string;
  recipient_name: string;
  recipient_email: string;
  recipient_handle?: string | null;
  recipient_visible_id?: string | null;
  recipient_role?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  sender_handle?: string | null;
  sender_visible_id?: string | null;
  sender_role?: string | null;
  /** local gift blob vs cloud digital certificate */
  source?: 'gift' | 'digital';
};

export type ProfileCertificate = Pick<
  DigitalCertificate,
  | 'id'
  | 'certificate_number'
  | 'verification_code'
  | 'credits_cost'
  | 'status'
  | 'reason'
  | 'competition_name'
  | 'team_name'
  | 'issued_at'
  | 'catalog_slug'
  | 'name_en'
  | 'name_ar'
  | 'image_key'
  | 'kind'
> & {
  sender_name?: string;
  sender_handle?: string;
};
