# FIX-06 INITIAL AUDIT REPORT

**Mode:** AUDIT ONLY — no application code, SQL, schema, RLS, Realtime, Auth, UI, or deploy changes.  
**Date:** 2026-08-14  
**Checkpoint:** `FIX-06-BASELINE` @ `bfc107c` (= `FIX-05-SAFE-FIXES`)

---

## 1. Baseline

| Field | Value |
|-------|-------|
| Tag | `FIX-06-BASELINE` |
| Local HEAD | `bfc107c` |
| Equals | `FIX-05-SAFE-FIXES` |
| Branch | `main` |
| Prior closed phase | FIX-05 PRODUCTION PASS (`dfe7bbc` ← source `bfc107c`) |
| Production URL | https://www.seellie.com |
| Production bundle (live) | `index-1bbcf928ffef76bcd1379a6305c9b65f.js` |

Working tree: **clean for app source**. Untracked only: `docs/FIX-03-PRODUCTION-FOLLOWUP.md` (unrelated; not modified).

---

## 2. Git state

```
bfc107c (HEAD -> main, tag: FIX-06-BASELINE, tag: FIX-05-SAFE-FIXES)
5c31eac (FIX-05-BASELINE / FIX-04-SAFE-FIXES)
```

Deploy repo (`~/Developer/Seellie`): `dfe7bbc` — content-identical FIX-05 runtime files (proven at FIX-05 production).

---

## 3. Version

| Field | Value |
|-------|-------|
| App version | `1.0.76` |
| versionCode | `74` |
| package.json version | `1.0.0` (package meta; app version from `app.config.ts`) |

**No version changes in this audit.**

---

## 4. Build environment

| Tool | Version |
|------|---------|
| Expo SDK | `~54.0.0` |
| React | `19.1.0` |
| React Native | `0.81.5` |
| TypeScript | `~5.9.2` |
| Node | `v24.18.0` |
| npm | `11.16.0` |
| expo-av | `~16.0.8` |
| firebase | `^10.14.1` (gated) |

---

## 5. Regression results

| Gate | Result | Evidence |
|------|--------|----------|
| `tsc --noEmit` | **PASS** | Clean |
| `npm test` | **PASS** | unit-tests.ts |
| FIX-01 unit | **PASS** | `fix01-security-unit.ts` |
| FIX-02 unit | **PASS** | `fix02-sync-unit.ts` |
| FIX-04 unit | **PASS** | creq + share-cards scripts |
| FIX-05 unit | **PASS** | `fix05-result-contracts-unit.ts` |
| FIX-01 live | **PASS** | 9/9 (accessCode content hits=0, IDOR/RPC/storage denied) |
| FIX-02 live Share Cards | **PASS** (after retry) | Attempt1: events=0 FAIL; Attempt2: events=1 PASS |
| FIX-02 security-merge | **PASS** | SUMMARY PASS |
| FIX-03 web (prod) | **PASS** | Login form, wrong password stays, `dir` EN=ltr / AR=rtl, responsive 320–1440, pageErrors=0 |
| FIX-04 cloud-error safety | **PASS** | Units + live empty_fetch_no_wipe |
| FIX-05 markers (local export) | **PASS** | `shouldApplyCloudResult=8`, `useNotificationsApi=3` |
| Web export | **PASS** | `index-f13e48098f8f22eee8a57de72e171f77.js` |
| Bundle secrets scan | **PASS** | accessCode JSON=0, service_role=0, JWT-like=0 |

**Note:** FIX-02 Realtime showed intermittent `events=0` then recovered — classify as **infra flake**, not confirmed app regression. Official script unmodified; retry per prior FIX-05 practice.

---

## 6. Architecture findings

