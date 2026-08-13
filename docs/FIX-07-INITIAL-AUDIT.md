# FIX-07 INITIAL AUDIT

**Date:** 2026-08-14  
**Mode:** READ / INSPECT / ANALYZE / TEST / CLASSIFY / DOCUMENT only  
**Rule:** No app code, SQL, RLS, Auth, Realtime, Storage, Edge, design, version, or deploy changes in this phase.

---

## Version

| Field | Value |
|-------|-------|
| App version | `1.0.76` |
| versionCode | `74` |
| Local HEAD | `d8da81d` (`FIX-06-SAFE-FIXES`) |
| FIX-07 baseline tag | `FIX-07-BASELINE` → `d8da81d` |
| Production commit (deploy repo) | `4b5ea78` (`source d8da81d`) |
| Production URL | https://www.seellie.com |
| Production bundle | `index-bb133f9255df339de8e9f463f1cfed97.js` |
| Production deployment | `dpl_EtisHFS5CvFtCHPtNRXY5jPLSdAt` |

---

## Git Baseline

| Check | Result |
|-------|--------|
| Branch | `main` |
| `git rev-parse HEAD` | `d8da81d6f7d98ff69c60d053116d29bd5508d2f5` |
| Working tree | Clean tracked files; only untracked `docs/FIX-03-PRODUCTION-FOLLOWUP.md` (pre-existing) |
| `FIX-06-BASELINE` | `bfc107c` |
| `FIX-06-SAFE-FIXES` | `d8da81d` |
| `FIX-07-BASELINE` | **created** at `d8da81d` (tag only; no code change) |
| Deploy repo `Seellie` HEAD | `4b5ea78` — release claims source `d8da81d` |

**Provenance chain (accepted from FIX-06 Production closure):**  
`d8da81d` → deploy `4b5ea78` → `dpl_EtisHFS5…` → HTML → `index-bb133f9255df339de8e9f463f1cfed97.js`

---

## Production State

| Item | Status |
|------|--------|
| Live URL | https://www.seellie.com |
| Bundle | `index-bb133f9255df339de8e9f463f1cfed97.js` (FIX-06; FIX-05 `index-1bbcf928…` absent) |
| Secrets scan (prod bundle) | accessCode JSON=0, service_role=0, JWT-like=0 |
| Redeploy this phase | **Not performed** (forbidden) |
| UI stamp observed | `1.0.76 · 4b5ea78` (prior production verification) |

---

## Scope

**In scope for classification:** residual risks after FIX-01…06 closed; inventory; regressions; product/architecture deferrals.

**Out of scope / STOP:** implementing safe fixes; TournamentProvider split; expo-video migration; Firebase deletion; Edge auth/rate-limit without product approval; Auth/RLS/Realtime redesign; Production redeploy; FIX-08.

---

## Application inventory (summary)

### Routes / roles
- **Auth:** `/(auth)/login`, `/(auth)/reset-password`, `/admin`
- **Follower:** home, private, messages/chat, general/personality/highlights, competitions/matches/players, content/analysis, settings/account, certificates
- **Organizer / freelancer:** parallel consoles (competitions, media, offers, messages, settings, …)
- **Shared:** forums, shares, share-cards, unique, search, notifications, legal
- **Admin console:** users, competitions, requests, analysts, invoices, emails, discussions, …

### Providers
`AppProviders` → Language, Theme, NavigationCairo, Toast, Notifications, **TournamentProvider** (god-context).

### Hooks
`usePrivateSpace`, `useNationalLeague`, `useListChrome`, `useFloatingVisibility`, `useResponsive`, `useSaveToPrivateSpace`.

### Realtime channels (8+)
profiles, forum-comments, messages-inbox, competitions, share-cards, competition-requests, app-blobs, private-space.

### Polling fallbacks
forums/profiles 60s; messages 15s; share cards 20s; private space 30s; OfflineBanner 15s.

### Edge functions
`sports-proxy`, `send-email`.

