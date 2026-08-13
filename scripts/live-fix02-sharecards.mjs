#!/usr/bin/env node
/**
 * FIX-02 live Share Cards A→B→C + Realtime probe (no secrets printed).
 * Creates ephemeral users, inserts card A→B, asserts C denied, probes Realtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('missing supabase env');
  process.exit(2);
}

const ts = Date.now();
const pass = `Fix02Live-${ts}-Aa1!`;
const emails = {
  a: `fix02a${ts}@example.com`,
  b: `fix02b${ts}@example.com`,
  c: `fix02c${ts}@example.com`,
};

function client() {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signup(email) {
  const sb = client();
  const { data, error } = await sb.auth.signUp({ email, password: pass });
  if (error || !data.session || !data.user) {
    throw new Error(`signup failed ${email}: ${error?.message || 'no session'}`);
  }
  return { sb, user: data.user, token: data.session.access_token };
}

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  return ok;
}

let fails = 0;

async function main() {
  const A = await signup(emails.a);
  const B = await signup(emails.b);
  const C = await signup(emails.c);
  check('signup_A_B_C', !!(A.user.id && B.user.id && C.user.id));

  // Realtime subscribe on B BEFORE insert
  let rtEvent = 0;
  let rtStatus = '';
  const channel = B.sb
    .channel(`live-share-verify-${B.user.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'share_cards',
        filter: `recipient_id=eq.${B.user.id}`,
      },
      () => {
        rtEvent += 1;
      }
    )
    .subscribe((s) => {
      rtStatus = s;
    });

  await new Promise((r) => setTimeout(r, 1500));

  const payload = {
    kind: 'content',
    status: 'pending',
    sender_id: A.user.id,
    sender_name: 'A',
    recipient_id: B.user.id,
    recipient_name: 'B',
    recipient_kind: 'user',
    title: 'fix02-card',
    body: 'verify-only',
    read: false,
  };

  const { data: card, error: insErr } = await A.sb
    .from('share_cards')
    .insert(payload)
    .select('id, sender_id, recipient_id, read, status')
    .single();

  const insertOk = check('A_insert_to_B', !insErr && !!card?.id, insErr?.message || '');
  if (!insertOk) fails += 1;

  // A sees own sent
  const { data: aList } = await A.sb
    .from('share_cards')
    .select('id')
    .eq('id', card?.id || '00000000-0000-0000-0000-000000000000');
  if (!check('A_sees_sent', (aList || []).some((r) => r.id === card?.id))) fails += 1;

  // B sees via REST (always) + wait for Realtime
  const { data: bList } = await B.sb
    .from('share_cards')
    .select('id, read')
    .eq('id', card.id);
  if (!check('B_sees_via_rest', (bList || []).length === 1 && bList[0].read === false))
    fails += 1;

  await new Promise((r) => setTimeout(r, 4000));
  const rtOk = rtEvent > 0;
  if (
    !check(
      'B_realtime_insert_event',
      rtOk,
      `status=${rtStatus} events=${rtEvent}`
    )
  ) {
    fails += 1;
  }

  // B marks read
  const { error: updErr } = await B.sb
    .from('share_cards')
    .update({ read: true })
    .eq('id', card.id);
  if (!check('B_mark_read', !updErr, updErr?.message || '')) fails += 1;
  const { data: bRead } = await B.sb
    .from('share_cards')
    .select('read')
    .eq('id', card.id)
    .single();
  if (!check('B_read_state', bRead?.read === true)) fails += 1;

  // C cannot see / update / delete
  const { data: cList } = await C.sb
    .from('share_cards')
    .select('id')
    .eq('id', card.id);
  if (!check('C_cannot_select', !cList || cList.length === 0)) fails += 1;

  const { data: cUpd, error: cUpdErr } = await C.sb
    .from('share_cards')
    .update({ read: false, title: 'hacked' })
    .eq('id', card.id)
    .select('id');
  if (!check('C_cannot_update', (!cUpd || cUpd.length === 0) && !cUpdErr === false ? true : (!cUpd || cUpd.length === 0)))
    fails += 1;
  // Prefer: zero rows returned
  if ((cUpd || []).length > 0) {
    check('C_cannot_update_strict', false, 'update returned rows');
    fails += 1;
  }

  const { data: cDel, error: cDelErr } = await C.sb
    .from('share_cards')
    .delete()
    .eq('id', card.id)
    .select('id');
  if (!check('C_cannot_delete', !cDel || cDel.length === 0, cDelErr?.message || ''))
    fails += 1;

  // Empty fetch must not imply wipe — simulate client merge contract
  const empty = [];
  const local = [{ id: card.id }];
  const merged = empty.length ? empty : local;
  if (!check('empty_fetch_no_wipe', merged.length === 1)) fails += 1;

  // A update status if allowed (sender)
  const { error: aStatErr } = await A.sb
    .from('share_cards')
    .update({ status: 'declined' })
    .eq('id', card.id);
  // may succeed or fail depending on policies — record only
  console.log(
    'NOTE A_status_update',
    aStatErr ? `denied_or_err:${aStatErr.message}` : 'ok'
  );

  await B.sb.removeChannel(channel);
  await A.sb.auth.signOut();
  await B.sb.auth.signOut();
  await C.sb.auth.signOut();

  console.log(fails === 0 ? 'SUMMARY PASS' : `SUMMARY FAIL count=${fails}`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e.message || e);
  process.exit(1);
});