| ID | Sev | Summary |
|----|-----|---------|
| **F06-P1-01** | P1 | `TournamentProvider.tsx` ~**6484 LOC**, ~103 context keys, **~81** `useTournament()` call sites — god-context blast radius |
| **F06-P1-02** | P1 | Many callbacks still depend on **`currentUser` object** (~52 dependency lists) despite `currentUserRef` used in `refreshCurrentUserFromCloud` |
| **F06-P2-01** | P2 | `useTournamentSlices` still full-context facade; **0 external consumers** |
| **F06-INFO-01** | — | Notifications API/state split (FIX-05) and Toast host isolation (FIX-04) remain intact |

---

## 7. Data integrity findings

| Domain | ERROR≠EMPTY | SUCCESS_EMPTY | Notes |
|--------|-------------|---------------|-------|
| Competitions | Gated `ok` | Keeps local if cloud `[]` | SAFE |
| Competition requests | Gated `ok` | **Reconcile drops** absent `creq_*` | Intentional FIX-04 |
| Messages | Gated `ok` | Keeps local | SAFE |
| Forums | Gated `ok` | Keeps local | SAFE |
| Share cards | Gated `ok` | **Reconcile drops** cloud-backed ids | Intentional FIX-04 |
| Profiles | `ok` + non-empty merge | Empty success does not wipe | SAFE |
| Notifications | Local-only | N/A | Logout clears |
| Private space | Soft keep on error | Union merge | SAFE |

| ID | Sev | Summary |
|----|-----|---------|
| **F06-P2-02** | P2 | SUCCESS_EMPTY reconcile on share cards / competition requests can clear cloud-backed local rows — **by design**; wrong empty success still higher impact than messages/forums |

---

## 8. Security findings

| ID | Sev | Summary | Safe Fix? | Product Decision? |
|----|-----|---------|-----------|-------------------|
| **F06-P1-03** | P1 | `sports-proxy` Edge does **not** verify end-user JWT; anon Bearer can invoke `sync_*` → API quota / store writes via service role **server-side** | Edge change | **YES** |
| **F06-P2-03** | P2 | Analyst `accessCode` still surfaces in **toasts/UI** after approval (not in public profiles.content; live leak scan=0) | UX/copy policy | Maybe |
| **F06-P3-01** | P3 | Firebase SDK still packaged; sync gated off when Supabase configured | Defer delete | **YES** |
| — | — | No `service_role` in client `src/`; storage path ownership checks present; FIX-01 live matrix PASS | — | — |
| — | — | sports-proxy: fixed upstream URL — **no SSRF** from client URL | — | — |

**No confirmed P0 secret/IDOR regression** in this audit round.

---

## 9. Sync / Realtime findings

| Domain | Realtime | Poll fallback | Cleanup |
|--------|----------|---------------|---------|
| Competitions | channel + auth pull | event→full pull | removeChannel |
| Competition requests | channel | event→pull | unsub |
| Messages | channel | **15s** focused | sessionGen + uid |
| Share cards | channel | **20s** focused | sessionGen + uid |
| Forums | channel | **60s** | stop |
| Profiles | channel | **60s** | stop |
| Private space | channel | **30s** focused | unsub |
| Offline banner | — | **15s** | clear |

Duplicate Realtime events: live Share Cards retry = **1** event.  
Firestore subscribe path: **null when Supabase configured**.

---

## 10. Performance findings

| Metric | Status |
|--------|--------|
| TTI / memory / profiler rerender counts | **NOT MEASURED** |
| Poll map (focused) | Measured from source: profiles/forums 1/min, messages ~4/min, share ~3/min, private ~2/min |
| God-context churn | **Qualitative RISK** (F06-P1-01/02) — no numeric render deltas |

---

## 11. Video / media findings

| Location | unloadAsync | Status |
|----------|-------------|--------|
| InlineVideoPlayer / FullScreenFeed | Yes | OK |
| Forums feed + preview | Yes (FIX-05) | OK |
| PrivateChatComposer pending | Yes (FIX-05) | OK |
| Private bubble / lightbox | Yes (FIX-05) | OK |
| **Private attach-grid thumbs** (`shouldPlay` + `isLooping`, no ref) | **No** | **P1 residual** |