### Media
`expo-av` Video in PrivateScreen, PrivateChatComposer, ForumsScreen, InlineVideoPlayer, FullScreenFeed (unload present on primary players).

### Storage keys
User-scoped + logout CLEAR/KEEP sets (`tajjd.secure.currentUser`, messages, shareCards, notifications, privateSpace, competitions, …).

---

## P0 Findings

**P0 = 0**

No proven data-loss wipe on ERROR, auth bypass, cross-user exposure, service_role in client, or production-breaking crash in this audit’s regressions.

| ID | Summary | Evidence |
|----|---------|----------|
| — | — | FIX-01 live PASS; FIX-02 security-merge PASS; prod secrets hits=0 |

---

## P1 Findings

**P1 = 2**

| ID | Domain | Summary | Evidence | Safe? | Product? |
|----|--------|---------|----------|-------|----------|
| **F07-P1-01** | Security/Ops | `sports-proxy` accepts **anon** Bearer; client still invokes `sync_league` / sync paths that burn upstream API quota | `api-football-edge-provider.ts` Authorization anon + `sync_league`; Edge lacks `getUser`/rate-limit (`docs/FIX-05-SPORTS-PROXY-REVIEW.md`) | Edge-only after approval | **YES** |
| **F07-P1-02** | Architecture / Perf | `TournamentProvider` remains a single god-context; any Realtime/poll tick can amplify broad UI work | Provider size + consumer surface; FIX-02/05/06 deferred split | Partial deps only | Full split = **YES** |

---

## P2 Findings

**P2 = 7**

| ID | Domain | Summary | Evidence | Safe? | Product? |
|----|--------|---------|----------|-------|----------|
| **F07-P2-01** | Media / Lists | Private **chat** video thumbs: `shouldPlay={inView}` + `isLooping` inside non-virtualized `chatMessages.map` / ScrollView | `PrivateScreen.tsx` ~290, ~1509 | Partial (pause/static thumbs) | FlatList = device QA |
| **F07-P2-02** | Lists | Unique feed renders filtered items via `.map` inside scrolling Screen (no FlatList) | `UniqueScreen` filtered.map | After QA | **YES** |
| **F07-P2-03** | A11y | Messages screens ~0 accessibilityLabels on Pressables; Admin large gap; Share modal partial | Static counts (Messages ~10 miss; Admin ~35 miss) | YES targeted | NO |
| **F07-P2-04** | Sync | App blobs hydrate: `if (blobs.offers)` / `if (blobs.gifts)` — empty `[]` is truthy → **SUCCESS_EMPTY can replace** local offers/gifts (ERROR path returns `null` → safe) | `TournamentProvider.tsx` ~1046–1056; `fetchGlobalAppBlobs` null on error | YES (gate `.length` / ok) | Maybe semantics |
| **F07-P2-05** | Perf | ~32 `useCallback` deps still take full `currentUser` object (Realtime/poll already on `?.id` + refs from FIX-06) | `TournamentProvider` dependency audit | YES incremental | NO |
| **F07-P2-06** | Legacy | Firebase still packaged and used via `competition-sync.ts` / `firebase.ts` while cloud path is Supabase-primary | imports present | NO delete now | **YES** |
| **F07-P2-07** | UX / Lists | Nested ScrollViews (Private chat chips + messages; Unique outer scroll + map) | PrivateScreen nested; Unique Screen scroll | After QA | YES |

---

## P3 Findings

**P3 = 5**

| ID | Summary | Notes |
|----|---------|-------|
| **F07-P3-01** | Residual a11y (Private friend chip, Login extras, Unique terms toggles, Forums cards) | Targeted labels later |
| **F07-P3-02** | Lightbox / fullscreen Video `shouldPlay` with unload — intentional | Keep |
| **F07-P3-03** | Share/creq **SUCCESS_EMPTY** reconcile — documented product contract | Do not change without decision |
| **F07-P3-04** | Log string still says `[supabase] fetchAllProfiles` inside `fetchAllProfilesResult` | Cosmetics |
| **F07-P3-05** | FIX-02 Realtime occasional timing flake under ephemeral signup | Observe / retry; do not “fix” blindly |

