# FIX-02 — Performance / Sync Baseline (BEFORE changes)

Generated: 2026-08-13 · version **1.0.73** · No code changes yet

## A. TournamentProvider

| Metric | Baseline |
|--------|----------|
| File size | 6,296 lines · ~192KB |
| States | 21 `useState` |
| Effects | 9 |
| Provider intervals | Profiles **15s**, Forums **20s** |
| Realtime (session) | profiles, messages, forums, competitions, competition_requests |
| Main consumer rerenders | **NOT MEASURED** (instrumentation not in baseline run) |

## B. Profiles — `fetchAllProfiles()`

| Metric | Baseline |
|--------|----------|
| Query | `profiles` select public columns · `.limit(500)` |
| Location | `supabase-auth.ts` |
| Polling | **every 15s** while cloud UUID session (`syncCloudUsers`) |
| Realtime | Yes — merges **single** remote user; still also full poll |
| Both together? | **Yes** |
| Response size / latency | **NOT MEASURED** (live network not instrumented this pass) |
| Overlap guard | **None** — ticks can stack |

### Estimated request rate (code-derived)
- Idle cloud user: **4** full profile fetches / min (+ Realtime events)

## C. Messages

| Layer | Baseline |
|-------|----------|
| Realtime | Provider: INSERT `recipient_id=eq.user` |
| Polling | Follower `MessagesScreen` **2.5s while focused** |
| Focus reload | Yes (follower + other role screens one-shot) |
| Requests / min on messages screen | Realtime + **24** polls + profiles/forums ≈ **~31** poll-class / min |
| Duplicate fetches | Likely under focus + RT |
| Rerenders | **NOT MEASURED** |

## D. Private Space

| Layer | Baseline |
|-------|----------|
| Realtime | `private-space-${userId}` (messages + friends; not `private_saved`) |
| Polling | **5s always while hook mounted** (not focus-gated) |
| Focus | Extra `reload()` |
| AppState pause | **No** |
| In-flight guard | **No** |

## E. Arenas / competitions

| Domain | Baseline |
|--------|----------|
| Competitions | Realtime → **full pull** on change · **no** 20s poll |
| Forums (“arenas” comments) | Realtime + **20s** poll |
| Clarification | Audit “20s arenas” maps to **forum comments**, not `app_competitions` |

## F. Share Cards

| Mechanism | Baseline |
|-----------|----------|
| Realtime | **None** |
| Polling | **None** |
| Focus refresh | **None** on ShareCards UI |
| Fetch | Login / session restore only |
| UX gap | Recipient may not see new card until re-login |

## G. `mergeUsersPreferCloud`

| Scenario | Current behavior |
|----------|------------------|
| Empty cloud list | Callers usually **no-op** if `!cloudProfiles.length` — local kept |
| Failed fetch returns `[]` | Same as empty — **cannot distinguish failure vs truly empty** |
| Cloud partial (empty media/posts) | Keep non-empty local arrays |
| Local newer (non-empty cloud stale) | **Cloud wins** if cloud arrays non-empty — no version/timestamp |
| Reconnect | Same merge rules |
| Data loss risk | Stale non-empty cloud can overwrite fresher local; empty cloud does not wipe via length guard |

## H. Startup (inferred sequence)

1. LanguageReadyGate  
2. Local parallel AsyncStorage reads  
3. `restoreSupabaseSession`  
4. Background shareCards + messages fetch  
5. `loading=false`  
6. UUID → `hydrateCloudPublicCatalog` (profiles + comps + requests + forum + 6 blobs)  
7. Mount competitions RT; then messages/forums/profiles RT+poll  

| Metric | Baseline |
|--------|----------|
| Startup time / TTI | **NOT MEASURED** |
| Initial request fan-out | Auth + cards + messages + catalog (~10+ parallel cloud reads) |

## Steady-state poll estimate (foreground, code-derived)

| Scenario | Poll-class requests / min |
|----------|---------------------------:|
| Idle cloud user | ~7 (profiles 4 + forums 3) |
| Messages screen focused | ~31 |
| Private screen mounted | ~19 (+ messages if also focused stacks higher) |

Realtime events are **additional** and uncapped by these estimates.

## Security note

FIX-01 remains PASS entering FIX-02. Baseline must not regress accessCode / logout isolation / IDOR.
