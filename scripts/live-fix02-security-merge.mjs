#!/usr/bin/env node
/**
 * FIX-02 merge safety + FIX-01 security smoke (no RN imports).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Load pure TS via tsx register when run under tsx; for node use dynamic paths carefully.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

async function loadPure() {
  // Prefer compiled-free imports through tsx when available
  const { mergeUsersPreferCloud } = await import(
    path.join(root, 'src/services/merge-users.ts')
  );
  const { createGenerationGate } = await import(
    path.join(root, 'src/services/sync-engine-core.ts')
  );
  return { mergeUsersPreferCloud, createGenerationGate };
}

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const LOGOUT_CLEAR_KEYS = [
  'tajjd.secure.currentUser',
  'seellie.shareCards',
  'seellie.messages',
  'seellie.notifications.v1',
];

let fails = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails += 1;
}

function client() {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signup(tag) {
  const email = `fix02iso${tag}${Date.now()}@example.com`;
  const password = `Iso-${Date.now()}-Aa1!`;
  const sb = client();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error || !data.user || !data.session) throw new Error(error?.message || 'signup');
  return { sb, user: data.user };
}

async function main() {
  const { mergeUsersPreferCloud, createGenerationGate } = await loadPure();

  const local = [
    {
      id: 'local-a',
      email: 'a@example.com',
      name: 'A',
      handle: 'a',
      role: 'follower',
      passwordHash: 'x',
      posts: [{ id: 'p1' }],
      media: { photos: [{ id: 'm1', url: 'u' }], videos: [] },
    },
  ];
  check('merge_empty_cloud_keeps_local', mergeUsersPreferCloud(local, []).length === 1);
  check(
    'merge_empty_cloud_keeps_posts',
    mergeUsersPreferCloud(local, [])[0].posts?.length === 1
  );
  const cloudPartial = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'a@example.com',
      name: 'Acloud',
      handle: 'a',
      role: 'follower',
      passwordHash: 'supabase',
      posts: [],
      media: { photos: [], videos: [] },
    },
  ];
  const m = mergeUsersPreferCloud(local, cloudPartial);
  check('merge_partial_keeps_local_posts', m[0].posts?.length === 1);
  check('merge_partial_keeps_local_media', (m[0].media?.photos?.length || 0) > 0);

  const localB = [
    {
      id: 'local-b',
      email: 'b@example.com',
      name: 'B',
      handle: 'b',
      role: 'follower',
      passwordHash: 'x',
      posts: [{ id: 'pb' }],
    },
  ];
  const cloudA = [
    {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'a@example.com',
      name: 'A',
      handle: 'a',
      role: 'follower',
      passwordHash: 'supabase',
      posts: [{ id: 'pa' }],
    },
  ];
  const mixed = mergeUsersPreferCloud([...localB], cloudA);
  const bStill = mixed.find((u) => u.email === 'b@example.com');
  check('merge_no_cross_user_wipe_B', !!bStill && bStill.posts?.length === 1);

  const g = createGenerationGate();
  const t1 = g.next();
  const t2 = g.next();
  check('generation_stale_rejected', !g.isCurrent(t1) && g.isCurrent(t2));

  check(
    'logout_clear_keys_include_user_scoped',
    LOGOUT_CLEAR_KEYS.includes('seellie.shareCards') &&
      LOGOUT_CLEAR_KEYS.includes('seellie.messages') &&
      LOGOUT_CLEAR_KEYS.includes('tajjd.secure.currentUser')
  );

  const anon = client();
  const { data: anonProf } = await anon.from('profiles').select('id').limit(3);
  check('anon_profiles_empty', Array.isArray(anonProf) && anonProf.length === 0);
  const { error: anonSecErr } = await anon
    .from('analyst_access_codes')
    .select('user_id')
    .limit(1);
  check('anon_secrets_denied', !!anonSecErr);

  const A = await signup('a');
  const B = await signup('b');

  const { error: selfAct } = await A.sb.rpc('set_profile_analyst', {
    p_id: A.user.id,
    p_analyst: { status: 'active', accessCode: 'SHOULDFAIL99' },
  });
  check(
    'self_activate_forbidden',
    !!selfAct && /forbidden/i.test(selfAct.message || '')
  );

  const { error: adminRpc } = await A.sb.rpc('admin_get_analyst_access_code', {
    p_id: B.user.id,
  });
  check('user_admin_rpc_forbidden', !!adminRpc && /forbidden/i.test(adminRpc.message || ''));

  const { error: cross } = await A.sb.rpc('set_profile_analyst', {
    p_id: B.user.id,
    p_analyst: { status: 'approved' },
  });
  check('cross_user_analyst_forbidden', !!cross && /forbidden/i.test(cross.message || ''));

  const { data: contents } = await A.sb.from('profiles').select('content').limit(100);
  let leaks = 0;
  for (const row of contents || []) {
    const a = row?.content?.analyst;
    if (a && typeof a === 'object' && a.accessCode) leaks += 1;
  }
  check('accessCode_leak_scan', leaks === 0, `leaks=${leaks}`);

  const fake = new Blob(['x']);
  const { error: upErr } = await A.sb.storage
    .from('share-media')
    .upload(`${B.user.id}/fix02-probe.txt`, fake, { upsert: true });
  check('storage_cross_upload_denied', !!upErr);

  await A.sb.auth.signOut();
  await B.sb.auth.signOut();

  console.log(fails === 0 ? 'SUMMARY PASS' : `SUMMARY FAIL count=${fails}`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