---

## Security

| Area | Verdict |
|------|---------|
| FIX-01 live (accessCode, self-activate, IDOR, admin RPC, anon secrets, storage cross-user) | **PASS** |
| Client secrets in prod bundle | **PASS** (hits=0 for accessCode JSON / service_role / JWT-like) |
| sports-proxy user-data IDOR / SSRF | Not confirmed (prior review) |
| sports-proxy anon `sync_*` quota | **P1 FOLLOW-UP** (F07-P1-01) |
| Auth/RLS redesign | **STOP** — out of scope |

---

## Auth / Session

| Check | Status |
|-------|--------|
| Login / logout / restore | Working in prod smoke + prior FIX-06 production verification |
| Protected routes after logout | PASS (prior + this phase smoke) |
| sessionGen + user-switch gates | Intact (FIX-02 scripts PASS) |
| Session injection | **Not used** this audit |

---

## RLS

Not modified. Live FIX-01 / FIX-02 scripts continue to exercise deny paths. No new RLS defects proven.

---

## Storage

Cross-user upload/delete denied (FIX-01 live). Path isolation assumed unchanged since FIX-01 closure.

---

## Realtime

| Channel domain | Deps / cleanup notes |
|----------------|----------------------|
| Messages / share cards / forums / profiles | Effects use `currentUser?.id`; fallbacks via sync-engine |
| Logout / user switch | sessionGen + clear paths verified by FIX-02 merge script |
| Duplicate events | Share-cards live: `events=1` this run |
| Residual flake | F07-P3-05 observe |

---

## Data Integrity

| Contract | Status |
|----------|--------|
| ERROR ≠ EMPTY for competitions / messages / forums / share / creq (FIX-04/05) | **PASS** (units + live empty_fetch_no_wipe) |
| App blobs offers/gifts empty array replace | **P2** F07-P2-04 (SUCCESS_EMPTY sharpness; ERROR→null safe) |
| Logout clears user-scoped keys | PASS (FIX-02) |

---

## Sync / Reconciliation

- `shouldApplyCloudResult` / sister helpers remain the primary gate for forums/messages/competitions/share/creq.
- Intentional SUCCESS_EMPTY reconcile for share/creq remains a **product** edge (F07-P3-03).
- Blob hydrate lacks the same explicit length/ok discipline as referees (F07-P2-04).

---

## Performance

**PERFORMANCE = NOT MEASURED** (no TTI / FPS / heap / render-count instrumentation in this phase).

Qualitative risks:
- God-context (F07-P1-02)
- Non-virtualized Unique + Private chat lists (F07-P2-01/02/07)
- Chat video autoplay-in-view (F07-P2-01)
- Remaining full-`currentUser` callback churn (F07-P2-05)

---

## Context / Render Churn

FIX-06 narrowed `syncCompetitions` / `logout` / scoped memos. Residual ~32 callbacks still depend on full `currentUser` identity → rebuild on profile field updates without necessarily resubscribing Realtime.

---

## Media Lifecycle

| Surface | Status |
|---------|--------|
| Attach-grid thumbs | FIX-06: `shouldPlay={false}` + unload — **closed** |
| Chat thumbs in list | Autoplay when `inView` + loop — **P2** |
| Composer / Forums / Inline / FullScreen | unload present |
| expo-av → expo-video | **PRODUCT / ARCHITECTURE DECISION** — not started |

---

## Accessibility

| Area | Status |
|------|--------|
| Login / Toast / Private (FIX-05/06 targeted) | Strong coverage; AR+EN labels observed on prod Login |
| Messages / Admin / Share | Large residual gaps — **P2** |
| Unique / Forums residual | **P3** |

---

## RTL

Prod smoke: initial `dir=rtl` with Arabic UI.

---

## LTR

EN toggle → `dir=ltr`; reload keeps LTR.

---

## Responsive

