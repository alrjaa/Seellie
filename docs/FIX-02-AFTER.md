# FIX-02 — AFTER measurements (code-derived + verified builds)

Compared to `docs/FIX-02-BASELINE.md`. Version **1.0.74**.

## Poll-class requests / min (foreground, code-derived)

| Scenario | BEFORE | AFTER |
|----------|-------:|------:|
| Idle cloud user (profiles+forums) | ~7 | ~2 |
| Messages screen focused | ~31 | ~6 |
| Private space focused | ~19 | ~4 |

## Interval constants

| Domain | BEFORE | AFTER |
|--------|--------|-------|
| Profiles fallback | 15s always | **60s** + AppState pause |
| Forums fallback | 20s always | **60s** + AppState pause |
| Messages (follower focused) | 2.5s | **15s** + AppState pause |
| Private space | 5s always-on | **30s focus-scoped** + AppState pause |
| Share cards | none / login only | Realtime + **20s while ShareCards focused** |

## Other

| Metric | AFTER |
|--------|-------|
| In-flight locks | profiles, forums, messages, share cards, private reload |
| Generation gate | profiles sync |
| `fetchAllProfilesResult` | distinguishes fail vs empty |
| `mergeUsersPreferCloud([])` | returns local unchanged |
| Share cards Realtime | client wired; needs `SHARE-CARDS-REALTIME.sql` on project |
| Rerenders | **NOT MEASURED** (selective hooks added; still share one Context until deeper split) |
| Startup TTI | **NOT MEASURED** |
| Live network latency | **NOT MEASURED** |

## Builds / tests

| Check | Result |
|-------|--------|
| `tsc --noEmit` | PASS |
| `npm test` | PASS |
| `fix02-sync-unit` | PASS |
| `fix01-security-unit` | PASS |
| `expo export --platform web` | (see CI output this session) |
