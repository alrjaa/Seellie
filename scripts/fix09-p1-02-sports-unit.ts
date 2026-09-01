/**
 * F09-P1-02 — sports sync privilege tightening.
 *
 * STATUS: BLOCKED (no Edge/client authz change this round).
 *
 * Why blocked (per task constraints):
 * 1) Raising sync_league / sync_topscorers / forceSync to superadmin-only would
 *    break getNationalLeagueBundle empty-store fallback for ordinary logged-in
 *    users (functional behavior change — forbidden without explicit approval).
 * 2) Durable/shared rate limiting across Edge isolates needs SQL/migration —
 *    forbidden in this phase (SQL = NOT RUN).
 * 3) In-memory-only tighter limits do not fix cross-isolate quota burn and may
 *    throttle legitimate admin sync without solving the threat model.
 *
 * Safe residual posture (already from FIX-08 + F09-P1-01):
 * - anonymous sync_* → unauthorized
 * - sync_all → superadmin only
 * - public bundle !forceSync → no upstream syncLeague
 *
 * Run: npx tsx scripts/fix09-p1-02-sports-unit.ts
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

/** Current FIX-08 + P1-01 authorize mirror (unchanged by blocked P1-02). */
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
  if (
    (resource === 'bundle' || resource === 'topscorers') &&
    opts.forceSync
  ) {
    if (!opts.hasUser) return { ok: false, error: 'unauthorized' };
    return { ok: true };
  }
  if (publicRead.has(resource)) return { ok: true };
  return { ok: false, error: 'unknown_resource' };
}

/**
 * Desired P1-02 gate (NOT applied). Documented for future staged work after
 * product approval of empty-store behavior for non-admins.
 */
function desiredP102Authorize(
  resource: SportsResource,
  opts: { hasUser: boolean; isAdmin: boolean; forceSync?: boolean }
): { ok: boolean; error?: string } {
  if (resource === 'sync_all') {
    if (!opts.hasUser || !opts.isAdmin) return { ok: false, error: 'forbidden' };
    return { ok: true };
  }
  if (
    resource === 'sync_league' ||
    resource === 'sync_topscorers' ||
    ((resource === 'bundle' || resource === 'topscorers') && opts.forceSync)
  ) {
    if (!opts.hasUser) return { ok: false, error: 'unauthorized' };
    if (!opts.isAdmin) return { ok: false, error: 'forbidden' };
    return { ok: true };
  }
  return authorizeSportsProxy(resource, opts);
}

function main() {
  // --- Preserved gates (must stay true) ---
  assert.equal(
    authorizeSportsProxy('sync_league', { hasUser: false, isAdmin: false })
      .error,
    'unauthorized'
  );
  assert.equal(
    authorizeSportsProxy('sync_topscorers', {
      hasUser: false,
      isAdmin: false,
    }).error,
    'unauthorized'
  );
  assert.equal(
    authorizeSportsProxy('sync_all', { hasUser: true, isAdmin: false }).error,
    'forbidden'
  );
  assert.equal(
    authorizeSportsProxy('sync_all', { hasUser: true, isAdmin: true }).ok,
    true
  );

  // Residual risk documented: ordinary authenticated still allowed today
  assert.equal(
    authorizeSportsProxy('sync_league', { hasUser: true, isAdmin: false }).ok,
    true
  );

  // Desired future (not deployed): ordinary user forbidden
  assert.equal(
    desiredP102Authorize('sync_league', { hasUser: true, isAdmin: false })
      .error,
    'forbidden'
  );
  assert.equal(
    desiredP102Authorize('sync_league', { hasUser: true, isAdmin: true }).ok,
    true
  );
  assert.equal(
    desiredP102Authorize('bundle', {
      hasUser: true,
      isAdmin: false,
      forceSync: true,
    }).error,
    'forbidden'
  );

  const sports = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/sports-proxy/index.ts'),
    'utf8'
  );
  // P1-01 must remain: no public void syncLeague
  assert.doesNotMatch(sports, /void\s+syncLeague\s*\(/);
  assert.match(sports, /F09-P1-01/);
  // sync_all still superadmin
  assert.match(sports, /requireSuperadmin/);
  // Current sync_league still requireAuth (not yet requireSuperadmin) — residual
  const syncLeagueGate = sports.match(
    /resource === 'sync_league'[\s\S]{0,280}/
  );
  assert.ok(syncLeagueGate);
  assert.match(syncLeagueGate![0], /requireAuth/);
  assert.doesNotMatch(
    syncLeagueGate![0],
    /requireSuperadmin/
  );

  // Client empty-store still calls sync_league (behavior dependency → blocker)
  const client = fs.readFileSync(
    path.join(
      process.cwd(),
      'src/services/sports-data/api-football-edge-provider.ts'
    ),
    'utf8'
  );
  assert.match(client, /invokeSports<SportsLeagueBundle>\('sync_league'/);

  // No durable rate-limit SQL introduced in this blocked phase
  assert.doesNotMatch(sports, /check_rate_limit\(|security_events/);

  console.log(
    'F09-P1-02 sports unit: PASS (documentation) — IMPLEMENTATION BLOCKED'
  );
  console.log(
    'Blocker: admin-only sync would break ordinary-user empty-store sync_league fallback; durable RL needs SQL.'
  );
}

main();
