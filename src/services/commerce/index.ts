import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import type {
  CertificateCatalogItem,
  CreditPackage,
  DigitalCertificate,
  ProfileCertificate,
  PurchaseCertificateResult,
  VerifyPurchasePayload,
  VerifyPurchaseResult,
  WalletSummary,
} from './types';
import { assertClientCertificatePayload } from './ledger-math';

function sb() {
  const client = getSupabase();
  if (!client) throw new Error('supabase_unavailable');
  return client;
}

export async function fetchCreditPackages(): Promise<CreditPackage[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await sb().rpc('get_credit_packages');
  if (error) throw error;
  return (data || []) as CreditPackage[];
}

export async function fetchCertificateCatalog(): Promise<CertificateCatalogItem[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await sb().rpc('get_certificate_catalog');
  if (error) throw error;
  return (data || []) as CertificateCatalogItem[];
}

export async function fetchWalletSummary(
  limit = 50
): Promise<WalletSummary> {
  if (!isSupabaseConfigured()) {
    return { balanceCredits: 0, ledger: [] };
  }
  const { data, error } = await sb().rpc('get_wallet_summary', {
    p_limit: limit,
  });
  if (error) throw error;
  const row = data as WalletSummary;
  return {
    balanceCredits: row?.balanceCredits ?? 0,
    ledger: Array.isArray(row?.ledger) ? row.ledger : [],
  };
}

export async function fetchMyCertificates(): Promise<{
  sent: DigitalCertificate[];
  received: DigitalCertificate[];
}> {
  if (!isSupabaseConfigured()) {
    return { sent: [], received: [] };
  }
  const { data, error } = await sb().rpc('get_my_certificates', {
    p_direction: 'all',
  });
  if (error) throw error;
  const row = data as { sent?: DigitalCertificate[]; received?: DigitalCertificate[] };
  return {
    sent: Array.isArray(row?.sent) ? row.sent : [],
    received: Array.isArray(row?.received) ? row.received : [],
  };
}

export async function purchaseCertificateWithCredits(input: {
  catalogSlug: string;
  recipientId: string;
  reason?: string;
  idempotencyKey: string;
  competitionName?: string;
  teamName?: string;
}): Promise<PurchaseCertificateResult> {
  const payloadCheck = assertClientCertificatePayload({ catalogSlug: input.catalogSlug });
  if (!payloadCheck.ok) {
    return { ok: false, error: payloadCheck.reason };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'cloud_unavailable' };
  }
  const { data, error } = await sb().rpc('purchase_certificate_with_credits', {
    p_catalog_slug: input.catalogSlug,
    p_recipient_id: input.recipientId,
    p_reason: input.reason || null,
    p_idempotency_key: input.idempotencyKey,
    p_competition_name: input.competitionName || null,
    p_team_name: input.teamName || null,
  });
  if (error) {
    const msg = error.message || 'purchase_failed';
    if (msg.includes('insufficient_credits')) {
      return { ok: false, error: 'insufficient_credits' };
    }
    return { ok: false, error: msg };
  }
  const row = data as {
    ok?: boolean;
    certificate?: DigitalCertificate;
    duplicate?: boolean;
  };
  return {
    ok: row?.ok === true,
    certificate: row?.certificate,
    duplicate: row?.duplicate === true,
  };
}

export async function verifyStorePurchase(
  payload: VerifyPurchasePayload
): Promise<VerifyPurchaseResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'cloud_unavailable' };
  }
  const { data: sessionData } = await sb().auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: 'not_authenticated' };

  const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) return { ok: false, error: 'supabase_url_missing' };

  const res = await fetch(`${base}/functions/v1/verify-store-purchase`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => ({}))) as VerifyPurchaseResult;
  if (!res.ok) {
    return {
      ok: false,
      error: body.error || `http_${res.status}`,
      message: body.message,
    };
  }
  return body;
}

export async function fetchUserReceivedCertificates(
  userId: string
): Promise<ProfileCertificate[]> {
  if (!isSupabaseConfigured() || !userId) return [];
  const { data, error } = await sb().rpc('get_user_received_certificates', {
    p_user_id: userId,
  });
  if (error) throw error;
  return Array.isArray(data) ? (data as ProfileCertificate[]) : [];
}
