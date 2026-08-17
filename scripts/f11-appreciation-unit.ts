/**
 * F11 appreciation catalog + payment-ready status helpers (no payment provider).
 * Self-contained — does not import RN/Expo modules.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const CERTIFICATE_BASE_PRICE = 200;
const CERTIFICATE_PRICE_STEP = 200;

function buildCertificateAppreciationLevels(count = 6) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => {
    const tier = i + 1;
    const price = CERTIFICATE_BASE_PRICE + i * CERTIFICATE_PRICE_STEP;
    return { tier, price, id: `cert-tier-${tier}` };
  });
}

function resolveAppreciationKind(level: {
  kind?: string;
  price: number;
}): 'gift' | 'certificate' {
  if (level.kind === 'gift' || level.kind === 'certificate') return level.kind;
  return level.price >= CERTIFICATE_BASE_PRICE ? 'certificate' : 'gift';
}

function normalizeAppreciationStatus(
  status: string | undefined | null
): 'pending' | 'awaiting_payment' | 'paid' | 'issued' | 'failed' | 'cancelled' | 'refunded' {
  if (status === 'paid') return 'paid';
  if (status === 'issued') return 'issued';
  if (status === 'awaiting_payment') return 'awaiting_payment';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  return 'pending';
}

function main() {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/utils/appreciation.ts'),
    'utf8'
  );
  assert.match(src, /CERTIFICATE_BASE_PRICE = 200/);
  assert.match(src, /CERTIFICATE_PRICE_STEP = 200/);
  assert.match(src, /createLocalPurchaseIntentStatus/);
  assert.match(src, /pending_demo/);
  assert.match(src, /awaiting_payment/);
  assert.match(src, /SERVER_INTENT_STATUS/);
  assert.match(src, /FUTURE SERVER-SIDE|after paid|awaiting_payment/);
  assert.doesNotMatch(src, /stripe|moyasar|hyperpay/i);

  const tiers = buildCertificateAppreciationLevels(6);
  assert.equal(tiers.length, 6);
  assert.equal(tiers[0].price, 200);
  assert.equal(tiers[1].price, 400);
  assert.equal(tiers[5].price, 1200);

  assert.equal(resolveAppreciationKind({ price: 5, kind: 'gift' }), 'gift');
  assert.equal(
    resolveAppreciationKind({ price: 200, kind: 'certificate' }),
    'certificate'
  );
  assert.equal(resolveAppreciationKind({ price: 200 }), 'certificate');
  assert.equal(resolveAppreciationKind({ price: 100 }), 'gift');

  assert.equal(normalizeAppreciationStatus('pending_demo'), 'pending');
  assert.equal(normalizeAppreciationStatus('pending'), 'pending');
  assert.equal(normalizeAppreciationStatus('awaiting_payment'), 'awaiting_payment');
  assert.equal(normalizeAppreciationStatus('paid'), 'paid');
  assert.equal(normalizeAppreciationStatus('issued'), 'issued');

  const blobs = fs.readFileSync(
    path.join(process.cwd(), 'src/services/supabase-app-blobs.ts'),
    'utf8'
  );
  assert.match(blobs, /appreciationEnabled/);
  assert.match(blobs, /commentComposerEnabled/);
  assert.match(blobs, /postComposerEnabled/);
  assert.match(blobs, /arenaComposerEnabled/);
  assert.match(blobs, /resolveAppFeatureFlags/);

  const provider = fs.readFileSync(
    path.join(process.cwd(), 'src/providers/TournamentProvider.tsx'),
    'utf8'
  );
  assert.match(provider, /updateAppFeatureFlags/);
  assert.match(provider, /createLocalPurchaseIntentStatus/);
  assert.match(provider, /status: processStatus/);
  assert.doesNotMatch(
    provider,
    /status:\s*'pending_demo'/
  );

  console.log('F11 appreciation unit OK');
}

main();
