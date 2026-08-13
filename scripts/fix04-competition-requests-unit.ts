/**
 * FIX-04 P0-1 — competition requests empty vs error (no network).
 * Run: npx tsx scripts/fix04-competition-requests-unit.ts
 */
import assert from 'node:assert/strict';
import type { CompetitionRequest } from '../src/data/initial-data';
import {
  reconcileCompetitionRequestsWithCloud,
  shouldApplyCompetitionRequestsCloud,
} from '../src/services/competition-requests-merge';

function req(
  partial: Partial<CompetitionRequest> & { id: string }
): CompetitionRequest {
  return {
    organizerId: 'org-1',
    name: 'Cup',
    region: 'R',
    city: 'C',
    neighborhood: 'N',
    venueName: 'V',
    termsAcceptedAt: new Date('2026-01-01'),
    diligencePledge: true,
    stadiumPledge: true,
    minTeamsPledge: true,
    firstAidPledge: true,
    orderPledge: true,
    status: 'pending',
    requestedAt: new Date('2026-01-01'),
    ...partial,
  };
}

function applyIfOk(
  local: CompetitionRequest[],
  res: { items: CompetitionRequest[]; ok?: boolean; error?: string }
): CompetitionRequest[] {
  if (!shouldApplyCompetitionRequestsCloud(res)) return local;
  return reconcileCompetitionRequestsWithCloud(local, res.items);
}

async function main() {
  const localCreq = [
    req({ id: 'creq_local_1', name: 'Local pending' }),
    req({ id: 'legacy_seed_1', name: 'Seed' }),
  ];

  // 1. cloud success + data
  const withData = applyIfOk(localCreq, {
    ok: true,
    items: [req({ id: 'creq_cloud_1', name: 'Cloud' })],
  });
  assert.ok(withData.some((r) => r.id === 'creq_cloud_1'));
  assert.ok(
    !withData.some((r) => r.id === 'creq_local_1'),
    'successful cloud catalog drops missing creq_*'
  );
  assert.ok(withData.some((r) => r.id === 'legacy_seed_1'));

  // 2. cloud success + empty — intentional reconcile
  const emptyOk = applyIfOk(localCreq, { ok: true, items: [] });
  assert.ok(
    !emptyOk.some((r) => r.id === 'creq_local_1'),
    'SUCCESS_EMPTY may drop creq_*'
  );
  assert.ok(emptyOk.some((r) => r.id === 'legacy_seed_1'));

  // 3. network failure
  const netFail = applyIfOk(localCreq, {
    ok: false,
    items: [],
    error: 'Failed to fetch',
  });
  assert.equal(netFail, localCreq);
  assert.ok(netFail.some((r) => r.id === 'creq_local_1'));

  // 4. timeout-like
  const timeout = applyIfOk(localCreq, {
    ok: false,
    items: [],
    error: 'timeout',
  });
  assert.ok(timeout.some((r) => r.id === 'creq_local_1'));

  // 5. auth/session failure
  const auth = applyIfOk(localCreq, {
    ok: false,
    items: [],
    error: 'no_session',
  });
  assert.ok(auth.some((r) => r.id === 'creq_local_1'));

  // 6. auth/malformed with ok=false
  const unknownRes = {
    ok: false as const,
    items: [] as CompetitionRequest[],
    error: 'JWT expired',
  };
  assert.equal(shouldApplyCompetitionRequestsCloud(unknownRes), false);
  const unknown = applyIfOk(localCreq, unknownRes);
  assert.ok(unknown.some((r) => r.id === 'creq_local_1'));

  // 6b. error string alone (legacy shape) must not apply
  assert.equal(
    shouldApplyCompetitionRequestsCloud({
      items: [],
      error: 'JWT expired',
    }),
    false
  );

  // 6c. missing ok and missing error — treat as non-success (no wipe)
  assert.equal(
    shouldApplyCompetitionRequestsCloud({ items: [] }),
    false
  );

  // 7. local survives failed cloud request (explicit)
  assert.deepEqual(
    applyIfOk(localCreq, { ok: false, items: [], error: '500' }).map((r) => r.id),
    localCreq.map((r) => r.id)
  );

  // 8. successful empty reconcile intentional
  assert.equal(shouldApplyCompetitionRequestsCloud({ ok: true, items: [] }), true);

  console.log('PASS fix04-competition-requests-unit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
