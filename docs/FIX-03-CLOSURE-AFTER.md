# FIX-03 CLOSURE AFTER

**Baseline tag:** `FIX-03-CLOSURE-BASELINE` @ `9069ed0`  
**Version:** 1.0.76 (versionCode 74)

## Root causes fixed

### AUTH-LOGIN-UI-HANG
Login waited on `TournamentProvider.loading`, which stayed `true` until bootstrap finished a `Promise.all` that included **Firestore `getDoc`** (`loadCompetitionRequests` / `loadStoredCompetitions`) even though Supabase is the source of truth (~20–24s).

**Fix:**
- Skip Firestore reads when Supabase is configured.
- Split bootstrap: **auth phase** unlocks Login first; catalog hydrate runs after `setLoading(false)`.
- Failsafe timeout (8s) around `restoreSupabaseSession` (does not auto-login).
- Session generation guards on post-auth message/share-card fetches.

### EN stayed RTL
Verify used wrong storage keys; also `LanguageProvider.setLanguage` on web did not force `documentElement.dir` immediately, and remounting the tree via `key={language}` re-triggered full bootstrap.

**Fix:**
- Persist + apply `tajjd_app_language`, sync `dir`/`lang` immediately on web.
- Remove language remount of `TournamentProvider`.
- Add `LanguageToggle` on Login for AR↔EN.

### Console spam
RN Web rejects `style.direction` → thousands of console errors.

**Fix:** `flowDirection()` no-ops on web; strip static `direction:'ltr'` styles; Input uses `writingDirection`.

## Files touched (high level)
- `src/providers/TournamentProvider.tsx` — auth-first boot, logout clears notifications
- `src/services/competition-sync.ts` — skip Firestore when Supabase on
- `src/providers/LanguageProvider.tsx`, `AppProviders.tsx`
- `src/theme/direction.ts` + consumers
- `src/screens/auth/LoginScreen.tsx` + `LanguageToggle`
- `src/components/ui/Input.tsx`
- `scripts/live-fix01-verify.sh` — exact `accessCode` key scan
- `app.config.ts` — 1.0.76 / 74
- docs: `FIX-03-FOLLOWUP.md`

## Local interactive results (no session injection)
- Login UI ~1.1s
- AR RTL / EN LTR via UI toggle
- Real UI login A/B, logout from Settings, storage cleared, protected bounce
- Responsive login 320→1440 PASS
- FIX-01 / FIX-02 live PASS
- `expo export --platform web` → `dist/` PASS
