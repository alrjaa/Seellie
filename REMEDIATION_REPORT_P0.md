# REMEDIATION_REPORT_P0.md

**Branch:** `fix/p0-security-remediation-2026-09-06`  
**Base / audit head:** `e7a7159`  
**Scope:** FIX-01, FIX-02, FIX-03, FIX-04 + **live SQL applied & verified**

---

## Live verification result (CLOSED)

| Field | Value |
|---|---|
| **P0 status** | **CLOSED** |
| **Environment** | staging/test |
| **Project ref** | `sjfkdipgvivomllpfnkt` (Seellie, ap-south-1) |
| **Verified at** | `2026-09-06T19:27:11.055Z` |
| **Apply method** | `supabase db query --linked -f supabase/P0-PROFILES-SELECT-LOCKDOWN.sql` |
| **Verify command** | `npx tsx scripts/p0-verify-profiles-lockdown.ts` → **exit 0 / pass: true** |

### Evidence (authenticated follower JWT)

- `profiles_catalog`: HTTP **200**, row_count **5** (no email/mobile columns)
- `profiles?select=id,email,mobile`: HTTP **200**, **foreign_emails_visible: 0** (only own row)
- Anon catalog: **401** permission denied (expected)
- Policies on `profiles` SELECT: `profiles_select_own_or_admin` = `(id = auth.uid()) OR is_app_superadmin()` (+ existing `profiles_select_admin`)

### Apply note

First apply attempt failed with:
`ERROR 42P16: cannot change name of view column "created_at" to "content"`  

**Cause:** existing `profiles_catalog` column order differed; `CREATE OR REPLACE VIEW` cannot rename/reorder columns.  

**Corrective action:** `DROP VIEW IF EXISTS public.profiles_catalog CASCADE` then recreate (updated in SQL file). Re-apply succeeded.

---

## FIX IDs executed

| ID | Status |
|---|---|
| FIX-01 Restrict profiles SELECT / stop email-mobile leak | **Closed (client + live SQL)** |
| FIX-02 Disable published seed credential login | **Implemented** |
| FIX-03 + FIX-04 Cloud auth without local hash persistence | **Implemented** |
| Live Supabase SQL apply | **Applied & verified on staging/test** |

---

## Files changed

| File | Change |
|---|---|
| `supabase/P0-PROFILES-SELECT-LOCKDOWN.sql` | Catalog recreate + `profiles_select_own_or_admin` |
| `supabase/migrations/20260906220000_p0_profiles_select_lockdown.sql` | Migration mirror |
| `supabase/schema.sql` | Replace open `using (true)` select policy |
| `src/services/supabase-auth.ts` | No bulk owner-column fetch for non-admins; safe `fetchProfile` |
| `src/utils/demo-auth.ts` | `allowLocalDemoAuth()` |
| `src/utils/user-persistence.ts` | Strip verifiable hashes for cloud/published |
| `src/providers/TournamentProvider.tsx` | Gate local login/signup/password; sanitize persistence |
| `.env.example` | Document demo-auth flag |
| `scripts/p0-verify-profiles-lockdown.ts` | Live anon + authenticated follower checks |
| `REMEDIATION_REPORT_P0.md` | This report |

---

## Validation results

| Check | Result |
|---|---|
| Live SQL apply | **PASS** |
| `npx tsx scripts/p0-verify-profiles-lockdown.ts` | **PASS** (`pass: true`) |
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS |

---

## Risks closed (P0)

1. Server RLS blocks peer email/mobile SELECT.  
2. Client no longer mass-downloads PII for ordinary users.  
3. Published builds cannot use seed `password123` local fallback.  
4. Cloud/published sessions do not persist crackable local hashes.

## Remaining (P1/P2)

See P1 branch for FIX-10 / FIX-12 / FIX-06 / FIX-07.
