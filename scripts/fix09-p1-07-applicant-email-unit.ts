/**
 * F09-P1-07 — applicant auto-approve must not invoke send-email.
 * Run: npx tsx scripts/fix09-p1-07-applicant-email-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type SendGate = {
  ok: boolean;
  error?: string;
  shouldInvokeEdge: boolean;
};

/** Mirrors trySendAnalystCodeEmail pre-Edge gate + Edge auth mirror. */
function gateAnalystEmailDelivery(opts: {
  hasSession: boolean;
  isAdmin: boolean;
  to?: string;
  code?: string;
}): SendGate {
  if (!opts.hasSession) {
    return { ok: false, error: 'not_configured', shouldInvokeEdge: false };
  }
  const to = (opts.to || '').trim();
  const code = (opts.code || '').trim();
  if (!to || !code) {
    return { ok: false, error: 'invalid_payload', shouldInvokeEdge: false };
  }
  // F09-P1-07: applicant / ordinary → no Edge invoke
  if (!opts.isAdmin) {
    return { ok: false, error: 'admin_required', shouldInvokeEdge: false };
  }
  return { ok: true, shouldInvokeEdge: true };
}

/** Edge send-email auth (unchanged — still superadmin). */
function edgeSendEmailAuth(opts: {
  authenticated: boolean;
  isAdmin: boolean;
}): { ok: boolean; error?: string } {
  if (!opts.authenticated) return { ok: false, error: 'unauthorized' };
  if (!opts.isAdmin) return { ok: false, error: 'forbidden' };
  return { ok: true };
}

/** Approval success independent of email. */
function approvalAfterAutoApprove(opts: {
  emailAttempt: SendGate;
}): { approved: boolean; showCodeToast: boolean } {
  return {
    approved: true,
    showCodeToast: !opts.emailAttempt.ok || !opts.emailAttempt.shouldInvokeEdge,
  };
}

function main() {
  // Applicant / ordinary → DENIED, no Edge call
  const applicant = gateAnalystEmailDelivery({
    hasSession: true,
    isAdmin: false,
    to: 'a@example.com',
    code: 'CODE1234',
  });
  assert.equal(applicant.error, 'admin_required');
  assert.equal(applicant.shouldInvokeEdge, false);

  const ordinary = gateAnalystEmailDelivery({
    hasSession: true,
    isAdmin: false,
    to: 'b@example.com',
    code: 'CODE5678',
  });
  assert.equal(ordinary.shouldInvokeEdge, false);

  // Superadmin may invoke Edge (auth preserved; Resend may still be ops-blocked)
  const admin = gateAnalystEmailDelivery({
    hasSession: true,
    isAdmin: true,
    to: 'a@example.com',
    code: 'CODE1234',
  });
  assert.equal(admin.ok, true);
  assert.equal(admin.shouldInvokeEdge, true);

  // Edge itself still denies non-admin
  assert.equal(
    edgeSendEmailAuth({ authenticated: true, isAdmin: false }).error,
    'forbidden'
  );
  assert.equal(
    edgeSendEmailAuth({ authenticated: true, isAdmin: true }).ok,
    true
  );

  // Auto-approve: approval survives email skip
  const after = approvalAfterAutoApprove({ emailAttempt: applicant });
  assert.equal(after.approved, true);
  assert.equal(after.showCodeToast, true);

  // Source: client gate before invoke
  const delivery = fs.readFileSync(
    path.join(process.cwd(), 'src/services/analyst-code-delivery.ts'),
    'utf8'
  );
  assert.match(delivery, /F09-P1-07/);
  assert.match(delivery, /is_app_superadmin/);
  assert.match(delivery, /admin_required/);
  const adminCheck = delivery.indexOf('is_app_superadmin');
  const invoke = delivery.indexOf("functions.invoke('send-email'");
  assert.ok(adminCheck > 0 && invoke > adminCheck, 'admin gate before invoke');

  // send-email still superadmin + P1-06 binding
  const sendEmail = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/send-email/index.ts'),
    'utf8'
  );
  assert.match(sendEmail, /is_app_superadmin/);
  assert.match(sendEmail, /F09-P1-06/);
  assert.match(sendEmail, /admin_get_analyst_access_code/);
  assert.match(sendEmail, /analyst_code_recipient_mismatch/);
  assert.doesNotMatch(
    sendEmail,
    /is_app_organizer|account_is_active\(\)\s*&&\s*!.*superadmin/
  );

  // Auto-approve path still uses trySendAnalystCodeEmail (gated) — no UI rewrite
  const provider = fs.readFileSync(
    path.join(process.cwd(), 'src/providers/TournamentProvider.tsx'),
    'utf8'
  );
  assert.match(provider, /trySendAnalystCodeEmail/);
  assert.match(provider, /analystCodeReady/);

  console.log('F09-P1-07 applicant email unit: PASS');
}

main();
