/**
 * F13-P2-01 — prevent reintroduction of weak private_messages INSERT RLS.
 * Run: npx tsx scripts/f13-p2-01-sql-policy-hardening-unit.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..');

function stripSqlComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** Mirrors Production WITH CHECK for private_messages_insert_own_inbox. */
function clientInsertAllowed(args: {
  authUid: string | null;
  accountActive: boolean;
  senderId: string;
  ownerId: string;
  friendId: string;
  isFriend: boolean;
}): boolean {
  const { authUid, accountActive, senderId, ownerId, friendId, isFriend } =
    args;
  if (!authUid || !accountActive) return false;
  if (authUid !== senderId) return false;
  if (authUid !== ownerId) return false;
  if (!friendId || friendId === authUid) return false;
  if (!isFriend) return false;
  return true;
}

async function main() {
  const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  // 1) A own inbox only
  assert.equal(
    clientInsertAllowed({
      authUid: A,
      accountActive: true,
      senderId: A,
      ownerId: A,
      friendId: B,
      isFriend: true,
    }),
    true,
    'A may insert own inbox when friends'
  );

  // 2) A cannot create B-owned inbox
  assert.equal(
    clientInsertAllowed({
      authUid: A,
      accountActive: true,
      senderId: A,
      ownerId: B,
      friendId: A,
      isFriend: true,
    }),
    false,
    'A→B inbox forge denied'
  );

  // 3) friend_id cannot override owner_id
  assert.equal(
    clientInsertAllowed({
      authUid: A,
      accountActive: true,
      senderId: A,
      ownerId: B,
      friendId: B,
      isFriend: true,
    }),
    false,
    'friend_id cannot bypass owner_id'
  );

  // 4) cannot send as another user
  assert.equal(
    clientInsertAllowed({
      authUid: A,
      accountActive: true,
      senderId: B,
      ownerId: A,
      friendId: B,
      isFriend: true,
    }),
    false,
    'A cannot set sender_id to B'
  );

  // 5) non-friend cannot insert
  assert.equal(
    clientInsertAllowed({
      authUid: A,
      accountActive: true,
      senderId: A,
      ownerId: A,
      friendId: B,
      isFriend: false,
    }),
    false,
    'friendship required'
  );

  // 6) anonymous denied
  assert.equal(
    clientInsertAllowed({
      authUid: null,
      accountActive: true,
      senderId: A,
      ownerId: A,
      friendId: B,
      isFriend: true,
    }),
    false,
    'anonymous INSERT denied'
  );

  const files = walk(ROOT);
  const sqlFiles = files.filter((p) => p.endsWith('.sql'));
  const createWeak: string[] = [];
  const operationalWeakOr: string[] = [];

  for (const p of sqlFiles) {
    const raw = readFileSync(p, 'utf8');
    const body = stripSqlComments(raw);
    if (/create\s+policy\s+"private_messages_insert_thread"/i.test(body)) {
      createWeak.push(relative(ROOT, p));
    }
    if (
      /on\s+public\.private_messages\s+for\s+insert[\s\S]{0,400}friend_id\s*=\s*auth\.uid\(\)/i.test(
        body
      )
    ) {
      operationalWeakOr.push(relative(ROOT, p));
    }
  }

  assert.deepEqual(
    createWeak,
    [],
    `operational recreate of private_messages_insert_thread: ${createWeak.join(', ')}`
  );
  assert.deepEqual(
    operationalWeakOr,
    [],
    `weak INSERT WITH CHECK in ${operationalWeakOr.join(', ')}`
  );

  const phase4 = readFileSync(
    join(ROOT, 'supabase/SECURITY-PHASE4-HARDENING.sql'),
    'utf8'
  );
  const phase4Body = stripSqlComments(phase4);
  assert.ok(phase4Body.includes('private_messages_insert_own_inbox'));
  assert.ok(phase4Body.includes('private_dm_is_friend'));
  assert.ok(phase4Body.includes('auth.uid() = owner_id'));
  assert.ok(phase4.includes('OBSOLETE'));

  const tip = readFileSync(
    join(ROOT, 'supabase/F13-P1-PRIVATE-MESSAGES-RLS.sql'),
    'utf8'
  );
  assert.ok(tip.includes('create policy "private_messages_insert_own_inbox"'));
  assert.ok(tip.includes('send_private_message'));

  const dmFix = readFileSync(join(ROOT, 'supabase/PRIVATE-DM-FIX.sql'), 'utf8');
  assert.ok(
    /security\s+definer/i.test(dmFix) &&
      /create\s+or\s+replace\s+function\s+public\.send_private_message/i.test(
        dmFix
      ),
    'legitimate DM RPC remains SECURITY DEFINER'
  );
  assert.ok(dmFix.includes('OBSOLETE — DO NOT recreate'));

  const client = readFileSync(
    join(ROOT, 'src/services/private-space.ts'),
    'utf8'
  );
  assert.ok(client.includes("rpc('send_private_message'"));
  assert.ok(client.includes("error: 'cloud_send_failed'"));
  assert.ok(
    !/\.from\(\s*['"]private_messages['"]\s*\)\s*\.insert\s*\(/.test(client)
  );

  console.log('F13-P2-01 SQL policy hardening unit: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
