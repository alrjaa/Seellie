/**
 * F12-P2-04 — bootstrap dedupe helpers (no network).
 * Run: npx tsx scripts/f12-p2-04-hydrate-unit.ts
 */
import assert from 'node:assert/strict';
import {
  BOOTSTRAP_DEDUP_MS,
  createInFlightLock,
  createRecentSuccessGate,
  SYNC_FALLBACK_MS,
} from '../src/services/sync-engine-core';

async function main() {
  assert.ok(BOOTSTRAP_DEDUP_MS > 0);
  assert.ok(BOOTSTRAP_DEDUP_MS < SYNC_FALLBACK_MS.profiles);
  assert.ok(BOOTSTRAP_DEDUP_MS < SYNC_FALLBACK_MS.forums);
  assert.equal(SYNC_FALLBACK_MS.profiles, 120_000);

  const gate = createRecentSuccessGate(50);
  assert.equal(gate.shouldSkip(), false);
  gate.markOk();
  assert.equal(gate.shouldSkip(), true);
  assert.equal(gate.shouldSkip(true), false);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(gate.shouldSkip(), false);
  gate.markOk();
  gate.clear();
  assert.equal(gate.shouldSkip(), false);

  const lock = createInFlightLock<number>();
  let runs = 0;
  const p1 = lock.run(async () => {
    runs += 1;
    await new Promise((r) => setTimeout(r, 20));
    return 1;
  });
  const p2 = lock.run(async () => {
    runs += 1;
    return 2;
  });
  const [a, b] = await Promise.all([p1, p2]);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(runs, 1);

  console.log('F12-P2-04 hydrate unit OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
