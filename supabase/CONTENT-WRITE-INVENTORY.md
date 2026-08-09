# Content write paths — full cloud sync inventory

Rule: cloud Sign-up session → Storage (if file) → Supabase write → error toast on failure.

Run SQL once (in order):
1. CONTENT-CLOUD.sql (profiles.content + storage)
2. CONTENT-CLOUD-RPC.sql (replace_profile_content for likes/follows/analyst admin)
3. APP-BLOBS.sql (referees, offers, gifts, branding, announcements, prizes)

| Domain | Cloud path | Status |
|---|---|---|
| Competition CRUD/teams/fixtures/scores/staff/media | app_competitions.payload via syncCompetitions | Wired + error toast |
| Match/team comments likes | same payload via syncCompetitions | Wired |
| User posts/media/analysis/avatar/pins/follows/likes | profiles.content (+ RPC cross-user) | Wired |
| Analyst apply/approve/warn/suspend/ban/activate | profiles.content | Wired |
| Forums text+video + moderation status | forum_comments | Wired |
| Messages / share cards (+ read) | messages / share_cards | Wired |
| Private friends/DM/saved | private_* | Wired |
| Competition requests | competition_requests | Wired |
| Referees roster | app_blobs.referees | Wired (login+bootstrap hydrate) |
| Offers / gifts / support levels | app_blobs.* | Wired |
| Support certificate images | Storage HTTPS then blob | Wired |
| App name/logo | app_blobs.app_branding | Wired |
| Announcements / prizes | app_blobs.announcements:{uid} / prizes:{uid} | Wired + fail toast |
| In-app password change | Auth updateUser | Wired for UUID accounts |
| Device theme/language | local prefs | OK local |

Acceptance (two cloud accounts, two devices):
- Organizer edits competition / uploads media → follower sees
- User posts/media/analysis/follow/like → other device sees after refresh
- Analyst lifecycle visible after re-login on other device
- Forum / private / messages work both ways
- Announcements & prizes appear after re-login on other device
- Password changed on device A works on device B login
