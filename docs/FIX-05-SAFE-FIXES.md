# FIX-05 SAFE FIXES — checkpoint notes

**Tag:** `FIX-05-SAFE-FIXES`  
**Baseline:** `FIX-05-PRE-SAFE-FIXES` / `FIX-05-BASELINE` @ `5c31eac`  
**Date:** 2026-08-13  
**Production deploy this round:** **NO**

## Scope delivered

| Phase | Result |
|-------|--------|
| 1 Baseline verify | PASS (`docs/FIX-05-BASELINE-VERIFY.md`) |
| 2 Result contracts (comp/msg/forum) | PASS + unit matrix |
| 3 Notifications API/state split | PASS |
| 4 Video unload gaps | PASS (Forums + Composer + Private bubble) |
| 5 Targeted a11y labels | PASS |
| 6 sports-proxy | REVIEW only — no Edge change (`docs/FIX-05-SPORTS-PROXY-REVIEW.md`) |
| 7 Lists / god-context | KEEP / deferred |
| 8 `refreshCurrentUserFromCloud` deps | PASS (ref-based) |
| 9–12 Regressions | PASS (see final report) |
| 14–15 Build + web interactive | PASS |
| 16 Native | NOT TESTABLE |

## Intentionally not done

- TournamentProvider multi-context split  
- expo-av → expo-video  
- Firebase removal  
- Unique / private FlatList virtualization  
- sports-proxy auth/rate-limit Edge change  
- Deleting `useTournamentSlices` / `fetchAllProfiles` without stronger proof  
- Production deploy / FIX-06  

## Known limitations

- Attach-grid looping `<Video>` thumbs in Private attach sheet still autoplay (product preview); unload on bubble/lightbox/composer/forums addressed.  
- sports-proxy `sync_*` callable with anon → quota FOLLOW-UP.  
- Android / iOS device matrix not run.  
- Perf measurements: NOT MEASURED (no durable profiler left in tree).
