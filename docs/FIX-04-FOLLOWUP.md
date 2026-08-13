# FIX-04 FOLLOW-UP (STOP / deferred)

Items intentionally **not** implemented in FIX-04 safe phase.

| Item | Reason |
|------|--------|
| Full TournamentProvider multi-context split | Architecture STOP — needs dedicated design |
| NotificationsProvider context split | Would require architecture change; toast host isolation done instead |
| expo-av → expo-video migration | Architecture STOP |
| UniqueScreen tablet `.map` → FlatList | Possible scroll/`Screen` nesting behavior change — defer with device QA |
| Private chat `ScrollView`+`.map` → FlatList | Inverted/keyboard/RTL/stick-to-bottom risk — STOP until carefully tested |
| FlashList / external store rewrite | Architecture STOP |
| Firebase deletion | Product confirmation required |
| Supabase Auth / RLS / Realtime redesign | Security model STOP |
| MediaTypeOptions deprecation sweep | Incremental; not blocking |
| HeaderBackButton hitSlop enlarge | Layout-sensitive — only if filed as bug |

## Done in FIX-04 (safe)

- P0-1 competition requests Result + no error wipe
- P0-2 share cards Result + no error wipe + live Realtime still PASS
- P1: `currentUser?.id` / refs for Realtime & focus churn
- P1: ToastHost isolation (no tree cascade on toast show)
- P1: native `unloadAsync` on video stop/unmount
- P1: AvatarPicker `allowsEditing` gated off web
- P1: fullscreen Modal StatusBar / safe close inset
- P1: targeted a11y labels
