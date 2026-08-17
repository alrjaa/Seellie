# Seellie Supabase Migrations (FIX-01)

Ordered, versioned checklist. Run in Supabase SQL Editor (or CLI) **once per environment**.
All listed scripts are written to be **idempotent** where possible (`if not exists`, `drop policy if exists`, `create or replace`).

## Order (deterministic)

| # | File | Depends on | Destructive? | Purpose |
|---|------|------------|--------------|---------|
| 01 | `schema.sql` | — | No | Base tables, storage bucket `share-media`, core RLS |
| 02 | `sync-profiles-from-auth.sql` | 01 | No | Auth → profiles sync |
| 03 | `messages.sql` | 01 | No | Messages |
| 04 | `competition-requests.sql` | 01 | No | Competition requests |
| 05 | `competitions-delete-policy.sql` | 01 | No | Competition delete RLS |
| 06 | `competition-requests-delete-policy.sql` | 04 | No | Request delete RLS |
| 07 | `competition-requests-admin-fix.sql` | 04 | No | Admin request fixes |
| 08 | `APP-BLOBS.sql` | 01 | No | App blobs |
| 09 | `CONTENT-CLOUD.sql` | 01 | No | Content + storage policies |
| 10 | `CONTENT-CLOUD-RPC.sql` | 09 | No | Content RPCs |
| 11 | `private-space.sql` | 01 | No | Private space |
| 12 | `private-space-friends-fix.sql` | 11 | No | Friends fix |
| 13 | `private-space-dm-sync.sql` | 11 | No | DM sync |
| 14 | `PRIVATE-DM-FIX.sql` | 11 | No | DM fix |
| 15 | `PRIVATE-DM-MEDIA.sql` | 11 | No | DM media |
| 16 | `forum-comments.sql` | 01 | No | Forum comments |
| 17 | `SECURITY-PHASE1.sql` | 01–16 | No | Hardening phase 1 |
| 18 | `SECURITY-PHASE2-BLOBS.sql` | 17 | No | Blobs policies |
| 19 | `SECURITY-PHASE3-REFEREES.sql` | 18 | No | Referees |
| 20 | `SECURITY-HARDENING.sql` | 17 | No | Extra policies |
| 21 | `SECURITY-PHASE4-HARDENING.sql` | 17–20 | No | Phase 4 + storage size |
| 22 | `SECURITY-PHASE4-ACCOUNT-ACTIVE-FIX.sql` | 21 | No | Active account |
| 23 | `SECURITY-PHASE4-REFEREES-REPLACE.sql` | 21 | No | Referees replace |
| 24 | `SET-PROFILE-ANALYST.sql` | 01 | No | `set_profile_analyst` RPC |
| 25 | `PROFILES-REALTIME.sql` | 01 | No | Realtime publication |
| 26 | **`FIX-01-ANALYST-SECRETS.sql`** | 21, 24 | **Non-destructive migrate** | Move `accessCode` out of `profiles.content` |
| 27 | `FIX-01-STORAGE-ORPHAN-NOTES.sql` | 09 | No | Storage delete docs + MIME allowlist note |
| 28 | `ADMIN-PURGE-USER.sql` | 01 | Yes (admin purge) | Admin user purge |
| 29 | `sports-data.sql` / seeds | optional | No | Sports catalog |
| 30 | **`SHARE-CARDS-REALTIME.sql`** (FIX-02) | 01 | No | Add `share_cards` to `supabase_realtime` (RLS still applies) |
| 31 | **`FIX-08-HARDENING.sql`** (FIX-08) | 21–23 | No | Offer accept auth · gift integrity · referee organizer/admin gate |
| 32 | **`F13-P1-PRIVATE-MESSAGES-RLS.sql`** (F13-P1) | 12–15, 21 | No | private_messages INSERT: own inbox only + friendship; peer copy via SECURITY DEFINER RPC only |

## Manual / ops (not schema)

- `promote-admin.sql`, `set-admin-password.sql`, `FIX-admin-login.sql`, `who-is-admin.sql`
- `FREE-EMAIL-FOR-SIGNUP.sql`, diagnose scripts

## Verification after FIX-01

```sql
-- accessCode must be absent from public content
select count(*) as leaked
from profiles
where content #>> '{analyst,accessCode}' is not null;

-- secret table populated for approved analysts that had codes
select count(*) from analyst_access_codes;

-- RPCs exist
select proname from pg_proc
where proname in (
  'set_analyst_access_code',
  'get_own_analyst_access_code',
  'admin_get_analyst_access_code',
  'verify_and_activate_analyst',
  'set_profile_analyst'
);
```

## LIVE SUPABASE VERIFICATION REQUIRED

This repo cannot confirm the live project schema without dashboard/CLI credentials.
After running migrations, compare policies/tables with this checklist.
