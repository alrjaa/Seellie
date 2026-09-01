/**
 * F09-P1-05 — gift metadata server-derivation.
 *
 * STATUS: BLOCKED (no app/SQL change this round).
 *
 * Authoritative enforcement for certificateNumber / timestamp / recipientType
 * lives only in append_gift_transaction (FIX-08 / FIX-09-P1-04 SQL).
 * This task forbids SQL/migration, so client-only changes cannot stop a
 * malicious RPC caller from forging those fields.
 *
 * Client-only omit would also change UX (e.g. all certs → SUP-000000) —
 * forbidden as functional behavior change without a server numbering mechanism.
 *
 * Run: npx tsx scripts/fix09-p1-05-gift-metadata-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type GiftIn = Record<string, unknown>;

/**
 * Mirrors CURRENT server sanitize (P1-04 SQL) — documents residual trust.
 * NOT the desired P1-05 end state.
 */
function sanitizeGiftMetadataCurrent(pGift: GiftIn, profileRole: string): {
  certificateNumber: string;
  timestamp: string;
  recipientType: string;
} {
  const allowed = new Set([
    'organizer',
    'team',
    'player',
    'freelancer',
    'follower',
  ]);
  const clientType = String(pGift.recipientType || '').trim();
  let recipientType = clientType || profileRole || 'follower';
  if (!allowed.has(recipientType)) recipientType = 'follower';

  return {
    certificateNumber:
      String(pGift.certificateNumber || '').trim() || 'SUP-000000',
    timestamp: String(pGift.timestamp || '') || 'SERVER_NOW',
    recipientType,
  };
}

/** Desired P1-05 sanitize (requires SQL — not applied). */
function sanitizeGiftMetadataDesired(
  pGift: GiftIn,
  profileRole: string,
  serverNow: string,
  serverCert: string
): {
  certificateNumber: string;
  timestamp: string;
  recipientType: string;
} {
  void pGift.certificateNumber;
  void pGift.timestamp;
  void pGift.recipientType;
  const role = (profileRole || 'follower').trim();
  const allowed = new Set([
    'organizer',
    'team',
    'player',
    'freelancer',
    'follower',
  ]);
  return {
    certificateNumber: serverCert,
    timestamp: serverNow,
    recipientType: allowed.has(role) ? role : 'follower',
  };
}

function main() {
  // Residual: forged client metadata accepted by CURRENT server logic
  const forged = sanitizeGiftMetadataCurrent(
    {
      certificateNumber: 'FORGED-123',
      timestamp: '2000-01-01T00:00:00Z',
      recipientType: 'organizer',
    },
    'follower'
  );
  assert.equal(forged.certificateNumber, 'FORGED-123');
  assert.equal(forged.timestamp, '2000-01-01T00:00:00Z');
  assert.equal(forged.recipientType, 'organizer'); // client wins over profile role

  // Desired (blocked): ignore forgeries
  const desired = sanitizeGiftMetadataDesired(
    {
      certificateNumber: 'FORGED-123',
      timestamp: '2000-01-01T00:00:00Z',
      recipientType: 'organizer',
    },
    'follower',
    '2026-08-15T00:00:00Z',
    'gift_cert_server_1'
  );
  assert.equal(desired.certificateNumber, 'gift_cert_server_1');
  assert.equal(desired.timestamp, '2026-08-15T00:00:00Z');
  assert.equal(desired.recipientType, 'follower');
  assert.notEqual(desired.certificateNumber, 'FORGED-123');

  // Evidence: P1-04 SQL still prefers client metadata
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/FIX-09-P1-04-GIFT-HARDENING.sql'),
    'utf8'
  );
  assert.match(
    sql,
    /'certificateNumber',\s*coalesce\(nullif\(trim\(p_gift->>'certificateNumber'\)/
  );
  assert.match(
    sql,
    /'timestamp',\s*coalesce\(p_gift->>'timestamp',\s*now\(\)::text\)/
  );
  assert.match(
    sql,
    /recipient_type := coalesce\(nullif\(trim\(p_gift->>'recipientType'\)/
  );
  // P1-04 protections must remain intact (no rewrite this task)
  assert.match(sql, /gift_ledger_full/);
  assert.match(sql, /gifter_quota_exceeded/);
  assert.match(sql, /gen_random_uuid/);
  assert.match(sql, /pending_demo/);
  assert.match(sql, /forged_amount/);

  // Client still generates local cert number (UX); not a secure control
  const provider = fs.readFileSync(
    path.join(process.cwd(), 'src/providers/TournamentProvider.tsx'),
    'utf8'
  );
  assert.match(provider, /certificateNumber/);
  assert.match(provider, /SUP-\$/);

  // No alternate gift blob upsert
  const blobs = fs.readFileSync(
    path.join(process.cwd(), 'src/services/supabase-app-blobs.ts'),
    'utf8'
  );
  assert.match(blobs, /use_append_gift_transaction/);

  console.log(
    'F09-P1-05 gift metadata unit: PASS (documentation) — IMPLEMENTATION BLOCKED'
  );
  console.log(
    'certificateNumber: BLOCKED — no server numbering without SQL'
  );
  console.log(
    'timestamp: BLOCKED — authoritative now() requires SQL ignore of client'
  );
  console.log(
    'recipientType: BLOCKED — must prefer profiles.role over client (SQL)'
  );
}

main();
