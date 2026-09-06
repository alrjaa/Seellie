# REMEDIATION_REPORT_P0.md

**Branch:** `fix/p0-security-remediation-2026-09-06`  
**Base / audit head:** `e7a7159`  
**Generated:** 2026-09-06 (continuation)  
**Scope:** FIX-01, FIX-02, FIX-03, FIX-04 + SQL apply verification notes only

---

## FIX IDs executed

| ID | Status |
|---|---|
| FIX-01 Restrict profiles SELECT / stop email-mobile leak | **Implemented in client + SQL artifact** |
| FIX-02 Disable published seed credential login | **Implemented** |
| FIX-03 + FIX-04 Cloud auth without local hash persistence | **Implemented** |
| Live Supabase SQL apply | **SQL ready; requires manual paste in SQL Editor** (no `SERVICE_ROLE` in env) |

---

## Files changed

| File | Change |
|---|---|
| `supabase/P0-PROFILES-SELECT-LOCKDOWN.sql` | New: catalog view grants + `profiles_select_own_or_admin` |
| `supabase/migrations/20260906220000_p0_profiles_select_lockdown.sql` | Migration mirror |
| `supabase/schema.sql` | Replace open `using (true)` select policy |
| `src/services/supabase-auth.ts` | No bulk owner-column fetch for non-admins; safe `fetchProfile` for others |
| `src/utils/demo-auth.ts` | `allowLocalDemoAuth()` — published off unless `EXPO_PUBLIC_ALLOW_DEMO_AUTH=true` |
| `src/utils/user-persistence.ts` | Strip verifiable hashes for cloud/published |
| `src/providers/TournamentProvider.tsx` | Gate local login/signup/password; sanitize session persistence |
| `.env.example` | Document demo-auth flag |
| `scripts/p0-verify-profiles-lockdown.ts` | Read-only live probe helper |
| `REMEDIATION_REPORT_P0.md` | This report |

---

## Before / after

### FIX-01 (PII via profiles)

| Before | After |
|---|---|
| RLS `profiles_select_authenticated` `using (true)` | Policy `profiles_select_own_or_admin` (self or superadmin) |
| `fetchAllProfilesResult` merged up to 500 owner rows (email/mobile) for any session | Catalog for everyone; owner columns only for self, or bulk only if caller is superadmin |
| `fetchProfile(otherId)` selected owner columns first | Others → catalog (no email/mobile) unless caller is superadmin |

### FIX-02 (seed passwords)

| Before | After |
|---|---|
| Local `password123` login when cloud auth failed if `__DEV__` | Published builds: no local seed login unless explicit `EXPO_PUBLIC_ALLOW_DEMO_AUTH=true` |
| Seeds always hashed into runtime `users[]` | Published: seed `passwordHash` forced to `'supabase'` (non-verifiable locally) |

### FIX-03 / FIX-04 (local hash / storage)

| Before | After |
|---|---|
| UUID users stripped to `'supabase'`; non-UUID demo hashes persisted | All published / cloud paths persist `'supabase'` only via `sanitizeUserForPersistence` |
| Local signup/password change always available | Local signup / local password change blocked when demo auth disallowed |

---

## Live Supabase verification

**Probe (anon key, read-only):**

```text
profiles_catalog (anon): 401 permission denied for view (expected until grants applied for authenticated; anon correctly denied)
profiles table (anon): 200 [] (no rows to anon)
is_app_superadmin RPC: 200 false
```

**Required operator step (cannot automate without service role):**

1. Open Supabase SQL Editor for the test project.  
2. Paste and run `supabase/P0-PROFILES-SELECT-LOCKDOWN.sql`.  
3. Confirm policies:

```sql
select pol.polname from pg_policy pol
join pg_class rel on rel.oid = pol.polrelid
where rel.relname = 'profiles' and pol.polname like 'profiles_select%';
-- expect: profiles_select_own_or_admin
```

4. As a **follower** JWT: `select email, mobile from profiles` must not return other users.  
5. As follower: `select id, name from profiles_catalog` must work.  
6. Re-run: `npx tsx scripts/p0-verify-profiles-lockdown.ts`

**Also confirm prior phases still present:** `is_app_superadmin` RPC responds (verified). Apply/re-check PHASE4 / FIX-09 if not already on the project (out of code change scope; operational checklist).

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** (0) |
| `npm test` | **PASS** |
| `npm run build` | **N/A** (no `build` script; use `build:web` for export) |
| `npm audit --omit=dev` | **35 vulns** (24 moderate, 11 high) — unchanged; P1/P2 |
| `npm ci` | Run on clean CI; local tree had pre-existing WIP noise |

---

## Risks closed (P0)

1. Client no longer mass-downloads emails/mobiles for ordinary users.  
2. Published builds cannot login with seed `password123` via local fallback.  
3. Cloud/published sessions do not persist crackable local password hashes.  
4. SQL artifact ready to enforce server-side SELECT lockdown.

## Remaining (not done — P1/P2)

- Apply SQL on live project if not yet pasted (operator).  
- Web PKCE + full CSP, Edge CORS, storage MIME (P1).  
- TournamentProvider split, E2E, lint script, npm audit force upgrades (P2).  
- Organizer self-role policy product decision (P1).

---

## Acceptance mapping

1. **No user reads another’s sensitive profile fields** — client enforced; server enforced after SQL apply.  
2. **No published login path uses demo credentials** — enforced via `allowLocalDemoAuth()`.  
3. **Cloud auth is identity-provider only** — local hash path gated off when published.  
4. **Security SQL stages** — P0 lockdown file provided; live apply must be confirmed in Dashboard.
