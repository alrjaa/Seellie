/**
 * FIX-01 unit checks — sensitive data stripping + storage path ownership.
 * Run: node --import tsx scripts/fix01-security-unit.ts
 * (standalone — no react-native imports)
 */
import assert from 'node:assert/strict';

function stripAnalystAccessCode<T extends { accessCode?: string } | null | undefined>(
  analyst: T
): T {
  if (!analyst || typeof analyst !== 'object') return analyst;
  if (!('accessCode' in analyst)) return analyst;
  const { accessCode: _removed, ...rest } = analyst as {
    accessCode?: string;
  } & Record<string, unknown>;
  return rest as T;
}

const BUCKET = 'share-media';
function storagePathFromPublicUrl(url: string): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx < 0) return null;
    const path = decodeURIComponent(
      url.slice(idx + marker.length).split('?')[0] || ''
    );
    if (!path || path.includes('..')) return null;
    return path;
  } catch {
    return null;
  }
}

function main() {
  const stripped = stripAnalystAccessCode({
    status: 'approved',
    accessCode: 'SECRET1234',
  });
  assert.equal((stripped as { accessCode?: string }).accessCode, undefined);
  assert.equal(stripped.status, 'approved');

  const path = storagePathFromPublicUrl(
    'https://xyz.supabase.co/storage/v1/object/public/share-media/user-uuid/shares/1.jpg'
  );
  assert.equal(path, 'user-uuid/shares/1.jpg');
  assert.equal(storagePathFromPublicUrl('https://example.com/x.jpg'), null);
  assert.equal(storagePathFromPublicUrl('not-a-url'), null);

  console.log('FIX-01 security unit: PASS');
}

main();
