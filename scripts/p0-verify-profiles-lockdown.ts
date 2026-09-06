/**
 * P0 live verification against EXPO_PUBLIC_SUPABASE_* (staging/test).
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

  const anonHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  const catalogAnon = await fetch(
    `${url}/rest/v1/profiles_catalog?select=id,name&limit=1`,
    { headers: anonHeaders }
  );
  const profilesAnon = await fetch(
    `${url}/rest/v1/profiles?select=id,email,mobile&limit=3`,
    { headers: anonHeaders }
  );

  const stamp = Date.now();
  const email = `p0.verify.${stamp}@seellie.test`;
  const password = `P0Verify!${stamp}`;
  const signup = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const signupJson = (await signup.json()) as {
    access_token?: string;
    user?: { id?: string };
    msg?: string;
    error_description?: string;
  };

  let access =
    signupJson.access_token ||
    (signupJson as { session?: { access_token?: string } }).session
      ?.access_token;
  let userId = signupJson.user?.id;

  if (!access) {
    const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const loginJson = (await login.json()) as {
      access_token?: string;
      user?: { id?: string };
    };
    access = loginJson.access_token;
    userId = loginJson.user?.id || userId;
  }

  const authHeaders = access
    ? {
        apikey: key,
        Authorization: `Bearer ${access}`,
      }
    : null;

  let catalogAuthStatus = -1;
  let catalogAuthCount = -1;
  let profilesAuthBody = '';
  let profilesAuthStatus = -1;
  let foreignEmails = 0;

  if (authHeaders) {
    const catalogAuth = await fetch(
      `${url}/rest/v1/profiles_catalog?select=id,name&limit=5`,
      { headers: authHeaders }
    );
    catalogAuthStatus = catalogAuth.status;
    const catalogRows = (await catalogAuth.json()) as unknown;
    catalogAuthCount = Array.isArray(catalogRows) ? catalogRows.length : -1;

    const profilesAuth = await fetch(
      `${url}/rest/v1/profiles?select=id,email,mobile&limit=50`,
      { headers: authHeaders }
    );
    profilesAuthStatus = profilesAuth.status;
    profilesAuthBody = await profilesAuth.text();
    try {
      const rows = JSON.parse(profilesAuthBody) as Array<{
        id?: string;
        email?: string;
      }>;
      if (Array.isArray(rows)) {
        foreignEmails = rows.filter(
          (r) => r.id && userId && r.id !== userId && !!r.email
        ).length;
      }
    } catch {
      foreignEmails = -1;
    }
  }

  const pass =
    !!access &&
    catalogAuthStatus === 200 &&
    catalogAuthCount >= 0 &&
    profilesAuthStatus === 200 &&
    foreignEmails === 0 &&
    catalogAnon.status !== 200;

  const report = {
    environment: 'staging/test',
    project_ref: 'sjfkdipgvivomllpfnkt',
    verified_at: new Date().toISOString(),
    pass,
    anon: {
      profiles_catalog_status: catalogAnon.status,
      profiles_table_status: profilesAnon.status,
      profiles_table_preview: (await profilesAnon.text()).slice(0, 120),
    },
    authenticated_follower: {
      signup_status: signup.status,
      user_id: userId || null,
      catalog_status: catalogAuthStatus,
      catalog_row_count: catalogAuthCount,
      profiles_status: profilesAuthStatus,
      foreign_emails_visible: foreignEmails,
      profiles_preview: profilesAuthBody.slice(0, 200),
    },
    expectations: {
      anon_catalog: 'denied (401) or empty — not public',
      auth_catalog: '200 with rows (no email/mobile columns)',
      auth_profiles: '200 but only own row / no foreign emails',
    },
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(pass ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
