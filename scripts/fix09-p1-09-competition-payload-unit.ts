/**
 * F09-P1-09 — competition payload integrity.
 *
 * STATUS: BLOCKED (server-side enforcement requires SQL/RLS/RPC — forbidden here).
 *
 * Evidence:
 * - Organizers may upsert full Competition JSON into app_competitions.payload (RLS on
 *   organizer_id column only; no payload schema validation).
 * - F09-S02 already excludes payload.refereeIds from referee authz (ownerId only).
 * - No current TS authz sink found that grants privilege from payload.role/permissions.
 * - Residual risk: integrity / future-authz trap if new code trusts payload ownership fields.
 *
 * Client-only sanitization would NOT stop direct PostgREST upsert → not a PASS.
 *
 * Run: npx tsx scripts/fix09-p1-09-competition-payload-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type Payload = Record<string, unknown>;

/** Privilege-bearing keys that must NEVER drive authorization. */
const PRIVILEGE_KEYS = [
  'ownerId',
  'organizerId',
  'role',
  'permissions',
  'admin',
  'isAdmin',
  'refereeIds',
] as const;

/**
 * Authz must use column/server ownership — never payload privilege fields.
 * Mirrors F09-S02 organizer_controls_referee (ownerId on referees blob only).
 */
function refereeUpdateAllowed(opts: {
  me: string;
  refereeOwnerId: string | null;
  poisonedCompetitionPayload?: Payload;
}): boolean {
  void opts.poisonedCompetitionPayload;
  return !!opts.refereeOwnerId && opts.refereeOwnerId === opts.me;
}

/** Competition row ownership = organizer_id column, not payload.organizerId. */
function competitionWriteAllowed(opts: {
  me: string;
  rowOrganizerId: string;
  payload: Payload;
}): boolean {
  void opts.payload.organizerId;
  void opts.payload.ownerId;
  void opts.payload.role;
  return opts.rowOrganizerId === opts.me;
}

/** Display hydrate may merge payload but must not override column organizer for authz. */
function resolveOrganizerForAuthz(row: {
  organizer_id: string;
  payload: Payload;
}): string {
  return row.organizer_id;
}

/** Legitimate functional fields must remain representable. */
const LEGITIMATE_FIELDS = [
  'teams',
  'matches',
  'standings',
  'fixtures',
  'results',
  'name',
  'venue',
  'staff',
  'media',
  'status',
] as const;

function main() {
  const orgA = 'organizer-a';
  const orgB = 'organizer-b';
  const refB = 'ref-owned-by-b';

  // --- Scenario A: forged refereeIds must not authorize referee mutation ---
  assert.equal(
    refereeUpdateAllowed({
      me: orgA,
      refereeOwnerId: orgB,
      poisonedCompetitionPayload: { refereeIds: [refB] },
    }),
    false
  );

  // --- Scenario B: forged ownerId in payload ---
  assert.equal(
    competitionWriteAllowed({
      me: orgB,
      rowOrganizerId: orgA,
      payload: { ownerId: orgB, refereeIds: [refB] },
    }),
    false
  );

  // --- Scenario C: forged organizerId in payload ---
  assert.equal(
    resolveOrganizerForAuthz({
      organizer_id: orgA,
      payload: { organizerId: orgB },
    }),
    orgA
  );
  assert.equal(
    competitionWriteAllowed({
      me: orgB,
      rowOrganizerId: orgA,
      payload: { organizerId: orgB },
    }),
    false
  );

  // --- Scenario D/E: forged role / permissions never grant via payload ---
  const forged: Payload = {
    role: 'admin',
    permissions: { canCreateContent: true },
    admin: true,
  };
  for (const k of ['role', 'permissions', 'admin'] as const) {
    assert.ok(PRIVILEGE_KEYS.includes(k as (typeof PRIVILEGE_KEYS)[number]));
  }
  assert.equal(
    competitionWriteAllowed({
      me: orgA,
      rowOrganizerId: orgA,
      payload: forged,
    }),
    true
  ); // write to own row still allowed by RLS model — privilege fields ignored for authz
  assert.equal(
    refereeUpdateAllowed({
      me: orgA,
      refereeOwnerId: orgB,
      poisonedCompetitionPayload: forged,
    }),
    false
  );

  // --- Scenario F: legitimate fields still modeled ---
  const legit: Payload = {
    teams: [],
    matches: [],
    standings: [],
    fixtures: [],
    results: [],
    name: 'Cup',
    venue: {},
    staff: [],
    media: {},
    status: 'active',
  };
  for (const f of LEGITIMATE_FIELDS) {
    assert.ok(f in legit);
  }

  // --- Scenario G: F09-S02 SQL still ownerId-only ---
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/FIX-09-P0-HARDENING.sql'),
    'utf8'
  );
  assert.match(sql, /organizer_controls_referee/);
  assert.match(sql, /ref->>'ownerId'\s*=\s*auth\.uid\(\)::text/);
  assert.doesNotMatch(
    sql,
    /payload\s*->\s*'refereeIds'[\s\S]{0,80}\?\s*trim\(p_referee_id\)/
  );
  assert.match(sql, /NEVER use app_competitions\.payload\.refereeIds/);

  // Client upsert still sends full competition JSON (open payload write residual)
  const comps = fs.readFileSync(
    path.join(process.cwd(), 'src/services/supabase-competitions.ts'),
    'utf8'
  );
  assert.match(comps, /from\('app_competitions'\)\.upsert/);
  assert.match(comps, /payload:/);
  // Prefer column organizer_id when hydrating
  assert.match(comps, /organizerId:\s*row\.organizer_id\s*\|\|\s*payload\.organizerId/);

  // PHASE4 RLS: organizer_id column gate (no payload validation)
  const phase4 = fs.readFileSync(
    path.join(process.cwd(), 'supabase/SECURITY-PHASE4-HARDENING.sql'),
    'utf8'
  );
  assert.match(phase4, /app_competitions_update_auth/);
  assert.match(phase4, /organizer_id = auth\.uid\(\)::text/);

  // No TS authz using payload.role / permissions
  const srcRoot = path.join(process.cwd(), 'src');
  const walk = (dir: string, acc: string[] = []): string[] => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p, acc);
      else if (/\.(ts|tsx)$/.test(ent.name)) acc.push(p);
    }
    return acc;
  };
  let payloadAuthzHits = 0;
  for (const file of walk(srcRoot)) {
    const text = fs.readFileSync(file, 'utf8');
    if (
      /payload\.(role|permissions|isAdmin)\b/.test(text) &&
      /(if\s*\(|&&|\|\||===|!==)/.test(text)
    ) {
      // crude; count only if both appear near auth-ish words
      if (/isAdmin|canCreate|forbidden|authorize|permission/i.test(text)) {
        payloadAuthzHits += 1;
      }
    }
  }
  assert.equal(payloadAuthzHits, 0);

  console.log(
    'F09-P1-09 competition payload unit: PASS (documentation) — IMPLEMENTATION BLOCKED'
  );
  console.log(
    'Server-side payload integrity requires SQL/trigger/validated RPC — not run this phase.'
  );
}

main();
