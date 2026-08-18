/**
 * F14 — catalog users without email must survive merge (no live DB).
 * Run: npx tsx scripts/f14-feed-merge-unit.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeUsersPreferCloud } from '../src/services/merge-users';
import type { User } from '../src/data/initial-data';

function user(partial: Partial<User> & { id: string }): User {
  return {
    name: 'T',
    handle: '@t',
    email: '',
    role: 'follower',
    passwordHash: 'supabase',
    posts: [],
    analysisContent: [],
    ...partial,
  } as User;
}

async function main() {
  const catalog = [
    user({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: '',
      analysisContent: [{ id: 'an-1', title: 'A' } as never],
    }),
    user({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      email: undefined as unknown as string,
      posts: [{ id: 'p1', text: 'hi' } as never],
    }),
  ];
  const merged = mergeUsersPreferCloud([], catalog);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].analysisContent?.length, 1);
  assert.equal(merged[1].posts?.length, 1);

  const privilegedSelf = user({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'self@example.com',
    analysisContent: [],
  });
  const afterOwner = mergeUsersPreferCloud(catalog, [privilegedSelf]);
  const self = afterOwner.find((u) => u.id === privilegedSelf.id);
  assert.ok(self);
  assert.equal(self!.email, 'self@example.com');
  assert.equal(
    self!.analysisContent?.length,
    1,
    'keep catalog analysis when owner row has empty analysis'
  );
  assert.ok(
    afterOwner.some((u) => u.id === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    'peer catalog user without email stays'
  );

  const failedCloud: User[] = [];
  const kept = mergeUsersPreferCloud(catalog, failedCloud);
  assert.equal(kept.length, 2, 'empty cloud must not wipe');

  const src = readFileSync(
    join(__dirname, '../src/services/merge-users.ts'),
    'utf8'
  );
  assert.ok(src.includes('byId'));
  assert.doesNotMatch(src, /if \(!key\) continue/);

  const comps = readFileSync(
    join(__dirname, '../src/services/supabase-competitions.ts'),
    'utf8'
  );
  assert.ok(comps.includes("from('app_competitions_catalog')"));
  assert.doesNotMatch(
    comps,
    /\.from\(\s*['"]app_competitions['"]\s*\)\s*\.select\(\s*['"]\*['"]/
  );

  const highlights = readFileSync(
    join(__dirname, '../src/screens/follower/HighlightsScreen.tsx'),
    'utf8'
  );
  assert.ok(highlights.includes('(comp.teams || [])'));
  assert.ok(highlights.includes('(comp.matches || [])'));
  assert.ok(highlights.includes('windowSize') === false);
  assert.ok(highlights.includes('FullScreenFeed'));

  const feed = readFileSync(
    join(__dirname, '../src/components/media/FullScreenFeed.tsx'),
    'utf8'
  );
  assert.ok(feed.includes('windowSize={3}'));
  assert.ok(feed.includes('unloadAsync'));
  assert.ok(feed.includes('chromeVisible'));

  const privateSrc = readFileSync(
    join(__dirname, '../src/services/private-space.ts'),
    'utf8'
  );
  assert.ok(privateSrc.includes('F13-P1'));
  assert.ok(!/\.from\(\s*['"]private_messages['"]\s*\)\s*\.insert\s*\(/.test(privateSrc));

  console.log('F14 feed merge unit: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
