# FIX-05 Phase 6 — sports-proxy REVIEW (no code change)

**Date:** 2026-08-13  
**Rule:** Review only. No Edge Function / SQL / secrets edits in FIX-05.

## Invoke paths

| Client | Path |
|--------|------|
| `src/services/sports-data/api-football-edge-provider.ts` | `POST ${SUPABASE_URL}/functions/v1/sports-proxy` with **anon** `Authorization` + `apikey` |
| Same file | `sb.functions.invoke('sports-proxy', { body })` fallback |

Body shape: `{ resource, leagueId?, forceSync?, season? }` — **no `user_id`**, **no client URL**.

## Server (`supabase/functions/sports-proxy/index.ts`)

| Check | Finding |
|-------|---------|
| Auth of end-user JWT | **Not verified** — handler does not call `getUser` / role checks |
| Authorization server-side | Service role used only via `adminClient()` for sports store tables |
| Client can change another user's data | **No** — no user-scoped tables in request path |
| SSRF | **No** — upstream fixed `https://v3.football.api-sports.io` |
| Client-supplied URL | **No** |
| `service_role` in client bundle | **No** (Deno env only; prior prod scan 0) |
| Error leakage | `safeError(code)` — opaque codes |
| Rate limiting | **Not present** in function |

## Resources callable with anon key

`health`, `window`, `topscorers`, `bundle`, `sync_league`, `sync_topscorers`, `sync_all`

`sync_*` burn upstream `API_FOOTBALL_KEY` quota when configured.

## Classification

| Severity | Verdict |
|----------|---------|
| User-data IDOR / secrets exposure | **Not confirmed** |
| Quota / cost abuse via anon `sync_*` | **REVIEW / FOLLOW-UP** — product/security decision: require authenticated user or admin role + rate limit |
| FIX-05 action | **KEEP** — document only; **no automatic Edge change** |

## SECURITY BLOCKER?

**No.** No proven user-data breach, SSRF, or client secret exposure.  
Quota abuse is operational risk → deferred (not FIX-05 safe auto-fix).