| ID | Sev | File | Safe Fix? |
|----|-----|------|-----------|
| **F06-P1-04** | P1 | `PrivateScreen.tsx` ~1759 attach-grid `<Video>` | **YES** (static poster or unload; preserve product if needed) |

expo-video migration: **DEFER / STOP** (product).

---

## 12. List / scroll findings

| Surface | Pattern | Finding |
|---------|---------|---------|
| Unique | `ScrollView` + `.map` | **P2** — unbounded list |
| Private chat | `ScrollView` + `.map` | **P2** — keyboard/RTL sensitive |
| Messages / Forums / Share Cards / Notifications | FlatList | OK |
| Admin tables | Mostly FlatList | KEEP unless overflow bug |

| ID | Sev | Safe Fix? | Product Decision? |
|----|-----|-----------|-------------------|
| **F06-P2-04** | P2 | Partial after device QA | **YES** for strategy |

---

## 13. UI / UX findings

- Production login shell loads; wrong password does not hang (**PASS**).
- Intentional auth HTTP 400 expected.
- Admin table `minWidth`: **KEEP** unless overflow filed (no new overflow proof this round).
- Logout UI control sometimes hard to automate (prior PARTIAL) — **not reclassified as product bug** without device confirmation.

---

## 14. RTL / LTR findings

Production smoke:

| Check | Result |
|-------|--------|
| English `dir` | **ltr** PASS |
| Arabic `dir` | **rtl** PASS |
| Responsive 320–1440 | **PASS** (no crash) |

Deep per-screen icon mirroring: **PARTIAL / UNVERIFIED** beyond dir attribute + prior FIX-03 closure.

---

## 15. Accessibility findings

| Metric | Value |
|--------|-------|
| `<Pressable` count | ~187 |
| With `accessibilityLabel` in opening tag | ~58 |
| Heuristic unlabeled | ~**129** |
| FIX-05 targeted labels | Done for selected close/chat/pledge/referee |

| ID | Sev | Safe Fix? |
|----|-----|-----------|
| **F06-P2-05** | P2 | **YES** — icon-only / ambiguous controls; AR+EN via `t()` |

---

## 16. Navigation / lifecycle findings

| Check | Result |
|-------|--------|
| Prod boot → login | PASS |
| Wrong password | PASS |
| Deep A/B login isolation | PASS in FIX-05 prod; not fully re-run login A/B this audit (FIX-03 smoke only) → **PARTIAL** for deep nav matrix |
| Android back | **NOT TESTABLE** |
| iOS | **NOT TESTABLE** |

---

## 17. Error / loading / empty findings

Catalog domains post-FIX-05: **ERROR ≠ EMPTY** gated.  
Screen-level Loading/Empty/Error/Retry consistency across all routes: **PARTIAL** (uneven UX; no wipe regression proven).

---

## 18. Logging findings

| Check | Result |
|-------|--------|
| Password console logging | **0** matches |
| service_role in `src/` | **0** |
| Bundle secret scan | **0** |
| Expected auth 400 | Allowed |
| Genuine app page errors (prod smoke) | **0** |

---

## 19. Dependencies / legacy findings

| Item | Class |
|------|-------|
| expo-av | ACTIVE — KEEP |
| expo-video | Absent — migration STOP |
| Firebase | LEGACY gated — KEEP until product decision |
| `fetchAllProfiles` deprecated | Unused — KEEP until proven removal |
| `useTournamentSlices` | Dead facade — KEEP or remove after proof |

---

## 20. Product decisions

