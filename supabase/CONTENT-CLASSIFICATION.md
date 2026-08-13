# profiles.content field classification (FIX-01)

| Field | Class | Notes |
|-------|-------|-------|
| posts, media, analysisContent, personalityPhotos | PUBLIC | Social feed |
| following, followers, pinnedCompetitionIds | PUBLIC | Social graph |
| city, region, country | PUBLIC | Profile location |
| permissions | PUBLIC | Feature flags needed by UI |
| analyst.status / terms / moderation reasons | PUBLIC / ADMIN_VISIBLE | Status needed for Unique gate; reasons shown to owner + admin |
| analyst.accessCode | SENSITIVE | **Removed** — lives in `analyst_access_codes` only |
| mobile | PRIVATE | Column on profiles; not a secret but avoid logging |
| email, name, handle, avatar, bio | PUBLIC | Profile columns (not inside content JSON) |

Sensitive auth material must never be written into `content`.
Server trigger `profiles_strip_analyst_access_code` enforces this.
