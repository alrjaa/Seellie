# FIX-05 INITIAL AUDIT

**Mode:** FULL AUDIT + BASELINE + RISK CLASSIFICATION ONLY  
**Date:** 2026-08-13  
**Rule:** No source / SQL / deploy / architecture changes in this round.

---

## Baseline

| Field | Value |
|-------|-------|
| Tag | `FIX-05-BASELINE` |
| Local commit | `5c31eac` (`FIX-04-SAFE-FIXES`) |
| Branch | `main` |
| App version | `1.0.76` |
| versionCode | `74` |
| Expo SDK | `~54.0.0` |
| React | `19.1.0` |
| React Native | `0.81.5` |
| TypeScript | `~5.9.2` |
| Package manager | npm `11.16.0` |
| Node | `v24.18.0` |
| Supabase project | configured via `EXPO_PUBLIC_SUPABASE_*` (anon present; **no** service_role in client `.env`) |

Working tree at baseline: clean for FIX-04 source; untracked only `docs/FIX-03-PRODUCTION-FOLLOWUP.md` (unrelated).

---

## Git

| Ref | Role |
|-----|------|
| `FIX-05-BASELINE` / `FIX-04-SAFE-FIXES` / `HEAD` | `5c31eac` |
| `FIX-04-BASELINE` / `FIX-03-CLOSURE-CANDIDATE` | `93a30df` |
| `FIX-03-CLOSURE-BASELINE` | `9069ed0` |

- `git diff FIX-04-SAFE-FIXES HEAD` → **empty** (audit starts exactly at FIX-04 closure).  
- `git diff FIX-03-CLOSURE-CANDIDATE HEAD` → **FIX-04 only** (19 files, +792/−199).

Deploy repo (`~/Developer/Seellie`): `ef582f0` — content-identical to `5c31eac` for those 19 files (proven at FIX-04 production).

---

## Production

| Field | Value |
|-------|-------|
| URL | https://www.seellie.com |
| Deploy commit | `ef582f0` (source `5c31eac`) |
| Deployment ID | `5882596662` |
| Environment | Production |
| Deployed at | 2026-08-13T05:44:02Z |
| Bundle | `index-731a94741319b9bf9607f91e5b774857.js` |
| FIX-04 production | **PASS / CLOSED** |

---

## Architecture

| Item | Class | Notes |
|------|-------|-------|
| `TournamentProvider.tsx` (~6457 LOC) | ACTIVE / god-context | Owns auth, users, competitions, requests, messages, share cards, forums, offers, gifts, branding, sync locks |
| `useTournamentSlices` | POSSIBLY UNUSED | Facade over full context; **0** consumers |
| `ToastProvider` + ToastHost | ACTIVE | FIX-04 isolated toast UI state |
| `NotificationsProvider` | ACTIVE | Value includes notifications array → consumer churn |
| Firebase / Firestore | LEGACY | Gated off when Supabase configured; only `competition-sync` + `firebase.ts` |
| `fetchAllProfiles` deprecated | LEGACY / POSSIBLY UNUSED | Prefer `fetchAllProfilesResult`; **0** external callers |
| Dual competition paths | LEGACY + ACTIVE | Firestore subscribe null when Supabase on |

Provider tree: Language → Theme → Toast → Notifications → **Tournament**.

---

## Security

Live non-destructive suite (ephemeral users) at audit time:

- FIX-01 live verify: **PASS** (accessCode hits=0, self-activate/IDOR/admin RPC/storage denied)
- FIX-02 share cards live: **PASS** (`B_realtime_insert_event events=1`, C denied)
- FIX-02 security-merge: **PASS**

Client secrets scan: `"accessCode":` = **0**; JWT-like = **0**; client `.env` has anon only.  
Edge `sports-proxy` references `SUPABASE_SERVICE_ROLE_KEY` as **Deno secret name** (server-side) — not embedded in web bundle (prod bundle `service_role` count = 0).

---

## Auth

| Check | Result |
|-------|--------|
| Login / wrong password / logout (prod smoke FIX-04) | PASS |
| Auth loading no hang (~8–9s) | PASS (FIX-03) |
| Protected routes after logout | PASS (smoke) |
| Duplicate auth listeners | REVIEW — competitions subscribe uses `onAuthStateChange` + channel; messages/share keyed by user id |

---

## Session

| Mechanism | Status |
|-----------|--------|
| `sessionGen` + `sessionUserIdRef` | ACTIVE / SAFE for messages & share cards |
| Logout clears messages/shareCards + notifications keys | SAFE (FIX-02) |
| User-switch without logout clears messages/shareCards | SAFE |
| Stale fetch rejection | SAFE where generation gates applied |
| A→B / B→A isolation | PASS (live + smoke) |

---

## Supabase

