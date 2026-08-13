# FIX-02 Closure — Preflight + Blocking Status

## Preflight (executed)

| Item | Value |
|------|--------|
| Branch | `main` |
| Checkpoint | `fix02-closure-preflight` = `0f01d6a` |
| Prior | `fix02-sync` = `ae65662`, `fix02-baseline` = `b24e03d` |
| App version | 1.0.74 |
| package.json version | 1.0.0 |
| Expo SDK | 54 (`expo ~54.0.0`) |
| Supabase ref | `sjfkdipgvivomllpfnkt` |
| Last SQL applied this session | **NONE** — Database URI not provided |
| tsc | PASS |
| unit / fix01 / fix02 units | PASS |
| web export | PASS |

## SHARE-CARDS-REALTIME

SQL reviewed: non-destructive, idempotent via `pg_publication_tables`, does not touch RLS.

**Live Realtime probe (2026-08-13):**
- Channel status: `SUBSCRIBED`
- INSERT events received by B: **0**
- Conclusion: `public.share_cards` is **not** in `supabase_realtime` publication (or events not delivered).

**Apply blocked:** no `SEELLIE_DATABASE_URL` / dialog cancelled twice; `psql` not installed locally.

### To unblock (manual)

1. Open Supabase SQL Editor for project `sjfkdipgvivomllpfnkt`.
2. Paste and run `supabase/SHARE-CARDS-REALTIME.sql`.
3. Verify:
   ```sql
   select * from pg_publication_tables
   where pubname='supabase_realtime' and tablename='share_cards';
   ```
4. Re-run: `node scripts/live-fix02-sharecards.mjs`
   Expect: `PASS B_realtime_insert_event`.

## A→B→C (API live)

| Check | Result |
|-------|--------|
| A insert → B | PASS |
| A sees sent | PASS |
| B REST inbox + unread | PASS |
| B Realtime event | **FAIL** (blocker) |
| B mark read | PASS |
| C select/update/delete | PASS |
| Empty fetch no wipe | PASS |
