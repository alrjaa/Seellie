/**
 * FIX-08 security unit — mirrors SQL/Edge authorization invariants (no live DB).
 * Run: npx tsx scripts/fix08-security-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type OfferParty = {
  freelancerId: string;
  organizerId: string;
};

/** Mirrors FIX-08 set_offer_status accept rules */
function canSetOfferStatus(
  me: string,
  offer: OfferParty,
  status: 'accepted' | 'declined' | 'pending',
  isAdmin: boolean
): { ok: boolean; error?: string } {
  const isRecipient = offer.freelancerId === me;
  const isCreator = offer.organizerId === me;
  if (!isRecipient && !isCreator && !isAdmin) {
    return { ok: false, error: 'forbidden' };
  }
  if (status === 'accepted' && !isRecipient && !isAdmin) {
    return { ok: false, error: 'only_recipient_can_accept' };
  }
  if (status === 'declined' && !isRecipient && !isCreator && !isAdmin) {
    return { ok: false, error: 'forbidden' };
  }
  if (status === 'pending' && !isAdmin) {
    return { ok: false, error: 'admin_pending_only' };
  }
  return { ok: true };
}

const DEFAULT_CATALOG: Record<string, number> = {
  إبداع: 5,
  برونزي: 10,
  فضي: 25,
  ذهبي: 50,
  ماسي: 100,
};

/** Mirrors FIX-08 gift amount/catalog/recipient checks (pre-insert) */
function validateGiftAppend(input: {
  callerId: string;
  gift: {
    id: string;
    gifterId?: string;
    recipientId: string;
    certificateType: string;
    amountPaid?: number;
  };
  recipientExists: boolean;
  recipientIsCaller: boolean;
}): { ok: boolean; error?: string; amountPaid?: number } {
  const { callerId, gift } = input;
  if (!gift.id) return { ok: false, error: 'gift id required' };
  if (gift.gifterId && gift.gifterId !== callerId) {
    return { ok: false, error: 'gifter must match authenticated user' };
  }
  const price = DEFAULT_CATALOG[gift.certificateType];
  if (price == null) return { ok: false, error: 'unknown_certificate_type' };
  if (gift.amountPaid != null && gift.amountPaid !== price) {
    return { ok: false, error: 'forged_amount' };
  }
  if (!gift.recipientId) return { ok: false, error: 'recipient_required' };
  if (input.recipientIsCaller || gift.recipientId === callerId) {
    return { ok: false, error: 'cannot_gift_self' };
  }
  if (!input.recipientExists) return { ok: false, error: 'recipient_not_found' };
  return { ok: true, amountPaid: price };
}

function canUpsertReferee(opts: {
  authenticated: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
}): { ok: boolean; error?: string } {
  if (!opts.authenticated) return { ok: false, error: 'not_authenticated' };
  if (!opts.isAdmin && !opts.isOrganizer) {
    return { ok: false, error: 'forbidden' };
  }
  return { ok: true };
}

/** Mirrors send-email allowlist */
function authorizeSendEmail(opts: {
  authenticated: boolean;
  isAdmin: boolean;
  type?: string;
  to?: string;
  code?: string;
}): { ok: boolean; error?: string; status?: number } {
  if (!opts.authenticated) return { ok: false, error: 'unauthorized', status: 401 };
  if (!opts.isAdmin) return { ok: false, error: 'forbidden', status: 403 };
  if (opts.type !== 'analyst_access_code') {
    return { ok: false, error: 'type_not_allowed', status: 403 };
  }
  const to = (opts.to || '').trim().toLowerCase();
  if (!to || !to.includes('@')) return { ok: false, error: 'invalid_to', status: 400 };
  if (!(opts.code || '').trim()) return { ok: false, error: 'missing_code', status: 400 };
  return { ok: true };
}

type SportsResource =
  | 'health'
  | 'window'
  | 'topscorers'
  | 'bundle'
  | 'sync_league'
  | 'sync_topscorers'
  | 'sync_all';

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

