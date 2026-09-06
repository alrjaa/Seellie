# REMEDIATION_REPORT_P2 — Pre-Production Hardening

**Date:** 2026-09-06  
**Repo:** `alrjaa/Seellie`  
**Branch:** `fix/p2-preprod-hardening-2026-09-06`  
**Base:** `main` @ `e7a7159`  
**App version:** `1.0.178` / Android `versionCode` `176`

## Implemented FIX IDs

| ID | Status | Summary |
| --- | --- | --- |
| FIX-05 | Done | Supabase Auth `flowType: 'pkce'` on all platforms; expanded CSP headers in `vercel.json` |
| FIX-09 | Done | DB trigger blocks non-admin self-add of `organizer`/`freelancer`; client toasts + RolePath copy |
| FIX-13 | Done | Documented Core/Live split; migrated competitions/matches + organizer home to Core/Live hooks |
| FIX-15 | Partial | Safe `npm audit fix --omit=dev` + Playwright; remaining highs need Expo 57 (`audit fix --force`) — not applied |
| FIX-16 | Done | Playwright suite `e2e/critical-flows.spec.ts` + `npm run test:e2e` |

## Files changed (P2)

- `src/services/supabase.ts` — PKCE
- `vercel.json` — CSP
- `supabase/P2-RBAC-SECONDARY-ROLE-GUARD.sql` — RBAC trigger
- `src/providers/TournamentProvider.tsx` — elevation denial messaging
- `src/components/account/RolePathCard.tsx` — admin-grant copy
- `src/i18n/locales/ar.ts`, `en.ts` — RBAC / path strings
- `src/screens/follower/CompetitionsScreen.tsx`, `MatchesScreen.tsx`
- `src/screens/organizer/HomeScreen.tsx` — Core + Live isolation
- `src/providers/tournament/README.md`
- `e2e/critical-flows.spec.ts`, `playwright.config.ts`, `package.json`, `package-lock.json`
- `supabase/functions/sports-proxy/index.ts`, `send-email/index.ts` — CORS allowlist (see exception)
- `app.config.ts` — version bump
- `.gitignore`, `tsconfig.json`
- Commerce modules restored for tsc (pre-existing `main` imports) — see exceptions

## Security before / after

| Area | Before | After |
| --- | --- | --- |
| Web auth flow | Implicit on web | PKCE all platforms |
| CSP | Thin / limited directives | Explicit `default-src`, `script-src`, `connect-src` (Supabase/Firebase/sports), `frame-ancestors 'none'` |
| Secondary roles | Follower could self-write `organizer`/`freelancer` via profile update | Trigger `profiles_guard_secondary_roles_trg` raises `secondary_role_elevation_denied` unless `is_app_superadmin()` |
| Edge CORS | `Access-Control-Allow-Origin: *` on sports-proxy / send-email | Allowlist reflect (`www.seellie.com`, ads/admin, local Expo) |
| npm audit (omit=dev) | ~35 | **33** (23 moderate / 10 high) — Expo 54 transitively pinned |

**Live applied (project `sjfkdipgvivomllpfnkt`):**
- SQL `P2-RBAC-SECONDARY-ROLE-GUARD.sql` — trigger verified present
- Edge deploy: `sports-proxy`, `send-email`

## Performance before / after

| Area | Before | After |
| --- | --- | --- |
| Tournament consumers | Most screens used merged `useTournament()` (re-render on message/comment churn) | Competitions + Matches use `useTournamentCore()`; organizer home splits Core vs Live |
| Provider structure | Core/Live contexts already present, low adoption | Documented in `src/providers/tournament/README.md` + targeted migrations |

Full 7k-line provider file split deferred (high regression risk); isolation is via context subscription, not file split.

## E2E evidence (FIX-16)

Command: `npm run test:e2e` against `https://www.seellie.com`  
Browsers: Chromium (Playwright)

| Test | Result |
| --- | --- |
| web shell loads | **PASS** |
| login route is reachable | **PASS** |
| admin portal route is reachable | **PASS** |
| follower login + home | **SKIP** (`E2E_FOLLOWER_*` unset) |
| organizer login + dashboard | **SKIP** (`E2E_ORGANIZER_*` unset) |
| admin login + console | **SKIP** (`E2E_ADMIN_*` unset) |

**Matrix summary:** 3 passed / 3 skipped / 0 failed

To run authenticated multi-role rows:

```bash
E2E_FOLLOWER_EMAIL=... E2E_FOLLOWER_PASSWORD=... \
E2E_ORGANIZER_EMAIL=... E2E_ORGANIZER_PASSWORD=... \
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
npm run test:e2e
```

## Validation (mandatory)

| Check | Result |
| --- | --- |
| `npm ci` | PASS |
| `npx tsc --noEmit` | PASS on working tree with local untracked commerce modules (pre-existing `main` gap); not part of this PR commit |
| `npm test` | PASS |
| `npm run build:web` | PASS |
| `npm audit --omit=dev` | 33 vulns remaining (10 high) |
| `npm run test:e2e` | 3 pass / 3 skip |

## Exceptions (P0/P1 + other)

1. **P1 FIX-06 CORS** brought into P2 Edge deploy so runtime matches “latest policies” prerequisite. Documented as compatibility exception; full P1 branch still separate.
2. **P0/P1 branches not merged** into this branch (`main` still lacks profiles lockdown / MIME hardening / CommerceMonitor null-fix unless merged separately).
3. **Commerce modules** referenced by existing `main` screens (`WalletScreen`, `CertificatesScreen`, …) remain incomplete on `main` / this PR (left untracked). Local validation restored them temporarily for `tsc`; clean checkout shares the pre-existing gap with `main`.
4. **FIX-15** did **not** run `npm audit fix --force` (would pull Expo 57 breaking change).

## Remaining risks

- P0 open `profiles` SELECT / local demo auth still on production until P0 merges.
- CSP still allows `'unsafe-inline'` / `'unsafe-eval'` (required by Expo web today).
- 10 high npm advisories remain behind Expo upgrade.
- Authenticated E2E roles not executed in this run (no credentials in CI env).
- Local-only secondary role enable still possible when Supabase is not configured (demo path).
- Organizer/freelancer grant UX is deny + messaging; no formal “request ticket” workflow yet.

## Go / No-Go for production

### **NO-GO** for production merge of P2 alone.

**Conditions to reach GO:**

1. Merge **P0** (profiles lockdown + demo auth gate) with live verify still green.
2. Merge **P1** (MIME/upload + remaining stability) and confirm Edge CORS on all sensitive functions.
3. Re-run authenticated E2E with follower/organizer/admin credentials (all three PASS).
4. Plan Expo 54→57 (or accepted risk register) for remaining high vulns.
5. Confirm production Supabase has `profiles_guard_secondary_roles_trg` (applied on linked staging/test `sjfkdipgvivomllpfnkt`; re-apply on prod if distinct).

**P2 alone is TEST_READY** for hardening review, not sufficient for production cutover.
