/**
 * F12-P2-02 — Gift payment-ready state machine + security (mirrors SQL, no live DB).
 * Run: npx tsx scripts/f12-p2-02-gift-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CATALOG: Record<string, { price: number; kind: string }> = {
  إبداع: { price: 5, kind: 'gift' },
  برونزي: { price: 10, kind: 'gift' },
  فضي: { price: 25, kind: 'gift' },
  ذهبي: { price: 50, kind: 'gift' },
  ماسي: { price: 100, kind: 'gift' },
  'تقدير 200': { price: 200, kind: 'certificate' },
};

const RATE_MAX = 5;
const MAX_LEDGER = 5000;
const MAX_PER_GIFTER = 200;

type GiftRow = Record<string, unknown>;
type AppendResult =
  | { ok: true; idempotent: boolean; gift: GiftRow; count: number }
  | { ok: false; error: string };

/** Mirrors F12-P2-02 append_gift_transaction sanitize. */
function appendGift(opts: {
  callerId: string;
  gift: GiftRow;
  existing: GiftRow[];
  rateCountInWindow: number;
  recipientExists: boolean;
  recipientInactive?: boolean;
  recipientRole?: string;
  nextServerId: string;
  serverNow?: string;
}): AppendResult {
  const { callerId, gift } = opts;
  const existing = opts.existing.slice();

  if (gift.gifterId && gift.gifterId !== callerId) {
    return { ok: false, error: 'gifter must match authenticated user' };
  }

  const clientStatus = String(gift.status || '')
    .trim()
    .toLowerCase();
  if (['paid', 'issued', 'refunded'].includes(clientStatus)) {
    return { ok: false, error: 'forged_status' };
  }
  if (String(gift.certificateStatus || '').trim().toLowerCase() === 'issued') {
    return { ok: false, error: 'forged_certificate_status' };
  }

  const clientKey = String(gift.clientRequestId || gift.id || '').trim();
  if (clientKey) {
    const found = existing.find(
      (e) => e.id === clientKey || e.clientRequestId === clientKey
    );
    if (found) {
      return {
        ok: true,
        idempotent: true,
        gift: found,
        count: existing.length,
      };
    }
  }

  if (opts.rateCountInWindow >= RATE_MAX) {
    return { ok: false, error: 'rate_limited' };
  }
  if (existing.length >= MAX_LEDGER) {
    return { ok: false, error: 'gift_ledger_full' };
  }
  if (existing.filter((e) => e.gifterId === callerId).length >= MAX_PER_GIFTER) {
    return { ok: false, error: 'gifter_quota_exceeded' };
  }

  const cert = String(gift.certificateType || '').trim();
  const cat = DEFAULT_CATALOG[cert];
  if (!cat) return { ok: false, error: 'unknown_certificate_type' };

  if (gift.amountPaid != null && Number(gift.amountPaid) !== cat.price) {
    return { ok: false, error: 'forged_amount' };
  }
  if (gift.amount != null && Number(gift.amount) !== cat.price) {
    return { ok: false, error: 'forged_amount' };
  }

  const recipientId = String(gift.recipientId || '').trim();
  if (!recipientId) return { ok: false, error: 'recipient_required' };
  if (recipientId === callerId) return { ok: false, error: 'cannot_gift_self' };
  if (!opts.recipientExists) return { ok: false, error: 'recipient_not_found' };
  if (opts.recipientInactive) return { ok: false, error: 'recipient_inactive' };

  const role = (opts.recipientRole || 'follower').trim();
  const appreciationKind =
    cat.kind === 'gift' || cat.kind === 'certificate'
      ? cat.kind
      : cat.price >= 200
        ? 'certificate'
        : 'gift';
  const serverNow = opts.serverNow || '2026-01-01T00:00:00.000Z';

  const sanitized: GiftRow = {
    id: opts.nextServerId,
    certificateNumber: '',
    gifterId: callerId,
    recipientId,
    recipientType: role,
    certificateType: cert,
    amountPaid: cat.price,
    timestamp: serverNow,
    createdAt: serverNow,
    status: 'awaiting_payment',
    appreciationKind,
  };
  if (appreciationKind === 'certificate') {
    sanitized.certificateStatus = 'awaiting_payment';
    sanitized.certificateTier =
      Math.floor((cat.price - 200) / 200) + 1;
  }
  if (clientKey) sanitized.clientRequestId = clientKey;

  return {
    ok: true,
    idempotent: false,
    gift: sanitized,
    count: existing.length + 1,
  };
}

function errOf(r: AppendResult): string | undefined {
  return r.ok ? undefined : r.error;
}

function normalizeAppreciationStatus(
  status: string | undefined | null
): string {
  if (status === 'paid') return 'paid';
  if (status === 'issued') return 'issued';
  if (status === 'awaiting_payment') return 'awaiting_payment';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  return 'pending';
}

function isAppreciationPaid(status: string | undefined | null): boolean {
  const n = normalizeAppreciationStatus(status);
  return n === 'paid' || n === 'issued';
}

function invoiceStatusKey(status: string | undefined): string {
  const n = normalizeAppreciationStatus(status);
  if (n === 'paid') return 'paid';
  if (n === 'issued') return 'issued';
  if (n === 'awaiting_payment') return 'awaitingPayment';
  if (n === 'failed') return 'failed';
  if (n === 'cancelled') return 'cancelled';
  if (n === 'refunded') return 'refunded';
  return 'pending';
}