Smoke viewports exercised this phase: 320 / 768 / 1440 (login visible, non-blank). Prior FIX-06 verification covered 320…1440 full set. No layout code changes this phase.

Full matrix **320 / 360 / 390 / 414 / 430 / 768 / 1024 / 1280 / 1440** not re-run exhaustively here → residual layout issues remain **NOT fully re-proven**; no new defects observed on sampled sizes.

---

## Navigation

Protected `/private` → login after logout (prior production proof). No new navigation defects found. Android `onRequestClose` / BackHandler: source-only; device **NOT TESTABLE**.

---

## Forms

Login wrong-password stays on login (prod smoke). Double-submit / loading forever: no new P0/P1 form hang proven; deeper form state machines not exhaustively re-walked this audit.

---

## Error Handling

Cloud result contracts largely hardened (FIX-04/05). Residual blob SUCCESS_EMPTY sharpness (F07-P2-04). Swallowed errors: console.warn patterns remain in hydrate paths (expected).

---

## Logging

No secret values printed in audit. Optional P3: rename misleading `fetchAllProfiles` warn prefix.

---

## Web

| Check | Result |
|-------|--------|
| `tsc --noEmit` | PASS |
| `npm test` | PASS |
| `expo export --platform web` | PASS (`Exported: dist`) |
| Prod interactive smoke (no injection) | PASS (login UI, wrong password, RTL/LTR, reload, sampled responsive) |

---

## Android

**NOT TESTABLE** — no `android/` project / adb / emulator in this environment.

---

## iOS

**NOT TESTABLE** — no `ios/` / Simulator in this environment.

---

## Production Provenance

| Link | Status |
|------|--------|
| Source `d8da81d` | Local HEAD + `FIX-07-BASELINE` |
| Deploy `4b5ea78` | Seellie repo tip; message cites source `d8da81d` |
| Deployment `dpl_EtisHFS5CvFtCHPtNRXY5jPLSdAt` | Ready; aliased to www |
| Bundle `index-bb133f9255df339de8e9f463f1cfed97.js` | Served by www HTML |

**Verdict:** Production provenance **PASS** (verify-only; no redeploy).

---

## FIX-01 Regression

**PASS** — live `pass=9 fail=0`; accessCode content hits 0; deny paths hold.

---

## FIX-02 Regression

**PASS** — Share Cards live SUMMARY PASS (`B_realtime_insert_event … events=1`); security-merge SUMMARY PASS.

---

## FIX-03 Regression

**PASS** — prod smoke: Login UI, wrong password, RTL/LTR, reload, responsive samples; prior full A/B logout isolation remains closed from FIX-06 production verification (not re-run full A/B login matrix this audit — no regression signal).

---

## FIX-04 Regression

**PASS** — competition-requests + share-cards unit contracts PASS.

---

## FIX-05 Regression

**PASS** — result-contracts unit PASS; prod bundle retains unload / a11y / result-contract lineage via FIX-06 content identity.

---

## FIX-06 Regression

**PASS** — source at `d8da81d`; prod bundle ≠ FIX-05; markers: `unloadAsync` present, `useTournamentSlices=0`, deprecated `fetchAllProfiles(` absent; attach-grid non-autoplay intact in source.

---

## Safe Fix Candidates

*(Candidates only — **not implemented**)*

