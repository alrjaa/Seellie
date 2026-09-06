# E2E Secrets Audit — 2026-09-06

**Repo:** `alrjaa/Seellie`  
**Approved commit:** `b6ad0ab` (v1.0.179)  
**Audit date (UTC):** 2026-09-06  

> **Policy:** Do not store real E2E secrets in the repository. Use `.env.e2e.local` (gitignored) locally, or GitHub Actions / Vercel / 1Password (or equivalent) Secret Manager for CI.

---

## A1 — Git history scan

### Patterns checked
- `e2e.` / `E2E_`
- `@example.com`
- `password` / `E2E_*_PASSWORD=`
- Exact accounts:
  - `e2e.follower.seellie@example.com`
  - `e2e.organizer.seellie@example.com`
  - `e2e.admin.seellie@example.com`

### Results

| Check | Result |
| --- | --- |
| Pickaxe (`git log -S`) for the three E2E emails | **0 commits** — emails never entered git history |
| `-G E2E_*_PASSWORD=` | **1 commit** `0943663` — `REMEDIATION_REPORT_P2.md` uses placeholders `...` only |
| Tracked tree at `HEAD` (`b6ad0ab`) | Specs read `process.env.E2E_*`; report uses placeholders; **no secret values** |
| Tracked `.env.e2e.local` / Playwright `test-results` | **Not tracked**; ignored via `.gitignore` |

**Verdict:** No E2E secret values found in git history or tracked files.

### Non-git residual note (local only)
During a prior local Playwright failure, an error-context artifact on the operator machine briefly rendered a password in a **gitignored** `test-results/` file. That path is ignored (`test-results/`). Artifacts were scrubbed locally and passwords were rotated (A3).

**History rewrite:** not required (no git exposure). Do not rewrite history unless a future scan finds committed secrets.

---

## A2 — Build / deploy logs

| Source | Result |
| --- | --- |
| GitHub Actions workflows | `total_count=0` — no Actions workflows emitting logs for this repo |
| GitHub commit status for `b6ad0ab` | Vercel: **success** — description is deploy status only (no env dumps observed via public status API) |
| Local CLI `npx vercel --prod` | Previously failed with `Not authorized` (no token) — no secret-bearing deploy log from CLI |

**Verdict:** `No secret exposure found` in available Actions/Vercel status surfaces.

---

## A3 — Password rotation

| Field | Value |
| --- | --- |
| Rotated at (UTC) | `2026-09-06T20:49:23Z` |
| Accounts | `e2e.follower.seellie@example.com`, `e2e.organizer.seellie@example.com`, `e2e.admin.seellie@example.com` |
| Method | Supabase Auth Admin `PUT /auth/v1/admin/users/{id}` (password reset + `email_confirm`) |
| Post-check | Password grant login for follower → HTTP 200 + access token |
| Where new values are stored | **Operator Secret Manager / local only:** gitignored `.env.e2e.local` on the machine that ran rotation. **Not** in the repo. For CI, copy into GitHub Actions encrypted secrets / Vercel encrypted env / team password manager — never into git. |

---

## A4 — Local env hardening

| Control | Status |
| --- | --- |
| `.env.e2e.local` in `.gitignore` | Yes (explicit + `.env*.local`) |
| `.env.e2e.example` placeholders only | Added |
| Docs warning | This file + Release Gate Record |

---

## Residual risks

1. Operator machines may still have old Playwright screenshots/context under `test-results/` if not deleted — keep ignored; scrub after failures.
2. Shared E2E password across three roles (operational simplicity) — acceptable for disposable test users; rotate after any suspected exposure.
3. No GitHub Actions secret store configured yet — until CI exists, secrets live only in local gitignored env / external Secret Manager.

---

## Closeout summary (PR description text)

- **Leak in git/logs?** No  
- **Accounts rotated?** Yes (`2026-09-06T20:49:23Z` UTC)  
- **Official docs complete?** Yes (`docs/E2E_SECRETS_AUDIT_2026-09-06.md`, `docs/RELEASE_GATE_RECORD_2026-09-06.md`)
