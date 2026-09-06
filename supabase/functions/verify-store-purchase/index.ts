/**
 * verify-store-purchase — Server-side Apple/Google purchase verification → Credits grant
 *
 * POST { platform: 'ios'|'android', productId, transactionId, purchaseToken?, receiptData? }
 * Authorization: Bearer <user JWT>
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const ALLOWED_ORIGINS = new Set([
  'https://www.seellie.com',
  'https://seellie.com',
  'https://ads.seellie.com',
  'https://admin.seellie.com',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
]);

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

let requestCors: Record<string, string> = {};

type Platform = 'ios' | 'android';

type VerifyBody = {
  platform?: Platform;
  productId?: string;
  transactionId?: string;
  purchaseToken?: string;
  receiptData?: string;
  idempotencyKey?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...requestCors, 'Content-Type': 'application/json' },
  });
}

async function verifyAppleReceipt(
  receiptData: string,
  sharedSecret: string
): Promise<{ ok: boolean; transactionId?: string; error?: string }> {
  const endpoints = [
    'https://buy.itunes.apple.com/verifyReceipt',
    'https://sandbox.itunes.apple.com/verifyReceipt',
  ];
  for (const url of endpoints) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        password: sharedSecret,
        'exclude-old-transactions': true,
      }),
    });
    if (!res.ok) continue;
    const body = await res.json();
    if (body.status === 0) {
      const inApp = body.receipt?.in_app || body.latest_receipt_info || [];
      const latest = Array.isArray(inApp) ? inApp[inApp.length - 1] : null;
      const txId =
        latest?.transaction_id ||
        latest?.original_transaction_id ||
        body.receipt?.transaction_id;
      return { ok: true, transactionId: txId };
    }
    if (body.status === 21007 && url.includes('buy.itunes')) {
      continue;
    }
    return { ok: false, error: `apple_status_${body.status}` };
  }
  return { ok: false, error: 'apple_verify_failed' };
}

async function getGoogleAccessToken(
  serviceAccountJson: string
): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
    token_uri: string;
  };
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claim = btoa(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const jwt = `${unsigned}.${signature}`;
  const tokenRes = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) throw new Error('google_token_failed');
  const tokenBody = await tokenRes.json();
  return tokenBody.access_token as string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function verifyGooglePurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
  serviceAccountJson: string
): Promise<{ ok: boolean; transactionId?: string; error?: string }> {
  const accessToken = await getGoogleAccessToken(serviceAccountJson);
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    return { ok: false, error: `google_http_${res.status}` };
  }
  const body = await res.json();
  const purchaseState = Number(body.purchaseState);
  if (purchaseState !== 0) {
    return { ok: false, error: `google_state_${purchaseState}` };
  }
  return {
    ok: true,
    transactionId: body.orderId || purchaseToken,
  };
}

serve(async (req) => {
  requestCors = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: requestCors });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ ok: false, error: 'server_misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let body: VerifyBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const platform = body.platform;
  const productId = (body.productId || '').trim();
  const transactionId = (body.transactionId || '').trim();
  const purchaseToken = (body.purchaseToken || '').trim();
  const receiptData = (body.receiptData || '').trim();
  const idempotencyKey = (body.idempotencyKey || '').trim() || null;

  if (!platform || !productId || !transactionId) {
    return json({ ok: false, error: 'missing_fields' }, 400);
  }
  if (platform !== 'ios' && platform !== 'android') {
    return json({ ok: false, error: 'invalid_platform' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: packages, error: pkgError } = await admin
    .from('credit_packages')
    .select('*')
    .eq('active', true);

  if (pkgError) {
    return json({ ok: false, error: 'catalog_unavailable' }, 500);
  }

  const pkg = (packages || []).find(
    (p: { apple_product_id?: string; google_product_id?: string; sku: string }) =>
      (platform === 'ios' && p.apple_product_id === productId) ||
      (platform === 'android' && p.google_product_id === productId) ||
      p.sku === productId
  );
  if (!pkg) {
    return json({ ok: false, error: 'unknown_product' }, 400);
  }

  if (platform === 'ios') {
    const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');
    if (!sharedSecret) {
      return json(
        {
          ok: false,
          error: 'apple_not_configured',
          message: 'APPLE_SHARED_SECRET required in Supabase secrets',
        },
        503
      );
    }
    if (!receiptData) {
      return json({ ok: false, error: 'receipt_required' }, 400);
    }
    const apple = await verifyAppleReceipt(receiptData, sharedSecret);
    if (!apple.ok) {
      await admin.from('store_purchases').upsert(
        {
          user_id: user.id,
          platform: 'ios',
          product_id: productId,
          store_transaction_id: transactionId,
          credits_amount: pkg.credits_amount,
          package_id: pkg.id,
          status: 'failed',
          failed_reason: apple.error,
          idempotency_key: idempotencyKey,
        },
        { onConflict: 'platform,store_transaction_id', ignoreDuplicates: false }
      );
      return json({ ok: false, error: apple.error }, 402);
    }
  } else {
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const packageName =
      Deno.env.get('GOOGLE_PACKAGE_NAME') || 'com.seellie.app';
    if (!saJson) {
      return json(
        {
          ok: false,
          error: 'google_not_configured',
          message: 'GOOGLE_SERVICE_ACCOUNT_JSON required in Supabase secrets',
        },
        503
      );
    }
    if (!purchaseToken) {
      return json({ ok: false, error: 'purchase_token_required' }, 400);
    }
    const google = await verifyGooglePurchase(
      packageName,
      productId,
      purchaseToken,
      saJson
    );
    if (!google.ok) {
      return json({ ok: false, error: google.error }, 402);
    }
  }

  const { data: grant, error: grantError } = await admin.rpc(
    'grant_credits_from_store_purchase',
    {
      p_user_id: user.id,
      p_platform: platform,
      p_product_id: productId,
      p_store_transaction_id: transactionId,
      p_purchase_token: purchaseToken || null,
      p_credits_amount: pkg.credits_amount,
      p_currency: 'SAR',
      p_price_amount: pkg.price_display_sar,
      p_package_id: pkg.id,
      p_idempotency_key: idempotencyKey,
      p_metadata: { verifiedBy: 'verify-store-purchase' },
    }
  );

  if (grantError) {
    if (grantError.message?.includes('duplicate') || grantError.code === '23505') {
      const { data: summary } = await userClient.rpc('get_wallet_summary', {
        p_limit: 1,
      });
      return json({
        ok: true,
        duplicate: true,
        balanceCredits: summary?.balanceCredits ?? 0,
      });
    }
    return json({ ok: false, error: grantError.message }, 500);
  }

  await admin.rpc('log_commerce_event', {
    p_event_type: 'credit_purchase_verified',
    p_actor_id: user.id,
    p_subject_type: 'store_purchase',
    p_subject_id: grant?.purchaseId || null,
    p_metadata: { productId, platform },
  });

  return json({
    ok: true,
    purchaseId: grant?.purchaseId,
    balanceAfter: grant?.balanceAfter,
    creditsGranted: pkg.credits_amount,
    duplicate: grant?.duplicate === true,
  });
});
