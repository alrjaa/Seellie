# FIX-05 FOLLOW-UP (deferred / do-not-touch)

Updated after FIX-05 SAFE FIXES. **Do not implement without an explicit next phase.**

| Item | Class |
|------|-------|
| TournamentProvider multi-context split | Architecture STOP |
| expo-av → expo-video migration | Architecture STOP |
| Firebase deletion | Product decision |
| Unique tablet / private chat FlatList | Device QA required |
| Private attach-grid looping Video thumbs | Residual media KEEP / optional later |
| sports-proxy: require user JWT + rate-limit on `sync_*` | Security/ops FOLLOW-UP (see `FIX-05-SPORTS-PROXY-REVIEW.md`) |
| FlashList / external store | Architecture STOP |
| Dependency major upgrades | Separate change control |
| Auth / RLS / Realtime redesign | Security STOP |
| Production deploy | Separate Production Verification command only |

Completed in FIX-05 safe: result `ok` contracts, notifications API split, video unload (Forums/Composer/bubble), targeted a11y, `refreshCurrentUserFromCloud` ref deps.

See `docs/FIX-05-INITIAL-AUDIT.md` and `docs/FIX-05-SAFE-FIXES.md`.
