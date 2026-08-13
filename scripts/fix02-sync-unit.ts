/**
 * FIX-02 sync unit checks (no network / no React Native).
 * Run: npx tsx scripts/fix02-sync-unit.ts
 */
import assert from 'node:assert/strict';
import {
  createGenerationGate,
  createInFlightLock,
  SYNC_FALLBACK_MS,
} from '../src/services/sync-engine-core';
import { mergeUsersPreferCloud } from '../src/services/merge-users';
import type { User } from '../src/data/initial-data';
import type { ShareCard } from '../src/data/initial-data';

function baseUser(partial: Partial<User> & { id: string; email: string }): User {
  return {
    name: 'T',
    handle: 't',
    role: 'follower',
    passwordHash: 'supabase',
    ...partial,
  } as User;
}

function mergeShareCardsById(
  incoming: ShareCard[],
  existing: ShareCard[]
): ShareCard[] {
  const map = new Map<string, ShareCard>();
  for (const c of existing) map.set(c.id, c);
  for (const c of incoming) {
    const prev = map.get(c.id);
    if (!prev) {
      map.set(c.id, c);
      continue;
    }
    const prevTs = prev.timestamp instanceof Date ? prev.timestamp.getTime() : 0;
    const nextTs = c.timestamp instanceof Date ? c.timestamp.getTime() : 0;
    map.set(c.id, nextTs >= prevTs ? { ...prev, ...c } : { ...c, ...prev });
  }
  return Array.from(map.values());
}

async function main() {
  assert.equal(SYNC_FALLBACK_MS.profiles, 60_000);
  assert.equal(SYNC_FALLBACK_MS.forums, 60_000);
  assert.ok(SYNC_FALLBACK_MS.messagesDegraded > 2500);
  assert.ok(SYNC_FALLBACK_MS.privateSpace > 5000);

  const lock = createInFlightLock<number>();
  let runs = 0;
  const p1 = lock.run(async () => {
    runs += 1;
    await new Promise((r) => setTimeout(r, 30));
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

  const gen = createGenerationGate();
  const t1 = gen.next();
  const t2 = gen.next();
  assert.equal(gen.isCurrent(t1), false);
  assert.equal(gen.isCurrent(t2), true);

  const local = [
    baseUser({
      id: 'local-1',
      email: 'a@example.com',
      media: { photos: [{ id: 'p1', url: 'x' } as never], videos: [] },
      posts: [{ id: 'post1' } as never],
    }),
  ];
  const kept = mergeUsersPreferCloud(local, []);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].posts?.length, 1);

  const cloud = [
    baseUser({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'a@example.com',
      media: { photos: [], videos: [] },
      posts: [],
    }),
  ];
  const merged = mergeUsersPreferCloud(local, cloud);
  assert.equal(merged[0].id, cloud[0].id);
  assert.equal(merged[0].posts?.length, 1, 'keep local posts when cloud empty');
  assert.equal(
    (merged[0].media?.photos?.length || 0) > 0,
    true,
    'keep local media when cloud empty'
  );

  const cards: ShareCard[] = [
    {
      id: 'c1',
      kind: 'content',
      status: 'pending',
      senderId: 'a',
      senderName: 'A',
      recipientId: 'b',
      recipientName: 'B',
      recipientKind: 'user',
      timestamp: new Date('2026-01-01'),
      read: false,
    },
  ];
  const newer: ShareCard[] = [
    {
      ...cards[0],
      status: 'accepted',
      timestamp: new Date('2026-01-02'),
      read: true,
    },
  ];
  const m = mergeShareCardsById(newer, cards);
  assert.equal(m[0].status, 'accepted');
  assert.equal(m[0].read, true);

  console.log('PASS fix02-sync-unit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