| Item | Class |
|------|-------|
| TournamentProvider multi-context split | **NEEDS PRODUCT DECISION** |
| expo-av → expo-video | **NEEDS PRODUCT DECISION** |
| Firebase deletion | **NEEDS PRODUCT DECISION** |
| sports-proxy auth / rate-limit on `sync_*` | **NEEDS PRODUCT DECISION** |
| Unique / private FlatList strategy | **NEEDS PRODUCT DECISION** + device QA |
| Share/creq SUCCESS_EMPTY semantics change | **NEEDS PRODUCT DECISION** |
| Major Auth/RLS redesign | **DEFER / STOP** |

---

## 21. P0 / P1 / P2 / P3 matrix

### P0 — Critical

**None confirmed** in this audit (no live IDOR/secret/data-wipe regression).

### P1 — High

| ID | Domain | File | Observed | Expected | Root cause | Evidence | Security | Data | Perf | UI | Regression risk | Action | Safe? | Product? |
|----|--------|------|----------|----------|------------|----------|----------|------|------|-----|-----------------|--------|-------|----------|
| F06-P1-01 | Architecture | `TournamentProvider.tsx` | Broad re-renders on any domain tick | Isolated slices | God-context | ~6484 LOC; ~81 consumers | Low | Low | High qualitative | Low | High if split | Document; optional dep narrowing only | Partial YES | Full split YES |
| F06-P1-02 | Callbacks | `TournamentProvider.tsx` | Object-identity churn | Stable id/ref deps | `currentUser` in deps | ~52 lists | Low | Med (stale risk if mishandled) | Med | Low | Med | Narrow to id/ref carefully | YES | NO |
| F06-P1-03 | Security/ops | `sports-proxy/index.ts` + edge provider | Anon can `sync_*` | Authz + rate limit | No user JWT check | Code read + FIX-05 review | Quota/abuse | Low user-data | — | — | Med (Edge) | Authz/rate-limit Edge | Edge YES | YES |
| F06-P1-04 | Media | `PrivateScreen.tsx` attach grid | Looping Videos w/o unload | Cleanup / static thumb | No ref/unload | Lines ~1759 | Low | Low | Med native mem | Low | Low | Pause/unload or poster | YES | NO |

### P2 — Medium

| ID | Domain | Summary | Safe? | Product? |
|----|--------|---------|-------|----------|
| F06-P2-01 | Architecture | Unused `useTournamentSlices` facade | YES (remove/document) | Optional |
| F06-P2-02 | Sync | SUCCESS_EMPTY destructive reconcile share/creq | Document only unless product changes | Maybe |
| F06-P2-03 | Security/UX | accessCode in toast/UI | Policy | Maybe |
| F06-P2-04 | Lists | Unique + private chat `.map` | After QA | YES |
| F06-P2-05 | A11y | ~129 Pressables without open-tag labels | YES | NO |

### P3 — Low

| ID | Summary | Safe? | Product? |
|----|---------|-------|----------|
| F06-P3-01 | Firebase still packaged while gated | NO delete now | YES |
| F06-P3-02 | Deprecated unused `fetchAllProfiles` | After import proof | NO |
| F06-P3-03 | FIX-02 Realtime timing flake | Observe only | NO |

---

## 22. Safe fixes (candidates for approved FIX-06 execution — **not implemented**)

1. Narrow remaining `currentUser` object dependencies to `currentUser?.id` / refs where behavior-preserving (**F06-P1-02**).  
2. Attach-grid video unload or non-playing thumbnails (**F06-P1-04**).  
3. Targeted accessibilityLabel on remaining icon controls (**F06-P2-05**).  
4. Optional: remove proven-unused `useTournamentSlices` / `fetchAllProfiles` after static+test proof (**F06-P2-01 / P3-02**).

---

## 23. Deferred items

- TournamentProvider split  
- expo-video migration  
- Firebase deletion  
- sports-proxy Edge auth/rate-limit (needs product/security approval)  
- Unique / private chat FlatList without device QA  
- Changing SUCCESS_EMPTY semantics for share/creq  

---

## 24. NOT TESTABLE