~40 SQL scripts under `supabase/` (schema, RLS phases, FIX-01 secrets, share cards realtime, private space, etc.).  
Objects classified from client usage + live tests (not a full live catalog dump):

| Area | Class |
|------|-------|
| `analyst_access_codes` + RPCs | SECURE (FIX-01 live) |
| `share_cards` RLS + Realtime | SECURE (FIX-02 live) |
| `profiles` content strip | SECURE (leak=0) |
| Storage ownership | SECURE (cross-user denied) |
| `app_competitions` fetch Result | **REVIEW / RISK** — no explicit `ok`; callers can treat error+empty as empty catalog |
| Edge sports-proxy service role | REVIEW (server-only; ensure invoke auth remains tight) |

---

## RLS

Live matrix (ephemeral): Anonymous secrets denied; A/B IDOR denied for analyst RPC; C denied share card select/update/delete.  
Full table-by-table live matrix for every domain: **PARTIAL** (messages/private/forums covered by prior phases + code review; not every SQL object re-probed this round).

---

## Storage

Cross-user upload/delete denied (FIX-01). Orphan notes exist in SQL docs. Path ownership checks in `supabase-storage.ts`.  
Class: **SECURE** for tested paths; orphan GC: **UNKNOWN** (needs product policy).

---

## Realtime

| Domain | Primary | Fallback poll (focused) | Cleanup |
|--------|---------|-------------------------|---------|
| Profiles | subscribe | 60s | on user id change |
| Forums | subscribe | 60s | on user id change |
| Messages | subscribe | 15s (screen focus) | sessionGen + uid |
| Share Cards | subscribe | 20s (focus) | sessionGen + uid |
| Competitions | subscribe + auth events | pull on change | channel remove |
| Competition requests | subscribe | pull | gated apply (FIX-04) |

Duplicate events: Share Cards live = **1** event.  
C isolation: PASS.

---

## Sync

| Path | Class |
|------|-------|
| Competition **requests** | **SAFE** (FIX-04 `ok === true` gate) |
| Share cards | **SAFE** (FIX-04 Result + reconcile) |
| Messages | **SAFE WITH FALLBACK** — skips merge on `error && !messages.length`; SUCCESS empty keeps local (no wipe). Lacks explicit `ok` |
| Forums | **SAFE WITH FALLBACK** — same pattern |
| Profiles | **SAFE WITH FALLBACK** — `fetchAllProfilesResult.ok` |
| Competitions reconcile | **SAFE WITH FALLBACK** — `reconcileCompetitionsWithCloud` **returns local unchanged when `cloud.length === 0`** (ERROR empty ≠ wipe). Subscribe pull skips `error && !items.length`. Lacks explicit `ok` (contract debt vs FIX-04) |
| Competitions hydrate/refresh | **SAFE WITH FALLBACK** — still enters reconcile/save on non-`no_session` errors with `[]`, but reconcile no-ops on empty; may still write AsyncStorage unnecessarily |

---

## Data Integrity

Clear/reset triggers found:

| Trigger | Effect | Error-safe? |
|---------|--------|-------------|
| Logout / user switch | clear messages, shareCards | intentional |
| FIX-04 SUCCESS_EMPTY creq/share | reconcile empty | intentional success only |
| Competitions reconcile with `[]` | **keeps local** (`if (!cloud.length) return local`) | yes |
| Seed filters | remove seed when cloud has data | OK when success |

No destructive audit SQL executed. No real user data deleted.

---

## Performance

| Metric | Status |
|--------|--------|
| Polls/min (if focused fallbacks all active) | profiles 1, forums 1, messages 4, private 2, share cards 3 |
| Render counts / TTI / memory | **NOT MEASURED** |
| TournamentProvider churn | **RISK** (god-context) — qualitative only |
| Class | **NOT MEASURED** overall; source interval map **MEASURED** |

---

## Context / Render

- Mega `TournamentContext` → any domain tick re-renders broad consumers.  
- `useTournamentSlices` unused (false split).  
- ToastHost: fixed cascade for toast payload (FIX-04).  
- Notifications still include list in context value → churn.  
- `currentUser?.id` used for Realtime (FIX-04); some callbacks still `[currentUser]` (e.g. `refreshCurrentUserFromCloud`).

---

## UI / UX

| Metric | Count / note |
|--------|----------------|
| `app/` routes | ~80 tsx |
| `src/screens` | ~68 screens |
| Modal `onRequestClose` | 14/14 covered |
| Pressables w/o label (approx) | ~136 / 188 |

Screen-level loading/empty/error consistency: uneven (P2/P3). Double-submit hardening partially done in FIX-03.

---

## Arabic RTL

FIX-03/04 production smoke: `dir=rtl` on AR; toggle works.  
Residual hardcoded AR a11y strings risk (mostly fixed on InlineVideo). **PASS** for core; **PARTIAL** for every icon/chevron screen.

