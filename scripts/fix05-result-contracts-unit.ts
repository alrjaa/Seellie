/**
 * FIX-05 Phase 2 — Result contract matrix (competitions / messages / forums).
 * Run: npx tsx scripts/fix05-result-contracts-unit.ts
 */
import assert from 'node:assert/strict';
import { shouldApplyCloudResult } from '../src/services/cloud-result';

type Comp = { id: string; name: string };
type Msg = { id: string; body: string };
type Comment = { id: string; text: string };

function applyCompetitions(
  local: Comp[],
  res: { ok?: boolean; error?: string; items: Comp[] },
  reconcileEmptyKeepsLocal: (l: Comp[], cloud: Comp[]) => Comp[]
): Comp[] {
  if (!shouldApplyCloudResult(res)) return local;
  return reconcileEmptyKeepsLocal(local, res.items);
}

/** Mirror of reconcileCompetitionsWithCloud empty behavior */
function reconcileComps(local: Comp[], cloud: Comp[]): Comp[] {
  if (!cloud.length) return local;
  const ids = new Set(cloud.map((c) => c.id));
  return [...cloud, ...local.filter((c) => !ids.has(c.id))];
}

function applyMessages(
  local: Msg[],
  res: { ok?: boolean; error?: string; messages: Msg[] }
): Msg[] {
  if (!shouldApplyCloudResult(res)) return local;
  if (!res.messages.length) return local; // SUCCESS_EMPTY keep
  const map = new Map(local.map((m) => [m.id, m]));
  for (const m of res.messages) map.set(m.id, m);
  return Array.from(map.values());
}

function applyForum(
  local: Comment[],
  res: { ok?: boolean; error?: string; comments: Comment[] }
): Comment[] {
  if (!shouldApplyCloudResult(res)) return local;
  if (!res.comments.length) return local;
  const map = new Map(local.map((c) => [c.id, c]));
  for (const c of res.comments) map.set(c.id, c);
  return Array.from(map.values());
}

const cases: Array<{
  name: string;
  res: { ok?: boolean; error?: string };
  apply: boolean;
}> = [
  { name: 'SUCCESS_NON_EMPTY', res: { ok: true }, apply: true },
  { name: 'SUCCESS_EMPTY', res: { ok: true }, apply: true },
  { name: 'NETWORK_ERROR', res: { ok: false, error: 'Failed to fetch' }, apply: false },
  { name: 'TIMEOUT', res: { ok: false, error: 'timeout' }, apply: false },
  { name: 'MALFORMED', res: {}, apply: false },
  { name: '401', res: { ok: false, error: 'JWT expired' }, apply: false },
  { name: '403', res: { ok: false, error: 'permission denied' }, apply: false },
];

async function main() {
  for (const c of cases) {
    assert.equal(
      shouldApplyCloudResult(c.res),
      c.apply,
      `shouldApply ${c.name}`
    );
  }

  const localC: Comp[] = [{ id: 'c1', name: 'Local Cup' }];
  const localM: Msg[] = [{ id: 'm1', body: 'hi' }];
  const localF: Comment[] = [{ id: 'f1', text: 'yo' }];

  // competitions ERROR keep
  assert.deepEqual(
    applyCompetitions(localC, { ok: false, error: 'timeout', items: [] }, reconcileComps),
    localC
  );
  // competitions SUCCESS_EMPTY keep (product policy)
  assert.deepEqual(
    applyCompetitions(localC, { ok: true, items: [] }, reconcileComps),
    localC
  );
  // competitions SUCCESS_NON_EMPTY merge
  const withCloud = applyCompetitions(
    localC,
    { ok: true, items: [{ id: 'c2', name: 'Cloud' }] },
    reconcileComps
  );
  assert.ok(withCloud.some((c) => c.id === 'c2'));

  // messages ERROR keep
  assert.deepEqual(
    applyMessages(localM, { ok: false, error: '401', messages: [] }),
    localM
  );
  assert.deepEqual(
    applyMessages(localM, { ok: true, messages: [] }),
    localM
  );
  assert.ok(
    applyMessages(localM, {
      ok: true,
      messages: [{ id: 'm2', body: 'new' }],
    }).some((m) => m.id === 'm2')
  );

  // forums ERROR keep
  assert.deepEqual(
    applyForum(localF, { ok: false, error: 'Forbidden', comments: [] }),
    localF
  );
  assert.deepEqual(applyForum(localF, { ok: true, comments: [] }), localF);

  console.log('PASS fix05-result-contracts-unit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
