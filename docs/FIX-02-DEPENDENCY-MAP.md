# FIX-02 — Dependency Map (pre-change)

Generated: 2026-08-13 · App version **1.0.73** · VERIFY: read-only analysis  
Primary: `src/providers/TournamentProvider.tsx` (**6,296 lines**)

## Counts

| Metric | Value |
|--------|------:|
| `useState` | 21 |
| `useEffect` | 9 |
| `setInterval` (in provider) | 2 (profiles 15s, forums 20s) |
| Realtime channels (cloud UUID) | Messages, Forums, Profiles, Competitions, CompetitionRequests |
| Context surface | ~102 fields/methods |
| `useTournament` consumers | ~81 files |

## State inventory

| State | User-scoped? | Persist key / cloud |
|-------|--------------|---------------------|
| loading | — | — |
| appName / appLogo | public | local + blob |
| autoApproveAnalystRequests | public | blob settings |
| fabIcons | device | FAB_ICONS_STORAGE_KEY |
| personalitySectionBg / highlightsSectionBg | static | — |
| users | catalog (+ session merge) | profiles + mergeUsersPreferCloud |
| competitions / competitionRequests | mixed | app_competitions / competition_requests |
| comments / quickComments | public catalog | forum_comments / seed |
| messages | **yes** | seellie.messages + messages table |
| referees / offers / supportLevels / giftTransactions | mixed | blobs / RPCs |
| shareCards | **yes** | seellie.shareCards + share_cards |
| supporters | seed | — |
| currentUser | **yes** | tajjd.secure.currentUser + auth |

## Who reads / writes TournamentProvider

### Hot fields (approx consumer count)
- `currentUser` ~66 · `users` ~34 · `competitions` ~30 · `loading` ~20 · `routeForRole` ~18 · `messages` ~15

### Writers (mutations live in provider)
Auth, profile content, competitions CRUD, messages send/read, share cards send/status, forums, analyst lifecycle, media likes, follows, blobs, purge users.

### Outside provider (parallel stacks)
| Domain | Owner |
|--------|--------|
| Private Space | `usePrivateSpace` + `private-space.ts` (RT + 5s + focus) |
| Notifications | `NotificationsProvider` (local only) |
| Language / Theme | separate providers |

## Effects → sync

| Effect | Trigger | Side effects |
|--------|---------|--------------|
| E1 | UUID currentUser | hydrateCloudPublicCatalog (profiles, comps, requests, forum, blobs) |
| E2 | mount | local hydrate + restoreSupabaseSession + fetch cards/messages |
| E3–E4 | shareCards / messages | persist AsyncStorage |
| E5 | mount | competitions + requests Realtime (full pull on event) |
| E6 | UUID user | messages Realtime + initial refresh |
| E7 | UUID user | forums Realtime + **20s poll** |
| E8 | UUID user | profiles Realtime (partial merge) + **15s full poll** |

## Rerender blast radius

Single Context `value` object (~100 keys). Any `setUsers` / `setMessages` / `setCompetitions` / `setShareCards` / `setCurrentUser` rebuilds `value` → **all** `useTournament()` consumers re-render.

## Recommended split (logical; preserve `useTournament` facade initially)

1. SessionAuth  
2. ProfilesCatalog (users + merge + RT/poll)  
3. Competitions (+ requests)  
4. Messaging  
5. ShareCards (+ live path)  
6. Forums  
7. CommerceBlobs (offers/gifts/referees/branding)  
8. Keep PrivateSpace outside  

**Do not** create 10+ contexts without selectors; prefer internal modules + stable facade.

## Code classification (pre-delete)

| Item | Class | Notes |
|------|-------|-------|
| `highlightsSectionBg` | LEGACY / unused consumer | Prove before remove |
| `mergeRemoteMessages` | UNUSED export | Prove before remove |
| `addReferee` / `addQuickComment` | UNUSED export | Prove before remove |
| Firebase competition subscribe path | LEGACY dual | Keep until product decision |
| Seed users/competitions | ACTIVE fallback | Do not wipe on empty cloud |

## Share Cards gap

No Realtime, no polling, fetch only on login/bootstrap → recipient may need re-login for inbox. **Mandatory FIX-02 item.**
