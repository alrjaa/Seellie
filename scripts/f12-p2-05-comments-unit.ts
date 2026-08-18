/**
 * F12-P2-05 — comments bound + scoped-listener contract (no RN).
 * Run: npx tsx scripts/f12-p2-05-comments-unit.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTENT_ITEM_COMMENTS_MAX,
  mergeContentItemComments,
  trimContentItemComments,
} from '../src/services/content-item-comments-core';

async function main() {
  assert.ok(CONTENT_ITEM_COMMENTS_MAX >= 20);
  assert.ok(CONTENT_ITEM_COMMENTS_MAX <= 100);

  const many = Array.from({ length: CONTENT_ITEM_COMMENTS_MAX + 25 }, (_, i) => ({
    id: `x${i}`,
    text: `t${i}`,
    authorId: 'u',
    authorName: 'U',
    timestamp: 1000 + i,
  }));
  const trimmed = trimContentItemComments(
    [...many].sort((a, b) => b.timestamp - a.timestamp)
  );
  assert.equal(trimmed.length, CONTENT_ITEM_COMMENTS_MAX);
  assert.equal(trimmed[0]?.timestamp, 1000 + CONTENT_ITEM_COMMENTS_MAX + 24);

  const merged = mergeContentItemComments(
    [{ id: 'a', text: 'A', authorId: 'u', authorName: 'U', timestamp: 5 }],
    [{ id: 'b', text: 'B', authorId: 'u', authorName: 'U', timestamp: 3 }]
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.id, 'a');

  const storeSrc = readFileSync(
    join(__dirname, '../src/services/content-item-comments.ts'),
    'utf8'
  );
  assert.ok(storeSrc.includes('listenersById'));
  assert.ok(storeSrc.includes('emit(contentId)'));
  assert.ok(
    storeSrc.includes('subscribeContentItemComments(\n  contentId: string') ||
      storeSrc.includes('contentId: string,\n  cb: () => void')
  );

  const feedSrc = readFileSync(
    join(__dirname, '../src/components/media/FullScreenFeed.tsx'),
    'utf8'
  );
  assert.ok(feedSrc.includes('subscribeContentItemComments(contentId,'));
  assert.ok(feedSrc.includes('playGenRef'));
  assert.ok(feedSrc.includes("preload: 'metadata'"));
  assert.ok(feedSrc.includes('windowSize={3}'));
  assert.ok(feedSrc.includes('removeClippedSubviews={false}'));
  assert.ok(feedSrc.includes('unloadAsync'));
  assert.ok(feedSrc.includes('extraData={`${activeIndex}:${appActive}:${focused}:${data.length}`}'));
  assert.ok(!feedSrc.includes('bottom: 0,\n    zIndex: 4'));

  console.log('F12-P2-05 comments unit: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
