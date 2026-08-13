# FIX-04 DEAD / LEGACY CODE

Inventory only — **no bulk deletion** in FIX-04.

| Item | Class | Notes |
|------|-------|-------|
| Firebase + Firestore competition paths when Supabase configured | LEGACY | Still gated off when Supabase on (FIX-03) |
| `fetchAllProfiles()` deprecated wrapper | LEGACY | Remove only after zero callers proven |
| `useTournamentSlices` | KEEP API / FOLLOW-UP | Still full context under the hood |
| Seed clear helpers | KEEP | Used for cloud hydrate |
| Dual local/cloud competition-request paths | LEGACY | Cloud path primary |
