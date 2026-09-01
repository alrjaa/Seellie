/**
 * F09-P1-06 — analyst email code↔recipient binding (static/unit, no live email).
 * Run: npx tsx scripts/fix09-p1-06-email-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type AuthzInput = {
  authenticated: boolean;
  isAdmin: boolean;
  type?: string;
  to?: string;
  code?: string;
  userId?: string;
  /** Server-resolved profile for `to` */
  profile?: { id: string; email: string } | null;
  /** Stored access_code for profile.id (from admin_get_analyst_access_code) */
  storedCode?: string | null;
  rateLimited?: boolean;
};

/**
 * Mirrors send-email authorization through F09-P1-06 binding
 * (before RESEND — no secret required).
 */
function authorizeAnalystEmail(opts: AuthzInput): {
  ok: boolean;
  error?: string;
  status?: number;
} {
  if (!opts.authenticated) {
    return { ok: false, error: 'unauthorized', status: 401 };
  }
  if (!opts.isAdmin) {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  if (opts.rateLimited) {
    return { ok: false, error: 'rate_limited', status: 429 };
  }
  if (opts.type !== 'analyst_access_code') {
    return { ok: false, error: 'type_not_allowed', status: 403 };
  }
  const to = (opts.to || '').trim().toLowerCase();
  if (!to || !to.includes('@')) {
    return { ok: false, error: 'invalid_to', status: 400 };
  }
  const code = (opts.code || '').trim();
  if (!code) return { ok: false, error: 'missing_code', status: 400 };

  if (!opts.profile || opts.profile.email.toLowerCase() !== to) {
    return { ok: false, error: 'recipient_not_found', status: 400 };
  }

  const claimed = (opts.userId || '').trim();
  if (claimed && claimed !== opts.profile.id) {
    return {
      ok: false,
      error: 'analyst_code_recipient_mismatch',
      status: 400,
    };
  }

  const expected = (opts.storedCode || '').trim();
  if (!expected || expected !== code) {
    return {
      ok: false,
      error: 'analyst_code_recipient_mismatch',
      status: 400,
    };
  }

  return { ok: true, status: 200 };
}

function main() {
  const userA = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'a@example.com',
  };
  const userB = {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    email: 'b@example.com',
  };
  const codeA = 'CODEAAAA';
  const codeB = 'CODEBBBB';

  // --- Authorization ---
  assert.equal(
    authorizeAnalystEmail({
      authenticated: false,
      isAdmin: false,
      type: 'analyst_access_code',
      to: userA.email,
      code: codeA,
      profile: userA,
      storedCode: codeA,
    }).error,
    'unauthorized'
  );
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: false,
      type: 'analyst_access_code',
      to: userA.email,
      code: codeA,
      profile: userA,
      storedCode: codeA,
    }).error,
    'forbidden'
  );
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'newsletter',
      to: userA.email,
      code: codeA,
      profile: userA,
      storedCode: codeA,
    }).error,
    'type_not_allowed'
  );
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: 'nobody@example.com',
      code: codeA,
      profile: null,
      storedCode: codeA,
    }).error,
    'recipient_not_found'
  );
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: userA.email,
      code: codeA,
      profile: userA,
      storedCode: codeA,
      rateLimited: true,
    }).error,
    'rate_limited'
  );

  // --- Code binding ---
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: userA.email,
      code: codeA,
      userId: userA.id,
      profile: userA,
      storedCode: codeA,
    }).ok,
    true
  );

  // valid code A + recipient B email → reject (B's stored code differs)
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: userB.email,
      code: codeA,
      profile: userB,
      storedCode: codeB,
    }).error,
    'analyst_code_recipient_mismatch'
  );

  // valid code + another user's email with forged userId
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: userB.email,
      code: codeA,
      userId: userA.id,
      profile: userB,
      storedCode: codeB,
    }).error,
    'analyst_code_recipient_mismatch'
  );

  // invalid code
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: userA.email,
      code: 'WRONGCODE',
      profile: userA,
      storedCode: codeA,
    }).error,
    'analyst_code_recipient_mismatch'
  );

  // missing code / missing stored
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: userA.email,
      code: '',
      profile: userA,
      storedCode: codeA,
    }).error,
    'missing_code'
  );
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: userA.email,
      code: codeA,
      profile: userA,
      storedCode: null,
    }).error,
    'analyst_code_recipient_mismatch'
  );
  assert.equal(
    authorizeAnalystEmail({
      authenticated: true,
      isAdmin: true,
      type: 'analyst_access_code',
      to: '',
      code: codeA,
      profile: userA,
      storedCode: codeA,
    }).error,
    'invalid_to'
  );

  // Privacy: mismatch errors never include user ids / codes in error string
  const mismatch = authorizeAnalystEmail({
    authenticated: true,
    isAdmin: true,
    type: 'analyst_access_code',
    to: userB.email,
    code: codeA,
    profile: userB,
    storedCode: codeB,
  });
  assert.equal(mismatch.error, 'analyst_code_recipient_mismatch');
  assert.equal(mismatch.error?.includes(userA.id), false);
  assert.equal(mismatch.error?.includes(codeA), false);
  assert.equal(mismatch.error?.includes(codeB), false);

  // Source markers
  const sendEmail = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/send-email/index.ts'),
    'utf8'
  );
  assert.match(sendEmail, /F09-P1-06/);
  assert.match(sendEmail, /admin_get_analyst_access_code/);
  assert.match(sendEmail, /analyst_code_recipient_mismatch/);
  assert.match(sendEmail, /is_app_superadmin/);
  assert.match(sendEmail, /type_not_allowed/);
  assert.match(sendEmail, /rate_limited/);
  // Authz before Resend
  const bindIdx = sendEmail.indexOf('admin_get_analyst_access_code');
  const resendIdx = sendEmail.indexOf("Deno.env.get('RESEND_API_KEY')");
  assert.ok(bindIdx > 0 && resendIdx > bindIdx, 'binding must precede RESEND check');
  assert.doesNotMatch(sendEmail, /service_role|SERVICE_ROLE/);

  const delivery = fs.readFileSync(
    path.join(process.cwd(), 'src/services/analyst-code-delivery.ts'),
    'utf8'
  );
  assert.match(delivery, /userId/);

  // Note deferred P1-07 (applicant auto-approve) — do not require fix here
  console.log('F09-P1-07 = DEFERRED (applicant auto-approve non-admin send path)');
  console.log('F09-P1-06 email unit: PASS');
}

main();
