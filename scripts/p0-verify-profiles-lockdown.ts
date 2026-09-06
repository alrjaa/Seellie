/**
 * P0 live verification helpers (read-only against EXPO_PUBLIC_SUPABASE_*).
 * Apply supabase/P0-PROFILES-SELECT-LOCKDOWN.sql in SQL Editor first.
 *
 * Usage: npx tsx scripts/p0-verify-profiles-lockdown.ts
 */
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const out: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const url = (env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL / ANON_KEY');
    process.exit(1);
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  const catalog = await fetch(
    `${url}/rest/v1/profiles_catalog?select=id,name&limit=1`,
    { headers }
  );
  const profiles = await fetch(
    `${url}/rest/v1/profiles?select=id,email,mobile&limit=3`,
    { headers }
  );
  const adminFn = await fetch(`${url}/rest/v1/rpc/is_app_superadmin`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}',
  });

  const catalogBody = await catalog.text();
  const profilesBody = await profiles.text();
  const adminBody = await adminFn.text();

  console.log(
    JSON.stringify(
      {
        profiles_catalog_anon: {
          status: catalog.status,
          note:
            catalog.status === 200
              ? 'OK or empty (prefer 401 for anon; authenticated needs JWT)'
              : catalogBody.slice(0, 180),
        },
        profiles_table_anon: {
          status: profiles.status,
          bodyPreview: profilesBody.slice(0, 180),
          note: 'Anon should not return other users email/mobile',
        },
        is_app_superadmin_rpc: {
          status: adminFn.status,
          body: adminBody.slice(0, 80),
        },
        manual_sql_required:
          'Paste supabase/P0-PROFILES-SELECT-LOCKDOWN.sql in Supabase SQL Editor, then re-test with an authenticated follower JWT.',
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
