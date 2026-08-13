# FIX-04 INITIAL AUDIT (pre-change)

**Baseline tag:** `FIX-04-BASELINE` @ `93a30df`  
**Version:** 1.0.76 / versionCode 74  
**Date:** 2026-08-13  
**Rule:** No code changes until this audit is accepted.

## Baseline results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | PASS (exit 0) |
| `npm test` / unit-tests | PASS |
| FIX-01 security unit | PASS |
| FIX-02 sync unit | PASS |
| `expo export --platform web` | PASS → `dist/` · JS bundle ~3.8MB (`index-f7596119…`) · dist ~9.9MB |
| Android / iOS native dirs | NOT PRESENT → device matrix NOT TESTABLE |
| Untracked at baseline | `docs/FIX-03-PRODUCTION-FOLLOWUP.md` only |

---

## P0 — fix first (safe)

| ID | Finding | Evidence | Safe fix? |
|----|---------|----------|-----------|
| P0-1 | Competition requests: failed/empty cloud fetch can wipe local `creq_*` via reconcile | `supabase-competition-requests.ts` reconcile + `TournamentProvider` hydrate/refresh callers | YES — guard like competitions |
| P0-2 | Share cards: `[]` conflates empty vs error | `fetchShareCardsForUser` | YES — Result type like profiles/messages |

## P1 — safe localized

| ID | Finding | Safe fix? |
|----|---------|-----------|
| P1-1 | Mega TournamentContext: any messages/users/shareCards tick re-renders all consumers | Narrow deps / refs first; **context split = architecture stop** |
| P1-2 | `currentUser` object deps restart Realtime + forum polls | YES — depend on `currentUser?.id` + refs |
| P1-3 | Toast/Notifications parent cascade into Tournament tree | YES — memo/portal boundary |
| P1-4 | UniqueScreen + private chat unbounded `.map` (no virtualization) | YES — FlatList (test carefully) |
| P1-5 | Native video often pause without `unloadAsync` | YES — match web unload path |
| P1-6 | Android KeyboardAvoidingView often `undefined` | YES — per-screen |
| P1-7 | AvatarPicker `allowsEditing` on web | YES |
| P1-8 | Fullscreen Modal + translucent StatusBar | YES |
| P1-9 | MediaTypeOptions deprecated | YES — incremental |
| P1-10 | No BackHandler (only where UX broken) | YES — targeted only |

## P2

- Fake `useTournamentSlices` (still full context) — document; don’t treat as fix
- OfflineBanner 15s interval not paused in background
- Unstable `renderItem` (ShareCards, Home players, FullScreenFeed handlers)
- a11y: missing labels, small back button hit area, hardcoded AR a11y on video
- Admin table `minWidth` — KEEP unless overflow bug filed

## Architecture STOP (do not auto-implement)

- Full TournamentProvider multi-context split
- expo-av → expo-video wholesale migration
- FlashList / external store rewrite
- Remove Firebase until product confirms Supabase-only

## Dead / legacy (draft for FIX-04-DEAD-CODE.md)

| Item | Class |
|------|-------|
| Firebase + Firestore competition paths when Supabase on | LEGACY |
| `fetchAllProfiles()` deprecated wrapper | LEGACY → REMOVE if no callers |
| `useTournamentSlices` as “perf” | KEEP (API) / FOLLOW-UP (real split) |
| Seed clear helpers | KEEP |

## Proposed FIX-04 apply order (after approval)

1. P0-1 competition-request wipe guard  
2. P0-2 share-cards Result type  
3. P1-2 session callback / Realtime churn  
4. P1-3 toast/notifications boundary  
5. P1-5 video unload · P1-7 avatar web · P1-8 modal status bar  
6. P1-4 list virtualization (Unique + private chat) if time/safe  
7. Dead-code doc + small LEGACY cleanups with proof  
8. Full regression (FIX-01/02/03 + web export)

**No production deploy in FIX-04.**
