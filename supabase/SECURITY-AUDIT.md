# Security audit notes (PHASE4)

## Fixed in SECURITY-PHASE4-HARDENING.sql + client

| Area | Before | After |
|---|---|---|
| `forum_comments` UPDATE | any auth user could rewrite any row | no direct UPDATE; likes/status via RPC |
| `offers` blob | any auth user could wipe/replace | `upsert_offer_in_blob` / `set_offer_status` |
| `referees` blob | open write after PHASE3 | RPC only (`upsert_referee_in_blob`) |
| Suspended/blocked writes | client-only checks | `account_is_active()` on inserts + RPCs |
| Messages UPDATE | party could alter body/ids | trigger allows `read` only |
| Share cards UPDATE | content forgery possible | immutable fields restored |
| Social merge likes/followers | non-owner could replace arrays | toggle own id only |
| Storage | no size cap | bucket 100MB + client ext/mime/size checks |
| Abuse | none | light rate limit on DM/gift + `security_events` |

## Still intentional (product tradeoffs)

- `share-media` bucket is **public read** (HTTPS URLs in feed). Write still folder-owned by `auth.uid()`.
- `profiles` SELECT open to authenticated (needed for search/social). Role escalation blocked by trigger.
- `app_competitions` readable by all auth users (public competitions feed). Write: owner/admin + active.
- `competition_requests` SELECT open (admin list). Update: organizer pending / admin.
- Auth rate limits for login/password reset: rely on Supabase Auth dashboard settings + `log_security_event` from client.

## Regression checklist after applying PHASE4

1. Organizer: send offer → freelancer accept/decline
2. Organizer: add referee photo → persists after refresh
3. Forum: like + admin status change
4. Private DM text/media send
5. Gift purchase
6. Suspended user: cannot post/DM (server error)
7. Normal login/signup/password change
8. Competition create/edit/media upload
9. UI unchanged (no visual diffs expected)

## Secrets

- Client uses **anon/publishable key only** (`EXPO_PUBLIC_SUPABASE_*`).
- Never ship `service_role` in the app.
