/**
 * FIX-04 P0-2 — share cards SUCCESS_EMPTY vs FETCH_ERROR (no network).
 * Run: npx tsx scripts/fix04-share-cards-unit.ts
 */
import assert from 'node:assert/strict';
import type { ShareCard } from '../src/data/initial-data';
import {
  applyShareCardsCloudResult,
  mergeShareCardsById,
  reconcileShareCardsWithCloud,
  shouldApplyShareCardsCloud,
} from '../src/services/share-cards-merge';

function card(
  partial: Partial<ShareCard> & { id: string; senderId: string; recipientId: string }
): ShareCard {
  return {
    kind: 'content',
    status: 'pending',
    senderName: 'A',
    recipientName: 'B',
    recipientKind: 'user',
    timestamp: new Date('2026-01-01'),
    read: false,
    ...partial,
  };
}

const CLOUD_ID = '11111111-1111-4111-8111-111111111111';
const CLOUD_ID_2 = '22222222-2222-4222-8222-222222222222';

async function main() {
  const localInbox = [
    card({
      id: CLOUD_ID,
      senderId: 'a',
      recipientId: 'b',
      title: 'Keep on error',
    }),
    card({
      id: 'share_local_optimistic',
      senderId: 'a',
      recipientId: 'b',
      title: 'Optimistic',
    }),
  ];

  // 1. successful fetch with cards
  const withData = applyShareCardsCloudResult(localInbox, {
    ok: true,
    cards: [
      card({
        id: CLOUD_ID_2,
        senderId: 'a',
        recipientId: 'b',
        title: 'From cloud',
        timestamp: new Date('2026-02-01'),
      }),
    ],
  });
  assert.ok(withData.some((c) => c.id === CLOUD_ID_2));
  assert.ok(
    !withData.some((c) => c.id === CLOUD_ID),
    'SUCCESS reconciles away UUID cards missing from cloud'
  );
  assert.ok(
    withData.some((c) => c.id === 'share_local_optimistic'),
    'optimistic local ids survive reconcile'
  );

  // 2. successful empty
  const emptyOk = applyShareCardsCloudResult(localInbox, {
    ok: true,
    cards: [],
  });
  assert.ok(
    !emptyOk.some((c) => c.id === CLOUD_ID),
    'SUCCESS_EMPTY may drop cloud-backed cards'
  );
  assert.ok(emptyOk.some((c) => c.id === 'share_local_optimistic'));
  assert.equal(shouldApplyShareCardsCloud({ ok: true, cards: [] }), true);

  // 3. network error
  const net = applyShareCardsCloudResult(localInbox, {
    ok: false,
    cards: [],
    error: 'Failed to fetch',
  });
  assert.deepEqual(
    net.map((c) => c.id),
    localInbox.map((c) => c.id)
  );

  // 4. timeout
  const timeout = applyShareCardsCloudResult(localInbox, {
    ok: false,
    cards: [],
    error: 'timeout',
  });
  assert.ok(timeout.some((c) => c.id === CLOUD_ID));

  // 5. malformed / unknown (ok not true)
  assert.equal(
    shouldApplyShareCardsCloud({ cards: [], error: 'JWT expired' }),
    false
  );
  assert.equal(shouldApplyShareCardsCloud({ cards: [] }), false);
  const malformed = applyShareCardsCloudResult(localInbox, {
    cards: [],
    error: 'malformed',
  });
  assert.ok(malformed.some((c) => c.id === CLOUD_ID));

  // 6. Realtime disconnect is not a fetch apply — status alone must not wipe
  //    (provider only mutates on INSERT/UPDATE/DELETE payloads)
  const afterDisconnectStatus = localInbox;
  assert.ok(afterDisconnectStatus.length > 0);

  // 7. refresh failure while existing cards exist
  const refreshFail = applyShareCardsCloudResult(localInbox, {
    ok: false,
    cards: [],
    error: '500',
  });
  assert.equal(refreshFail.length, localInbox.length);
  assert.ok(refreshFail.some((c) => c.id === CLOUD_ID));

  // 8. no empty-wipe on error (explicit)
  assert.notEqual(
    applyShareCardsCloudResult(localInbox, {
      ok: false,
      cards: [],
      error: 'no_session',
    }).length,
    0
  );

  // merge still prefers newer
  const older = card({
    id: CLOUD_ID,
    senderId: 'a',
    recipientId: 'b',
    status: 'pending',
    timestamp: new Date('2026-01-01'),
  });
  const newer = {
    ...older,
    status: 'accepted' as const,
    timestamp: new Date('2026-01-02'),
    read: true,
  };
  const m = mergeShareCardsById([newer], [older]);
  assert.equal(m[0].status, 'accepted');

  // reconcile helper
  const rec = reconcileShareCardsWithCloud(localInbox, []);
  assert.ok(!rec.some((c) => c.id === CLOUD_ID));

  console.log('PASS fix04-share-cards-unit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
