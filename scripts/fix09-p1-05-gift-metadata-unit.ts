/**
 * F09-P1-05 — gift metadata server-derivation.
 * F12-P2-02 implements the desired sanitize in
 * supabase/F12-P2-02-GIFT-PAYMENT-READY.sql.
 * Run: npx tsx scripts/fix09-p1-05-gift-metadata-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type GiftIn = Record<string, unknown>;

/** Current (F12-P2-02) server sanitize for metadata. */
function sanitizeGiftMetadataF12(
  pGift: GiftIn,
  profileRole: string,
  serverNow: string
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
    // Official number empty until paid→issued (future)
    certificateNumber: '',
    timestamp: serverNow,
    recipientType: allowed.has(role) ? role : 'follower',
  };
}

function main() {
  const out = sanitizeGiftMetadataF12(
    {
      certificateNumber: 'FORGED-123',
      timestamp: '2000-01-01T00:00:00Z',
      recipientType: 'organizer',
    },
    'follower',
    '2026-08-17T00:00:00.000Z'
  );
  assert.equal(out.certificateNumber, '');
  assert.equal(out.timestamp, '2026-08-17T00:00:00.000Z');
  assert.equal(out.recipientType, 'follower');
  assert.notEqual(out.certificateNumber, 'FORGED-123');

  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/F12-P2-02-GIFT-PAYMENT-READY.sql'),
    'utf8'
  );
  assert.match(sql, /certificateNumber',\s*''/);
  assert.match(sql, /server_now/);
  assert.match(sql, /recipient_row\.role/);
  assert.match(sql, /forged_status/);
  assert.match(sql, /gift_ledger_full/);
  assert.match(sql, /gifter_quota_exceeded/);
  assert.match(sql, /gen_random_uuid/);
  assert.match(sql, /forged_amount/);

  // Historical F09 file retained
  const sqlF09 = fs.readFileSync(
    path.join(process.cwd(), 'supabase/FIX-09-P1-04-GIFT-HARDENING.sql'),
    'utf8'
  );
  assert.match(sqlF09, /pending_demo/);

  const provider = fs.readFileSync(
    path.join(process.cwd(), 'src/providers/TournamentProvider.tsx'),
    'utf8'
  );
  assert.match(provider, /certificateNumber:\s*''/);
  assert.doesNotMatch(provider, /SUP-\$/);

  const blobs = fs.readFileSync(
    path.join(process.cwd(), 'src/services/supabase-app-blobs.ts'),
    'utf8'
  );
  assert.match(blobs, /use_append_gift_transaction/);

  console.log('F09-P1-05 gift metadata unit: PASS (implemented via F12-P2-02)');
}

main();
