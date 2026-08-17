/**
 * F13-P2-02 — profiles / competitions SELECT hardening (no live PII).
 * Run: npx tsx scripts/f13-p2-02-select-hardening-unit.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function stripSqlComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

async function main() {
  const sql = readFileSync(
    join(__dirname, '../supabase/F13-P2-02-PROFILES-COMPETITIONS-SELECT.sql'),
    'utf8'
  );
  const body = stripSqlComments(sql);

  assert.ok(body.includes('profiles_catalog'));
  assert.ok(body.includes('app_competitions_catalog'));
  assert.ok(body.includes('profile_catalog_content'));
  assert.ok(body.includes('sanitize_competition_payload'));
  assert.ok(body.includes('find_profile_by_email'));
  assert.ok(body.includes('profiles_select_own'));
  assert.ok(body.includes('profiles_select_admin'));
  assert.ok(body.includes('app_competitions_select_own'));
  assert.ok(!/using\s*\(\s*true\s*\)/.test(body));
  assert.ok(!body.includes('ilike'));

  const auth = readFileSync(
    join(__dirname, '../src/services/supabase-auth.ts'),
    'utf8'
  );
  assert.ok(auth.includes("from('profiles_catalog')"));
  assert.ok(auth.includes('PROFILE_CATALOG_COLUMNS'));
  assert.doesNotMatch(
    auth,
    /\.from\(\s*['"]profiles['"]\s*\)\s*\.select\(\s*['"]\*['"]/
  );

  const comps = readFileSync(
    join(__dirname, '../src/services/supabase-competitions.ts'),
    'utf8'
  );
  assert.ok(comps.includes("from('app_competitions_catalog')"));
  assert.doesNotMatch(
    comps,
    /\.from\(\s*['"]app_competitions['"]\s*\)\s*\.select\(\s*['"]\*['"]/
  );

  const share = readFileSync(
    join(__dirname, '../src/services/supabase-share.ts'),
    'utf8'
  );
  assert.ok(share.includes("rpc('find_profile_by_email'"));
  assert.ok(!share.includes('email.ilike'));

  const msgs = readFileSync(
    join(__dirname, '../src/services/supabase-messages.ts'),
    'utf8'
  );
  assert.ok(msgs.includes("rpc('find_profile_by_email'"));
  assert.ok(msgs.includes("from('profiles_catalog')"));

  const dm = readFileSync(
    join(__dirname, '../src/services/private-space.ts'),
    'utf8'
  );
  assert.ok(dm.includes('F13-P1'));
  assert.ok(dm.includes("error: 'cloud_send_failed'"));

  console.log('F13-P2-02 SELECT hardening unit: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