| ID | Sev | File | Current | Expected | Evidence | Risk | Why safe | Regression | Rollback |
|----|-----|------|---------|----------|----------|------|----------|------------|----------|
| F07-S1 | P2 | `PrivateScreen.tsx` | Chat thumbs autoplay+loop in `.map` | Static/paused thumbs until explicit play; unload retained | `shouldPlay={inView}` | Low–med (UX of muted preview) | Behavior-preserving if play-on-tap | Private chat smoke | Revert component |
| F07-S2 | P2 | `TournamentProvider.tsx` | `if (blobs.offers/gifts)` applies `[]` | Apply only when `Array.isArray && length>0` or explicit ok+policy | ~1046–1056 | Low | Mirrors referees gate; ERROR already null | offers/gifts hydrate | Revert condition |
| F07-S3 | P2 | Messages / Share / Admin screens | Missing a11y labels | Targeted `accessibilityLabel={t(...)}` on icon controls | Static counts | Low | Same pattern as FIX-05/06 | a11y DOM smoke | Revert labels |
| F07-S4 | P2 | `TournamentProvider.tsx` | Full `currentUser` in many callback deps | Narrow to `id`/`role`/ref where values used are stable | ~32 deps | Low | Continues FIX-06 pattern | FIX-02 + login/logout | Revert deps |
| F07-S5 | P3 | `supabase-auth.ts` | Warn prefix `fetchAllProfiles` | Rename log to `fetchAllProfilesResult` | warn line | Trivial | Log-only | none | Revert string |

**Not safe without product/device:** FlatList for Unique/Private chat; sports-proxy Edge auth; Firebase delete; TournamentProvider split; expo-video.

---

## Product Decisions

| # | Decision | Blocks |
|---|----------|--------|
| 1 | Require user JWT + rate-limit on sports-proxy `sync_*`? | F07-P1-01 |
| 2 | Split TournamentProvider into multi-context? | F07-P1-02 |
| 3 | Migrate expo-av → expo-video? | Media architecture |
| 4 | Delete Firebase / firestore competition-sync path? | F07-P2-06 |
| 5 | Virtualize Unique + Private chat lists (FlatList/FlashList)? | F07-P2-01/02/07 |
| 6 | Change SUCCESS_EMPTY semantics for share/creq/blobs? | F07-P2-04 / P3-03 |

---

## Deferred Items

| Class | Items |
|-------|-------|
| A. Safe to fix in FIX-07 (later execution) | F07-S1…S5 candidates above |
| B. Needs product decision | sports-proxy auth; Firebase delete; SUCCESS_EMPTY policy; list strategy |
| C. Architecture change | TournamentProvider split; expo-video; FlashList/external store |
| D. Requires native device testing | Unique/Private FlatList QA; native video memory |
| E. Requires performance profiling | TTI/FPS/heap/render counts |
| F. Defer to later FIX | Auth/RLS/Realtime redesign; dependency major upgrades |

---

## STOP Items

1. Do **not** implement any Safe Fix in this phase.  
2. Do **not** modify SQL / RLS / Edge / Auth / Realtime.  
3. Do **not** redeploy Production from this audit.  
4. Do **not** start TournamentProvider split / expo-video / Firebase deletion.  
5. Do **not** start FIX-08 until an explicit FIX-07 execution command.

---

## NOT TESTABLE

| Item | Reason |
|------|--------|
| Android device / emulator matrix | No adb / android project |
| iOS Simulator matrix | No Simulator / ios project |
| Native video memory retention | Needs Instruments / device |
| Exhaustive every-form state machine walk | Not scheduled this audit |

---

## NOT MEASURED

| Item | Notes |
|------|-------|
| TTI | Not instrumented |
| FPS | Not instrumented |
| JS heap / native media memory | Not instrumented |
| React render counts | No durable profiler |
| Exact live subscription counts | Source-mapped only |

---

## Final Verdict

```
FIX-07 INITIAL AUDIT = COMPLETE

P0 = 0
P1 = 2
P2 = 7
P3 = 5

Safe Fixes = 5 (candidates only)
Product Decisions = 6
Deferred = 6 classes (A–F)

Regression:
FIX-01 = PASS
FIX-02 = PASS
FIX-03 = PASS
FIX-04 = PASS
FIX-05 = PASS
FIX-06 = PASS

Web = PASS
Android = NOT TESTABLE
iOS = NOT TESTABLE
Performance = NOT MEASURED

Production Provenance = PASS (verify-only)

FINAL VERDICT:

AUDIT COMPLETE — FINDINGS IDENTIFIED
```

---

STOP.  
NO CODE CHANGES.  
NO SQL CHANGES.  
NO DEPLOYMENT.  
NO SAFE FIXES.  
NO FIX-08.