---

## English LTR

`dir=ltr` after EN on login. Reload behavior closed in FIX-03. **PASS** core.

---

## Responsive

Tested widths historically: 320–1440 PASS on web smoke. Admin `minWidth` tables: **KEEP** unless overflow filed. Unique tablet still `.map` (not virtualized) — P2.

---

## Web

Production interactive (FIX-04 close): login/logout A/B, AR/EN, nav Share Cards/Messages/Unique/Settings PASS.  
Console: expected auth **400** on wrong password = EXPECTED. Secrets hits=0.

---

## Android

**NOT TESTABLE** — no `android/`, no adb.

Source review: Modal close, StatusBar translucent, KeyboardAvoidingView Android often undefined (FIX-04 follow-up).

---

## iOS

**NOT TESTABLE** — no `ios/`, no Simulator.

---

## Accessibility

**PARTIAL** — many Pressables lack labels; Modals OK; disabled/loading inconsistent.

---

## Media

- `expo-av` ACTIVE; `expo-video` absent.  
- `unloadAsync` on InlineVideo / FullScreenFeed / Private lightbox.  
- Forums + PrivateChatComposer previews: pause/unload gaps → **RISK** (leak), not migration.

---

## API / Network

Mixed Result contracts: some `{ ok, error }`, some `{ items, error? }`, messages `{ messages, error? }`.  
Cancellation/stale: sessionGen on messages/share; not universal.  
Rapid submit: partial FIX-03 guards.

---

## Error Handling

~105 `console.*` in `src`. Silent catches exist in media/UI. Infinite loading largely addressed for auth (FIX-03). Competitions lack explicit `ok` (contract inconsistency; empty reconcile currently preserves local).

---

## Logging

No `accessCode` / JWT / service_role in prod bundle. Client logs may include error messages (non-secret). Do not strip logging in FIX-05 audit.

---

## Dependencies

| Package | Note |
|---------|------|
| `expo-av` ~16.0.8 | ACTIVE |
| `expo-video` | missing (deferred migration) |
| `firebase` ^10.14.1 | LEGACY |
| `@supabase/supabase-js` | ACTIVE |

Outdated/CVE scan: **NOT MEASURED** (no advisory fetch this round). Do not upgrade in audit.

---

## Firebase

| Class | Evidence |
|-------|----------|
| LEGACY | Firestore competition load/save skipped when Supabase configured |
| REQUIRED? | Product decision — still in package.json for offline/non-Supabase boot |
| UNKNOWN | Whether any production tenant runs without Supabase |

---

## Threat Model

| Asset | Threat | Likelihood | Impact | Severity | Protection | Remaining |
|-------|--------|------------|--------|----------|------------|-----------|
| Analyst secrets | Leak via profiles | Low | High | High→mitigated | FIX-01 secret table | Monitor |
| Share cards | IDOR / RT leak | Low | High | High→mitigated | RLS + filters | Monitor |
| Messages | IDOR | Low | High | High | RLS (live partial) | Full matrix gap |
| Competitions catalog | Accidental wipe via sync | Low | High | Mitigated by empty→keep-local | Incomplete Result `ok` | Contract debt |
| Session | A/B confusion | Low | High | Mitigated | sessionGen/logout | Residual races |
| Storage | Cross-user | Low | High | Mitigated | ownership checks | Orphans |
| Client | Tamper / privilege | Med | Med | RLS server-side | Always assume hostile client |
| Edge sports-proxy | Misuse of service role | Low–Med | High | Edge secrets | Auth on invoke REVIEW |
| App UX/perf | God-context / lists | Med | Med | Partial FIX-04 | Profiling needed |

---

## Findings

### P0

*None confirmed.*  
(Competitions empty-cloud reconcile returns local — not an ERROR→wipe path. Earlier hypothesis rejected after reading `reconcileCompetitionsWithCloud`.)

### P1

| ID | Area | File / function | Current | Expected | Evidence | Fix risk |
|----|------|-----------------|--------|----------|----------|----------|
| **P1-1** | Sync contract | `supabase-competitions.ts` `fetchCompetitionsCloud`; `TournamentProvider` hydrate/refresh | `{ items, error? }` — ERROR empty still calls reconcile/save; reconcile no-ops | Explicit `ok` + skip apply on ERROR (FIX-04 pattern) | Code read | Low — safe mirror of FIX-04 |
| **P1-2** | Messages/Forums Result | `supabase-messages.ts`, `supabase-forum-comments.ts` | `{ error? }` without `ok`; callers skip on error+empty | Explicit `ok` for clarity | Code read | Low |
| **P1-3** | Notifications churn | `NotificationsProvider` | Context value includes notifications array | Isolate list to host/selectors without architecture split if possible | Code read | Med — stop if needs context split |
| **P1-4** | Video unload gaps | `ForumsScreen`, `PrivateChatComposer` | Preview `<Video>` without unload | unload/pause on unmount | Explore audit | Low |
| **P1-5** | a11y Pressable labels | many screens | ~136/188 Pressables lack label | Labels on icon buttons | Count approx | Low |
| **P1-6** | Edge sports-proxy | `supabase/functions/sports-proxy` | Uses service role env (server) | Confirm invoke auth tight | Comment + REVIEW | Med — product/security |