function main() {
  const me = 'user-a';
  const other = 'user-b';

  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: {
          id: 'c1',
          certificateType: 'إبداع',
          amountPaid: 999,
          recipientId: other,
        },
        existing: [],
        rateCountInWindow: 0,
        recipientExists: true,
        nextServerId: 'gift_1',
      })
    ),
    'forged_amount'
  );

  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: {
          id: 'c2',
          certificateType: 'إبداع',
          status: 'paid',
          recipientId: other,
        },
        existing: [],
        rateCountInWindow: 0,
        recipientExists: true,
        nextServerId: 'gift_2',
      })
    ),
    'forged_status'
  );

  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: {
          id: 'c3',
          certificateType: 'تقدير 200',
          certificateStatus: 'issued',
          recipientId: other,
        },
        existing: [],
        rateCountInWindow: 0,
        recipientExists: true,
        nextServerId: 'gift_3',
      })
    ),
    'forged_certificate_status'
  );

  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: {
          id: 'c4',
          gifterId: other,
          certificateType: 'إبداع',
          recipientId: other,
        },
        existing: [],
        rateCountInWindow: 0,
        recipientExists: true,
        nextServerId: 'gift_4',
      })
    ),
    'gifter must match authenticated user'
  );

  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: { id: 'c5', certificateType: 'إبداع', recipientId: me },
        existing: [],
        rateCountInWindow: 0,
        recipientExists: true,
        nextServerId: 'gift_5',
      })
    ),
    'cannot_gift_self'
  );

  const giftOk = appendGift({
    callerId: me,
    gift: {
      id: 'client-id',
      certificateType: 'ذهبي',
      amountPaid: 50,
      recipientId: other,
      certificateNumber: 'SUP-999999',
      timestamp: '1999-01-01T00:00:00.000Z',
      status: 'pending',
    },
    existing: [],
    rateCountInWindow: 0,
    recipientExists: true,
    recipientRole: 'organizer',
    nextServerId: 'gift_server',
    serverNow: '2026-08-17T00:00:00.000Z',
  });
  assert.equal(giftOk.ok, true);
  if (giftOk.ok) {
    assert.equal(giftOk.gift.status, 'awaiting_payment');
    assert.equal(giftOk.gift.id, 'gift_server');
    assert.equal(giftOk.gift.amountPaid, 50);
    assert.equal(giftOk.gift.certificateNumber, '');
    assert.equal(giftOk.gift.timestamp, '2026-08-17T00:00:00.000Z');
    assert.equal(giftOk.gift.appreciationKind, 'gift');
    assert.equal(giftOk.gift.recipientType, 'organizer');
    assert.notEqual(giftOk.gift.certificateNumber, 'SUP-999999');
  }

  const certOk = appendGift({
    callerId: me,
    gift: {
      id: 'cert-1',
      certificateType: 'تقدير 200',
      amountPaid: 200,
      recipientId: other,
    },
    existing: [],
    rateCountInWindow: 0,
    recipientExists: true,
    nextServerId: 'gift_cert',
  });
  assert.equal(certOk.ok, true);
  if (certOk.ok) {
    assert.equal(certOk.gift.appreciationKind, 'certificate');
    assert.equal(certOk.gift.certificateStatus, 'awaiting_payment');
    assert.equal(certOk.gift.certificateTier, 1);
    assert.equal(certOk.gift.status, 'awaiting_payment');
  }

  // Idempotency
  const first = appendGift({
    callerId: me,
    gift: { id: 'idem', certificateType: 'إبداع', recipientId: other },
    existing: [],
    rateCountInWindow: 0,
    recipientExists: true,
    nextServerId: 'gift_idem',
  });
  assert.equal(first.ok, true);
  const again = appendGift({
    callerId: me,
    gift: { id: 'idem', certificateType: 'إبداع', recipientId: other },
    existing: first.ok ? [first.gift] : [],
    rateCountInWindow: 0,
    recipientExists: true,
    nextServerId: 'gift_idem_2',
  });
  assert.equal(again.ok, true);
  if (again.ok) {
    assert.equal(again.idempotent, true);
    assert.equal(again.gift.id, 'gift_idem');
  }

  // Legacy pending_demo display + financials
  assert.equal(normalizeAppreciationStatus('pending_demo'), 'pending');
  assert.equal(isAppreciationPaid('pending_demo'), false);
  assert.equal(isAppreciationPaid('pending'), false);
  assert.equal(isAppreciationPaid('awaiting_payment'), false);
  assert.equal(isAppreciationPaid('paid'), true);
  assert.equal(isAppreciationPaid('issued'), true);
  assert.equal(invoiceStatusKey('pending_demo'), 'pending');
  assert.equal(invoiceStatusKey('awaiting_payment'), 'awaitingPayment');
  assert.equal(invoiceStatusKey('paid'), 'paid');
  assert.notEqual(invoiceStatusKey('awaiting_payment'), 'paid');

  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/F12-P2-02-GIFT-PAYMENT-READY.sql'),
    'utf8'
  );
  assert.match(sql, /awaiting_payment/);
  assert.match(sql, /forged_status/);
  assert.match(sql, /forged_certificate_status/);
  assert.match(sql, /appreciationKind/);
  assert.match(sql, /certificateTier/);
  assert.match(sql, /createdAt/);
  assert.doesNotMatch(sql, /'status',\s*'pending_demo'/);
  assert.match(sql, /certificateNumber',\s*''/);

  const inv = fs.readFileSync(
    path.join(
      process.cwd(),
      'src/screens/superadmin/InvoiceDetailScreen.tsx'
    ),
    'utf8'
  );
  assert.match(inv, /invoiceStatusLabel/);
  assert.doesNotMatch(
    inv,
    /status:\s*t\('superadmin\.invoices\.paid'\)/
  );

  const fin = fs.readFileSync(
    path.join(process.cwd(), 'src/screens/organizer/FinancialsScreen.tsx'),
    'utf8'
  );
  assert.match(fin, /isAppreciationPaid/);

  console.log('F12-P2-02 gift unit: PASS');
}

main();
