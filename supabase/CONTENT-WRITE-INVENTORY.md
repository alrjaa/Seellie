# Content write paths inventory (Seellie)

Rule: cloud Sign-up session → Storage upload (if file) → Supabase write → toast on failure.

| Path | Cloud path | Status |
|---|---|---|
| addCompetitionMedia (+ matchId) | Storage + app_competitions payload | Wired |
| addUserMedia / removeUserMedia | Storage + profiles.content | Wired |
| setUserAvatar | Storage + profiles.content | Wired |
| addAnalysis | Storage + profiles.content | Wired |
| updateUser (posts etc.) | profiles.content via upsertUserContentCloud | Wired |
| addComment (forums) | Storage for video + forum_comments | Wired |
| sendMessage / share cards | existing supabase-* | Already cloud |
| private friends / DMs / saved | private-space services | Already cloud |
| competition CRUD | app_competitions | Already cloud |

SQL once: `supabase/CONTENT-CLOUD.sql`
