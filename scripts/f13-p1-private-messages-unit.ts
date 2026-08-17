/**
 * F13-P1 — private_messages inbox injection hardening (no live DB).
 * Run: npx tsx scripts/f13-p1-private-messages-unit.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Mirrors F13-P1 RLS WITH CHECK (own inbox only + friendship). */
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

  // Legitimate: A writes own inbox copy for thread with B
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

  // Attack: A forges owner_id = B
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
    'A must not write into B inbox'
  );

  // Attack: forged friend relationship
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
    'A must not insert without friendship'
  );

  // Self-thread
  assert.equal(
    clientInsertAllowed({
      authUid: A,
      accountActive: true,
      senderId: A,
      ownerId: A,
      friendId: A,
      isFriend: true,
    }),
    false,
    'no self friend_id'
  );

  // Anonymous
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
    'anonymous denied'
  );

  // B unaffected legitimate path
  assert.equal(
    clientInsertAllowed({
      authUid: B,
      accountActive: true,
      senderId: B,
      ownerId: B,
      friendId: A,
      isFriend: true,
    }),
    true,
    'B may still insert own inbox'
  );

  const sql = readFileSync(
    join(__dirname, '../supabase/F13-P1-PRIVATE-MESSAGES-RLS.sql'),
    'utf8'
  );
  assert.ok(sql.includes('private_messages_insert_own_inbox'));
  assert.ok(sql.includes('auth.uid() = owner_id'));
  assert.ok(sql.includes('private_dm_is_friend'));
  assert.ok(!sql.includes('or friend_id = auth.uid()'));

  const client = readFileSync(
    join(__dirname, '../src/services/private-space.ts'),
    'utf8'
  );
  assert.ok(client.includes("rpc('send_private_message'"));
  assert.ok(client.includes('F13-P1'));
  assert.ok(client.includes("error: 'cloud_send_failed'"));
  // No direct cloud insert into private_messages (friends upsert may still use owner_id: friendId)
  assert.ok(!/\.from\(\s*['"]private_messages['"]\s*\)\s*\.insert\s*\(/.test(client));
  assert.ok(!/private_messages[\s\S]{0,200}\.insert\s*\(/.test(client));

  console.log('F13-P1 private messages unit: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
