# FIX-03-BASELINE

Generated: 2026-08-13 · **Before any FIX-03 code changes**  
Git: `FIX-03-BASELINE` = `f4e815b` · Prior: FIX-02 PASS (`e275159`)  
App version: **1.0.74** · Android versionCode **72** · Expo SDK **54** · package.json **1.0.0**  
Supabase: `sjfkdipgvivomllpfnkt`

## Build / test status (this checkpoint)

| Check | Result |
|-------|--------|
| `tsc --noEmit` | PASS |
| `npm test` | PASS |
| `fix01-security-unit` | PASS |
| `fix02-sync-unit` | PASS |
| `expo export --platform web` | PASS |
| Android native build | NOT TESTED |
| iOS native build | NOT TESTED |
| Web interactive (browser) | NOT TESTED this baseline |

## Dependency status

| Item | Notes |
|------|--------|
| expo-av ~16 | ACTIVE video path — follow-up migrate to expo-video (not FIX-03 scope unless broken) |
| firebase | LEGACY dual competition sync — KEEP |
| expo-file-system/legacy | ACTIVE in persist-media / SupportScreen |
| @supabase/supabase-js | Primary cloud |

## Navigation map (summary)

- Root stack: auth, admin, follower/organizer/freelancer tabs, shared (forums/search/shares/unique/notifications/share-cards/legal/profile)
- Role redirect via `routeForRole`
- SuperAdminGuard = UI only (server AuthZ remains FIX-01)

## Screen inventory

- **~80** app routes · **~70** screen modules under `src/screens/`
- Role groups: auth (3), follower (~20), organizer (~14), freelancer (5), superadmin (~18), shared (8)

## Modal inventory

- RN `Modal` sheets (no ActionSheet / bottom-sheet lib)
- Key: PrivateScreen, ShareTargetModal, AccountMenuButton, Analysts, Shares, Messages (org), Freelancers, ReasonModal, video fullscreen
- Confirm: `utils/confirm.ts` → Alert / window.confirm

## Major interactions

Login/logout · messages · share cards · private space · competitions CRUD · analyst apply/verify · media upload · FAB

## Providers

`SafeArea → Language → Theme → LanguageReadyGate → NavigationCairo → Toast → Notifications → Tournament`

## Known risks entering FIX-03

1. Android Modals missing `onRequestClose` (org Messages, Freelancers)
2. No `BackHandler` app-wide
3. Share Cards / Messages compose keyboard coverage gaps
4. Double-submit on several send actions
5. FAB / feed actions physical left/right ignore RTL
6. Auth screens SafeArea bottom edges incomplete
7. Fetch-error → Empty UI ambiguity for share cards (provider guards empty wipe; UI may still look Empty)
8. Admin accessCode display in Analysts UI (FIX-01 surface — verify strip; do not expand secrets)
9. TournamentProvider still large (FIX-02 PARTIAL architecture — out of FIX-03 rewrite scope)

## Existing warnings / console

- No password/token/accessCode console.log found in baseline scan
- Operational `console.warn` in supabase services (keep)

## Performance (baseline, code-derived from FIX-02)

| Domain | Poll |
|--------|------|
| Profiles | 60s foreground |
| Forums | 60s foreground |
| Messages | 15s focused |
| Private | 30s focused |
| Share cards | 20s focused + Realtime |

Rerenders / TTI: **NOT MEASURED** at baseline.

## FIX-01 / FIX-02 gates entering FIX-03

- FIX-01 security unit: PASS  
- FIX-02 sync unit: PASS  
- Share Cards Realtime live: PASS (prior closure)

## Baseline verdict

**PASS** — checkpoint + inventory complete. Fixes begin after this document.