| Item | Reason |
|------|--------|
| Android device / emulator matrix | No adb/device in this environment |
| iOS Simulator matrix | No Simulator/device |
| Native video memory retention | Requires Instruments/device |

---

## 25. NOT MEASURED

| Item | Notes |
|------|-------|
| React rerender counts | No durable profiler left in tree |
| TTI | Not instrumented |
| JS heap / native media memory | Not instrumented |
| Exact subscription count at runtime | Source intervals mapped only |

---

## 26. Risks

1. God-context continues to amplify any future Realtime/poll tick into broad UI work.  
2. Anon sports-proxy `sync_*` remains an operational quota risk.  
3. Attach-grid autoplay Videos may retain media resources on long attach sessions (native).  
4. SUCCESS_EMPTY reconcile on share/creq remains sharp if a buggy empty success ever returns.  
5. FIX-02 Realtime occasionally flakes under ephemeral signup timing — monitor, do not “fix” blindly.

---

## 27. Recommended FIX-06 phases (execution later — **not started**)

| Phase | Scope |
|-------|-------|
| 0 | Re-verify `FIX-06-BASELINE` still clean |
| 1 | Safe: `currentUser` dep narrowing (no public API change) |
| 2 | Safe: attach-grid video unload / static thumbs |
| 3 | Safe: targeted a11y labels |
| 4 | Review: sports-proxy auth/rate-limit — **STOP for product decision** before Edge/SQL |
| 5 | Optional dead-export cleanup after import proof |
| 6 | Full FIX-01…05 regression + web interactive |
| — | **STOP** before TournamentProvider split / expo-video / Firebase delete |

---

## Decision gate table

| Finding | Severity | Safe Fix | Product Decision | Defer |
|---------|----------|----------|------------------|-------|
| F06-P1-01 God-context | P1 | Partial (deps only) | Full split | Full split |
| F06-P1-02 currentUser deps | P1 | YES | NO | — |
| F06-P1-03 sports-proxy quota | P1 | Edge only | YES | Until approved |
| F06-P1-04 attach Video | P1 | YES | NO | — |
| F06-P2-01 slices facade | P2 | YES | Optional | — |
| F06-P2-02 SUCCESS_EMPTY creq/share | P2 | NO (behavior) | Maybe | Keep |
| F06-P2-03 accessCode UI | P2 | Maybe | Maybe | — |
| F06-P2-04 list virtualization | P2 | After QA | YES | Until QA |
| F06-P2-05 a11y residual | P2 | YES | NO | — |
| F06-P3-01 Firebase | P3 | NO | YES | Keep |
| F06-P3-02 fetchAllProfiles | P3 | After proof | NO | — |
| F06-P3-03 Realtime flake | P3 | Observe | NO | — |

---

### Counts

**P0 = 0**  
**P1 = 4**  
**P2 = 5**  
**P3 = 3**

**Safe Fixes = 4–5** (deps, video attach, a11y, optional dead API)  
**Product Decisions = 5** (split, expo-video, Firebase, sports-proxy, lists)  
**Deferred = 6+** (architecture/migrations + semantics)

---

## FINAL OUTPUT

FIX-06 INITIAL AUDIT = COMPLETE

P0 = 0  
P1 = 4  
P2 = 5  
P3 = 3  

Safe Fixes = 5  
Product Decisions = 5  
Deferred = 6  

Regression:  
FIX-01 = PASS  
FIX-02 = PASS  
FIX-03 = PASS  
FIX-04 = PASS  
FIX-05 = PASS  

Web = PASS  
Android = NOT TESTABLE  
iOS = NOT TESTABLE  

Performance = NOT MEASURED  

FINAL VERDICT:

AUDIT COMPLETE — P0/P1/P2/P3 FINDINGS IDENTIFIED

STOP.  
NO CODE CHANGES.  
NO SQL CHANGES.  
NO DEPLOYMENT.  
NO FIX-07.
