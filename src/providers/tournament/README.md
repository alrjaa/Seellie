# Tournament provider domain split (P2 FIX-13)

`TournamentProvider` exposes two React contexts:

| Context | Hook | Contents |
| --- | --- | --- |
| Core | `useTournamentCore()` | Auth/session user, competitions, users, offers, referees, stable mutations |
| Live | `useTournamentLive()` | High-churn feeds: `messages`, `shareCards`, `comments` |

`useTournament()` merges both (legacy). Prefer **Core** on list/dashboard screens that do not render messaging or discussion feeds so message traffic does not re-render those trees.

Screens migrated in P2: follower competitions/matches, plus organizer home uses Core+Live explicitly.
