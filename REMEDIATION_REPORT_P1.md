# REMEDIATION_REPORT_P1.md

**Branch:** `fix/p1-stability-security-2026-09-06`  
**Base:** `main` @ `e7a7159`  
**Date:** 2026-09-06  
**Scope:** FIX-10, FIX-12, FIX-06, FIX-07 only (no P2)

---

## FIX IDs

| ID | Status | Summary |
|---|---|---|
| FIX-10 | Done | `CommerceMonitorScreen` `certName` accepts `string \| null` |
| FIX-12 | Done | Removed fail-open `profiles.update` fallback after RPC failure |
| FIX-06 | Done | Edge CORS allowlist (no `*`) on sports-proxy, send-email, verify-store-purchase |
| FIX-07 | Done | Reject empty / `octet-stream` MIME; allowlist jpeg/png/webp/mp4/webm/quicktime |

---

## Files modified

| File | FIX |
|---|---|
| `src/screens/superadmin/CommerceMonitorScreen.tsx` | FIX-10 (added to repo) |
| `app/admin/(console)/commerce-monitor.tsx` | FIX-10 route |
| `src/services/supabase-user-content.ts` | FIX-12 |
| `src/services/supabase-storage.ts` | FIX-07 |
| `supabase/functions/sports-proxy/index.ts` | FIX-06 |
| `supabase/functions/send-email/index.ts` | FIX-06 |
| `supabase/functions/verify-store-purchase/index.ts` | FIX-06 (added with allowlist CORS) |
| `REMEDIATION_REPORT_P1.md` | This report |

---

## Validation results

| Check | Result |
|---|---|
| `npm ci` | PASS (exit 0) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npm test` | PASS (exit 0) |
| `npm run build:web` | PASS — exported `dist/` (web JS ~4.39 MB main bundle) |
| `npm audit --omit=dev` | 35 vulnerabilities (24 moderate, 11 high) — unchanged, not in P1 scope |

---

## Remaining risks (not fixed in P1)

- P2: TournamentProvider size, E2E, lint script, npm audit upgrades  
- P1 deferred earlier list items already done here; web PKCE/CSP (FIX-05) still open  
- Edge functions must be **redeployed** for FIX-06 to take effect in production/staging runtime  
- Storage bucket Dashboard MIME allowlist still recommended (client-only FIX-07)  
- Local untracked commerce WIP (`CommerceProvider`, IAP modules) may still exist on developer machines — not part of this PR except Monitor screen

---

## Deploy note for FIX-06

```bash
supabase functions deploy sports-proxy
supabase functions deploy send-email
supabase functions deploy verify-store-purchase
```
