/**
 * F09-P1-08 — settings / app_settings alignment (static/unit).
 * Run: npx tsx scripts/fix09-p1-08-settings-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type AppSettingsBlob = {
  autoApproveAnalystRequests?: boolean;
};

const APP_SETTINGS_CANONICAL_KEY = 'settings';
const APP_SETTINGS_LEGACY_KEY = 'app_settings';

/** Mirrors src/services/supabase-app-blobs.ts resolveAutoApproveAnalystRequests */
function resolveAutoApproveAnalystRequests(opts: {
  settings?: AppSettingsBlob | null;
  app_settings?: AppSettingsBlob | null;
}): boolean {
  if (opts.settings != null) {
    return !!opts.settings.autoApproveAnalystRequests;
  }
  if (opts.app_settings != null) {
    return !!opts.app_settings.autoApproveAnalystRequests;
  }
  return false;
}

function main() {
  assert.equal(APP_SETTINGS_CANONICAL_KEY, 'settings');
  assert.equal(APP_SETTINGS_LEGACY_KEY, 'app_settings');

  // Canonical wins when both present
  assert.equal(
    resolveAutoApproveAnalystRequests({
      settings: { autoApproveAnalystRequests: true },
      app_settings: { autoApproveAnalystRequests: false },
    }),
    true
  );
  assert.equal(
    resolveAutoApproveAnalystRequests({
      settings: { autoApproveAnalystRequests: false },
      app_settings: { autoApproveAnalystRequests: true },
    }),
    false
  );

  // Legacy only
  assert.equal(
    resolveAutoApproveAnalystRequests({
      settings: null,
      app_settings: { autoApproveAnalystRequests: true },
    }),
    true
  );

  // Missing both → safe default (no auto-approve)
  assert.equal(
    resolveAutoApproveAnalystRequests({
      settings: null,
      app_settings: null,
    }),
    false
  );
  assert.equal(resolveAutoApproveAnalystRequests({}), false);

  // Disabled legacy alone cannot force true
  assert.equal(
    resolveAutoApproveAnalystRequests({
      app_settings: { autoApproveAnalystRequests: false },
    }),
    false
  );

  const helperSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/services/supabase-app-blobs.ts'),
    'utf8'
  );
  assert.match(helperSrc, /APP_SETTINGS_CANONICAL_KEY = 'settings'/);
  assert.match(helperSrc, /APP_SETTINGS_LEGACY_KEY = 'app_settings'/);
  assert.match(helperSrc, /resolveAutoApproveAnalystRequests/);
  assert.match(helperSrc, /never grants analyst/);
  assert.match(helperSrc, /upsertAppBlob\(APP_SETTINGS_CANONICAL_KEY/);
  assert.match(helperSrc, /fetchAppSettingsBlob/);

  // Privilege fields not granted by settings helper block
  const resolveBlock = helperSrc.slice(
    helperSrc.indexOf('resolveAutoApproveAnalystRequests'),
    helperSrc.indexOf('fetchAppSettingsBlob')
  );
  assert.doesNotMatch(resolveBlock, /canCreateContent/);
  assert.doesNotMatch(resolveBlock, /analyst:\s*true/);

  const provider = fs.readFileSync(
    path.join(process.cwd(), 'src/providers/TournamentProvider.tsx'),
    'utf8'
  );
  assert.match(provider, /upsertAppSettingsBlob/);
  assert.match(provider, /fetchAppSettingsBlob/);
  assert.doesNotMatch(provider, /upsertAppBlob\(\s*'app_settings'/);

  // Server SQL already reads canonical `settings` (unchanged this task)
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/FIX-09-P0-HARDENING.sql'),
    'utf8'
  );
  assert.match(sql, /autoApproveAnalystRequests/);
  assert.match(sql, /where key = 'settings'/);
  assert.match(sql, /guard_profile_privileged_content/);
  assert.match(sql, /preserve_privileged_profile_content/);

  console.log('F09-P1-08 settings unit: PASS');
}

main();
