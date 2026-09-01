/**
 * F09-P1-01 — public/anonymous sports bundle must not trigger upstream sync.
 * Run: npx tsx scripts/fix09-p1-01-sports-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type SportsResource =
  | 'health'
  | 'window'
  | 'topscorers'
  | 'bundle'
  | 'sync_league'
  | 'sync_topscorers'
  | 'sync_all';

/** Mirrors FIX-08 F08-S05 authorization (unchanged by F09-P1-01). */
function authorizeSportsProxy(
  resource: SportsResource,
  opts: { hasUser: boolean; isAdmin: boolean; forceSync?: boolean }
): { ok: boolean; error?: string } {
  const publicRead = new Set<SportsResource>([
    'health',
    'window',
    'topscorers',
    'bundle',
  ]);
  if (resource === 'sync_all') {
    if (!opts.hasUser || !opts.isAdmin) return { ok: false, error: 'forbidden' };
    return { ok: true };
  }
  if (resource === 'sync_league' || resource === 'sync_topscorers') {
    if (!opts.hasUser) return { ok: false, error: 'unauthorized' };
    return { ok: true };
  }
  if (resource === 'bundle' && opts.forceSync) {
    if (!opts.hasUser) return { ok: false, error: 'unauthorized' };
    return { ok: true };
  }
  if (resource === 'topscorers' && opts.forceSync) {
    if (!opts.hasUser) return { ok: false, error: 'unauthorized' };
    return { ok: true };
  }
  if (publicRead.has(resource)) return { ok: true };
  return { ok: false, error: 'unknown_resource' };
}

/**
 * F09-P1-01: whether the Edge `bundle` handler may call syncLeague / upstream.
 * Public/anonymous and any !forceSync path → never.
 * forceSync → only after auth (gated separately).
 */
function bundleMayCallSyncLeague(opts: {
  forceSync: boolean;
  hasUser: boolean;
}): boolean {
  if (!opts.forceSync) return false;
  return opts.hasUser;
}

function main() {
  // 1–2) Public / !forceSync must not start upstream sync
  assert.equal(
    bundleMayCallSyncLeague({ forceSync: false, hasUser: false }),
    false
  );
  assert.equal(
    bundleMayCallSyncLeague({ forceSync: false, hasUser: true }),
    false
  );

  // Authenticated explicit forceSync may sync (behavior preserved)
  assert.equal(
    bundleMayCallSyncLeague({ forceSync: true, hasUser: true }),
    true
  );
  assert.equal(
    bundleMayCallSyncLeague({ forceSync: true, hasUser: false }),
    false
  );

  // 3) Anonymous sync_* rejected (FIX-08 unchanged)
  assert.equal(
    authorizeSportsProxy('sync_league', { hasUser: false, isAdmin: false })
      .error,
    'unauthorized'
  );
  assert.equal(
    authorizeSportsProxy('sync_topscorers', { hasUser: false, isAdmin: false })
      .error,
    'unauthorized'
  );

  // 4) sync_all superadmin-only
  assert.equal(
    authorizeSportsProxy('sync_all', { hasUser: true, isAdmin: false }).error,
    'forbidden'
  );
  assert.equal(
    authorizeSportsProxy('sync_all', { hasUser: true, isAdmin: true }).ok,
    true
  );

  // 5) Authenticated explicit sync still allowed
  assert.equal(
    authorizeSportsProxy('sync_league', { hasUser: true, isAdmin: false }).ok,
    true
  );
  assert.equal(
    authorizeSportsProxy('bundle', {
      hasUser: false,
      isAdmin: false,
      forceSync: true,
    }).error,
    'unauthorized'
  );
  assert.equal(
    authorizeSportsProxy('bundle', { hasUser: false, isAdmin: false }).ok,
    true
  );

  const sports = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/sports-proxy/index.ts'),
    'utf8'
  );

  // Exact public sync side-effects removed
  assert.doesNotMatch(sports, /void\s+syncLeague\s*\(/);
  assert.match(sports, /F09-P1-01/);
  assert.match(
    sports,
    /Never start upstream syncLeague|durable\/cache ONLY|do not burn API-Football quota/i
  );

  // !forceSync branch returns store / store_unavailable before any syncLeague
  const bundleIdx = sports.indexOf("if (resource === 'bundle')");
  assert.ok(bundleIdx >= 0);
  const bundleBlock = sports.slice(bundleIdx, bundleIdx + 2200);
  const forceSyncBranch = bundleBlock.indexOf('// Authenticated forceSync');
  assert.ok(forceSyncBranch > 0, 'forceSync branch marker missing');
  const readOnlyPart = bundleBlock.slice(0, forceSyncBranch);
  assert.doesNotMatch(readOnlyPart, /syncLeague\s*\(/);
  assert.match(readOnlyPart, /store_unavailable/);
  assert.match(bundleBlock.slice(forceSyncBranch), /syncLeague\s*\(/);

  // Client still routes sync_* via session (no anon sync)
  const client = fs.readFileSync(
    path.join(
      process.cwd(),
      'src/services/sports-data/api-football-edge-provider.ts'
    ),
    'utf8'
  );
  assert.match(client, /invokeSportsAuthed/);
  assert.match(client, /SYNC_RESOURCES/);
  assert.match(client, /F09-P1-01/);

  console.log('F09-P1-01 sports unit: PASS');
}

main();