function main() {
  const offer = { freelancerId: 'fl-1', organizerId: 'org-1' };

  // F08-S01
  assert.equal(canSetOfferStatus('fl-1', offer, 'accepted', false).ok, true);
  assert.equal(
    canSetOfferStatus('org-1', offer, 'accepted', false).error,
    'only_recipient_can_accept'
  );
  assert.equal(canSetOfferStatus('org-1', offer, 'declined', false).ok, true);
  assert.equal(canSetOfferStatus('stranger', offer, 'accepted', false).error, 'forbidden');
  assert.equal(canSetOfferStatus('admin', offer, 'accepted', true).ok, true);
  assert.equal(canSetOfferStatus('fl-1', offer, 'declined', false).ok, true);

  // F08-S02
  assert.equal(
    validateGiftAppend({
      callerId: 'u1',
      gift: {
        id: 'g1',
        gifterId: 'u1',
        recipientId: 'u2',
        certificateType: 'إبداع',
        amountPaid: 5,
      },
      recipientExists: true,
      recipientIsCaller: false,
    }).ok,
    true
  );
  assert.equal(
    validateGiftAppend({
      callerId: 'u1',
      gift: {
        id: 'g1',
        gifterId: 'u1',
        recipientId: 'u2',
        certificateType: 'إبداع',
        amountPaid: 999,
      },
      recipientExists: true,
      recipientIsCaller: false,
    }).error,
    'forged_amount'
  );
  assert.equal(
    validateGiftAppend({
      callerId: 'u1',
      gift: {
        id: 'g1',
        gifterId: 'u1',
        recipientId: 'u1',
        certificateType: 'إبداع',
        amountPaid: 5,
      },
      recipientExists: true,
      recipientIsCaller: true,
    }).error,
    'cannot_gift_self'
  );
  assert.equal(
    validateGiftAppend({
      callerId: 'u1',
      gift: {
        id: 'g1',
        gifterId: 'other',
        recipientId: 'u2',
        certificateType: 'إبداع',
        amountPaid: 5,
      },
      recipientExists: true,
      recipientIsCaller: false,
    }).error,
    'gifter must match authenticated user'
  );
  assert.equal(
    validateGiftAppend({
      callerId: 'u1',
      gift: {
        id: 'g1',
        gifterId: 'u1',
        recipientId: 'missing',
        certificateType: 'إبداع',
        amountPaid: 5,
      },
      recipientExists: false,
      recipientIsCaller: false,
    }).error,
    'recipient_not_found'
  );
  assert.equal(
    validateGiftAppend({
      callerId: 'u1',
      gift: {
        id: 'g1',
        gifterId: 'u1',
        recipientId: 'u2',
        certificateType: 'NOPE',
        amountPaid: 5,
      },
      recipientExists: true,
      recipientIsCaller: false,
    }).error,
    'unknown_certificate_type'
  );

  // F08-S03
  assert.equal(
    canUpsertReferee({ authenticated: true, isAdmin: true, isOrganizer: false }).ok,
    true
  );
  assert.equal(
    canUpsertReferee({ authenticated: true, isAdmin: false, isOrganizer: true }).ok,
    true
  );
  assert.equal(
    canUpsertReferee({ authenticated: true, isAdmin: false, isOrganizer: false })
      .error,
    'forbidden'
  );
  assert.equal(
    canUpsertReferee({ authenticated: false, isAdmin: false, isOrganizer: false })
      .error,
    'not_authenticated'
  );

  // F08-S04
  assert.equal(
    authorizeSendEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: 'a@b.com',
      code: 'X',
    }).ok,
    true
  );
  assert.equal(
    authorizeSendEmail({
      authenticated: true,
      isAdmin: false,
      type: 'analyst_access_code',
      to: 'a@b.com',
      code: 'X',
    }).error,
    'forbidden'
  );
  assert.equal(
    authorizeSendEmail({
      authenticated: true,
      isAdmin: true,
      type: 'custom',
      to: 'a@b.com',
      code: 'X',
      text: 'hi',
    } as any).error,
    'type_not_allowed'
  );

  // F08-S05
  assert.equal(
    authorizeSportsProxy('sync_all', { hasUser: true, isAdmin: false }).error,
    'forbidden'
  );
  assert.equal(
    authorizeSportsProxy('sync_all', { hasUser: true, isAdmin: true }).ok,
    true
  );
  assert.equal(
    authorizeSportsProxy('sync_league', { hasUser: false, isAdmin: false }).error,
    'unauthorized'
  );
  assert.equal(
    authorizeSportsProxy('sync_league', { hasUser: true, isAdmin: false }).ok,
    true
  );
  assert.equal(
    authorizeSportsProxy('bundle', { hasUser: false, isAdmin: false }).ok,
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

  // SQL file presence + key markers
  const sqlPath = path.join(
    process.cwd(),
    'supabase',
    'FIX-08-HARDENING.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  assert.match(sql, /only_recipient_can_accept/);
  assert.match(sql, /forged_amount/);
  assert.match(sql, /is_app_organizer/);
  assert.match(sql, /unknown_certificate_type/);

  const sendEmail = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/send-email/index.ts'),
    'utf8'
  );
  assert.match(sendEmail, /analyst_access_code/);
  assert.match(sendEmail, /is_app_superadmin|forbidden/);

  const sports = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/sports-proxy/index.ts'),
    'utf8'
  );
  assert.match(sports, /sync_all/);
  assert.match(sports, /requireAuth|requireSuperadmin|unauthorized|forbidden/);

  console.log('FIX-08 security unit: PASS');
}

main();
