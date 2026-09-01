/**
 * F09-P1-04 — gift ledger spam & integrity unit (mirrors SQL, no live DB).
 * Run: npx tsx scripts/fix09-p1-04-gift-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CATALOG: Record<string, number> = {
  إبداع: 5,
  برونزي: 10,
  فضي: 25,
  ذهبي: 50,
  ماسي: 100,
};

const RATE_MAX = 5;
const MAX_LEDGER = 5000;
const MAX_PER_GIFTER = 200;

type GiftRow = Record<string, unknown>;

type AppendResult =
  | { ok: true; idempotent: boolean; gift: GiftRow; count: number }
  | { ok: false; error: string };

/** Mirrors FIX-09-P1-04 append_gift_transaction (pre-DB profile checks simplified). */
function appendGift(opts: {
  callerId: string;
  gift: GiftRow;
  existing: GiftRow[];
  rateCountInWindow: number;
  recipientExists: boolean;
  recipientInactive?: boolean;
  nextServerId: string;
}): AppendResult {
  const { callerId, gift } = opts;
  const existing = opts.existing.slice();

  if (gift.gifterId && gift.gifterId !== callerId) {
    return { ok: false, error: 'gifter must match authenticated user' };
  }

  const clientKey = String(
    gift.clientRequestId || gift.id || ''
  ).trim();

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

  const gifterCount = existing.filter((e) => e.gifterId === callerId).length;
  if (gifterCount >= MAX_PER_GIFTER) {
    return { ok: false, error: 'gifter_quota_exceeded' };
  }

  const cert = String(gift.certificateType || '').trim();
  const price = DEFAULT_CATALOG[cert];
  if (price == null) return { ok: false, error: 'unknown_certificate_type' };

  if (gift.amountPaid != null && Number(gift.amountPaid) !== price) {
    return { ok: false, error: 'forged_amount' };
  }

  const recipientId = String(gift.recipientId || '').trim();
  if (!recipientId) return { ok: false, error: 'recipient_required' };
  if (recipientId === callerId) return { ok: false, error: 'cannot_gift_self' };
  if (!opts.recipientExists) return { ok: false, error: 'recipient_not_found' };
  if (opts.recipientInactive) return { ok: false, error: 'recipient_inactive' };

  // Client-forced id ignored for NEW row — server id wins
  const sanitized: GiftRow = {
    id: opts.nextServerId,
    certificateNumber: gift.certificateNumber || 'SUP-000000',
    gifterId: callerId,
    recipientId,
    certificateType: cert,
    amountPaid: price,
    status: 'pending_demo',
  };
  if (clientKey) sanitized.clientRequestId = clientKey;
  // Client cannot escape pending_demo
  assert.equal(sanitized.status, 'pending_demo');

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

function main() {
  const me = 'user-a';
  const other = 'user-b';

  // 1) forged amount
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
        nextServerId: 'gift_server_1',
      })
    ),
    'forged_amount'
  );

  // 2) forged / missing recipient
  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: { id: 'c2', certificateType: 'إبداع', recipientId: other },
        existing: [],
        rateCountInWindow: 0,
        recipientExists: false,
        nextServerId: 'gift_server_2',
      })
    ),
    'recipient_not_found'
  );

  // 3) wrong gifter
  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: {
          id: 'c3',
          gifterId: other,
          certificateType: 'إبداع',
          recipientId: other,
        },
        existing: [],
        rateCountInWindow: 0,
        recipientExists: true,
        nextServerId: 'gift_server_3',
      })
    ),
    'gifter must match authenticated user'
  );

  // 4) unknown catalog
  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: { id: 'c4', certificateType: 'nope', recipientId: other },
        existing: [],
        rateCountInWindow: 0,
        recipientExists: true,
        nextServerId: 'gift_server_4',
      })
    ),
    'unknown_certificate_type'
  );

  // 5) status forced pending_demo + server id (ignore client id)
  const created = appendGift({
    callerId: me,
    gift: {
      id: 'client-wants-this-id',
      certificateType: 'ذهبي',
      amountPaid: 50,
      recipientId: other,
      status: 'paid',
    },
    existing: [],
    rateCountInWindow: 0,
    recipientExists: true,
    nextServerId: 'gift_server_authoritative',
  });
  assert.equal(created.ok, true);
  if (created.ok) {
    assert.equal(created.gift.status, 'pending_demo');
    assert.equal(created.gift.id, 'gift_server_authoritative');
    assert.equal(created.gift.clientRequestId, 'client-wants-this-id');
    assert.equal(created.gift.amountPaid, 50);
    assert.notEqual(created.gift.id, 'client-wants-this-id');
  }

  // 6–7) rapid requests capped; changing client ids does not bypass rate
  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: { id: 'new-id-1', certificateType: 'إبداع', recipientId: other },
        existing: [],
        rateCountInWindow: RATE_MAX,
        recipientExists: true,
        nextServerId: 'gift_x',
      })
    ),
    'rate_limited'
  );
  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: { id: 'new-id-2', certificateType: 'إبداع', recipientId: other },
        existing: [],
        rateCountInWindow: RATE_MAX,
        recipientExists: true,
        nextServerId: 'gift_y',
      })
    ),
    'rate_limited'
  );

  // 8) blob count protection
  const full = Array.from({ length: MAX_LEDGER }, (_, i) => ({
    id: `old-${i}`,
    gifterId: 'someone',
  }));
  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: { id: 'c8', certificateType: 'إبداع', recipientId: other },
        existing: full,
        rateCountInWindow: 0,
        recipientExists: true,
        nextServerId: 'gift_z',
      })
    ),
    'gift_ledger_full'
  );

  const manyMine = Array.from({ length: MAX_PER_GIFTER }, (_, i) => ({
    id: `mine-${i}`,
    gifterId: me,
  }));
  assert.equal(
    errOf(
      appendGift({
        callerId: me,
        gift: { id: 'c8b', certificateType: 'إبداع', recipientId: other },
        existing: manyMine,
        rateCountInWindow: 0,
        recipientExists: true,
        nextServerId: 'gift_q',
      })
    ),
    'gifter_quota_exceeded'
  );

  // 9) legitimate transaction
  const legit = appendGift({
    callerId: me,
    gift: {
      id: 'legit-1',
      certificateType: 'برونزي',
      amountPaid: 10,
      recipientId: other,
    },
    existing: [{ id: 'prior', gifterId: other }],
    rateCountInWindow: 1,
    recipientExists: true,
    nextServerId: 'gift_legit',
  });
  assert.equal(legit.ok, true);
  if (legit.ok) {
    assert.equal(legit.gift.amountPaid, 10);
    assert.equal(legit.count, 2);
  }

  // 10) idempotency — same clientRequestId / id
  const ledger = [
    {
      id: 'gift_server_prior',
      clientRequestId: 'retry-key',
      gifterId: me,
      amountPaid: 5,
      status: 'pending_demo',
    },
  ];
  const again = appendGift({
    callerId: me,
    gift: {
      id: 'retry-key',
      certificateType: 'إبداع',
      amountPaid: 5,
      recipientId: other,
    },
    existing: ledger,
    rateCountInWindow: RATE_MAX, // would fail if not idempotent-first
    recipientExists: true,
    nextServerId: 'should_not_use',
  });
  assert.equal(again.ok, true);
  if (again.ok) {
    assert.equal(again.idempotent, true);
    assert.equal(again.gift.id, 'gift_server_prior');
    assert.equal(again.count, 1);
  }

  // SQL markers
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/FIX-09-P1-04-GIFT-HARDENING.sql'),
    'utf8'
  );
  assert.match(sql, /gift_ledger_full/);
  assert.match(sql, /gifter_quota_exceeded/);
  assert.match(sql, /clientRequestId/);
  assert.match(sql, /gen_random_uuid/);
  assert.match(sql, /pending_demo/);
  assert.match(sql, /forged_amount/);
  assert.match(sql, /rate_max int := 5/);
  assert.match(sql, /max_ledger int := 5000/);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|TRUNCATE)\b/im);

  // Client uses clientRequestId
  const blobs = fs.readFileSync(
    path.join(process.cwd(), 'src/services/supabase-app-blobs.ts'),
    'utf8'
  );
  assert.match(blobs, /clientRequestId|F09-P1-04/);
  const provider = fs.readFileSync(
    path.join(process.cwd(), 'src/providers/TournamentProvider.tsx'),
    'utf8'
  );
  assert.match(provider, /clientRequestId:\s*gift\.id/);

  // FIX-07 / FIX-08 / FIX-09 markers still present
  assert.match(
    fs.readFileSync(
      path.join(process.cwd(), 'scripts/fix07-s2-pull-refresh-unit.ts'),
      'utf8'
    ),
    /refreshCloudPublicCatalog/
  );
  assert.match(
    fs.readFileSync(
      path.join(process.cwd(), 'supabase/FIX-08-HARDENING.sql'),
      'utf8'
    ),
    /forged_amount/
  );
  assert.match(
    fs.readFileSync(
      path.join(process.cwd(), 'supabase/FIX-09-P0-HARDENING.sql'),
      'utf8'
    ),
    /organizer_controls_referee/
  );

  console.log('F09-P1-04 gift unit: PASS');
}

main();