### P2

| ID | Area | Notes |
|----|------|-------|
| **P2-1** | Unique tablet `.map` | Unbounded list; FlatList deferred |
| **P2-2** | Private chat ScrollView `.map` | Virtualization deferred (RTL/keyboard) |
| **P2-3** | `refreshCurrentUserFromCloud` deps `[currentUser]` | Object identity churn |
| **P2-4** | Unused `useTournamentSlices` / `fetchAllProfiles` | Dead API surface |
| **P2-5** | Admin table minWidth | KEEP unless overflow bug |
| **P2-6** | TournamentProvider size | ~6457 LOC god-context — perf/maintainability |

### P3

| ID | Area | Notes |
|----|------|-------|
| **P3-1** | Console expected 400 | Wrong-password AUTH ERROR |
| **P3-2** | MediaTypeOptions deprecation | Incremental |
| **P3-3** | HeaderBackButton hitSlop | Layout-sensitive |

### INFO

| ID | Note |
|----|------|
| INFO-1 | TournamentProvider split = architecture STOP |
| INFO-2 | expo-av → expo-video = STOP |
| INFO-3 | Firebase deletion = product decision |
| INFO-4 | Performance numbers NOT MEASURED |
| INFO-5 | Android/iOS NOT TESTABLE |
| INFO-6 | FIX-01…04 regression suites PASS at audit time |
| INFO-7 | Competitions SUCCESS_EMPTY currently cannot clear catalog (empty→keep local) — product intent TBD |

---

## FIX-01 Regression

**PASS** (unit + live)

## FIX-02 Regression

**PASS** (unit + live share cards + security-merge)

## FIX-03 Regression

**PASS** (no FIX-03 source delta after FIX-04; prior production closure stands)

## FIX-04 Regression

**PASS** (HEAD = FIX-04-SAFE-FIXES; units + live still green)

---

## Safe To Fix

1. Competitions / messages / forums explicit `ok` Result + apply guards — **P1-1, P1-2**  
2. Video unload on Forums/Composer previews — **P1-4**  
3. Targeted accessibilityLabel on icon buttons — **P1-5**  
4. Narrow remaining `currentUser` object deps to id/ref — **P2-3**  
5. Remove proven-unused exports after import proof — **P2-4**

## Requires Product Decision

- Delete Firebase / require Supabase-only  
- Orphan storage GC  
- Whether SUCCESS_EMPTY must wipe competitions  
- sports-proxy invoke policy  

## Requires Device Testing

- Android KeyboardAvoidingView / StatusBar / Modal  
- iOS SafeArea / video memory  
- Private chat FlatList migration  
- Unique tablet FlatList

## Requires Performance Profiling

- TournamentProvider render counts  
- Notifications cascade  
- Polling under multi-screen focus  
- Video memory on native

## Do Not Touch

- TournamentProvider multi-context split  
- expo-av → expo-video wholesale  
- Firebase deletion without product OK  
- Auth / RLS / Realtime redesign  
- FlashList rewrite  
- Dependency major upgrades  
- Production redeploy from this audit  

See also `docs/FIX-05-FOLLOWUP.md`.

---

## Recommended FIX-05 Plan

**PHASE 1 — P0**  
None open. Skip or use for hotfixes only if a true P0 appears.

**PHASE 2 — P1 Safe**  
P1-1 / P1-2 Result `ok` alignment; P1-4 video unload; P1-5 targeted a11y.

**PHASE 3 — P1 Requires Validation**  
P1-3 Notifications isolation (stop if needs context split); P1-6 sports-proxy auth review with product.

**PHASE 4 — P2**  
List virtualization with device QA; dead export cleanup; callback id deps; document TournamentProvider split as future epic.

**PHASE 5 — Deferred**  
Architecture split, expo-video, Firebase removal, dependency upgrades, full native matrix.

---

## Final Verdict

```
AUDIT COMPLETE — P1 FINDINGS EXIST
```

No confirmed P0 data-wipe defect remaining after FIX-04; highest open work is **contract consistency / UX-perf / a11y / media cleanup**, plus deferred architecture items.

---

STOP — NO CODE CHANGES.  
STOP — NO SQL CHANGES.  
STOP — NO DEPLOYMENT.  
STOP — NO FIX-06.
