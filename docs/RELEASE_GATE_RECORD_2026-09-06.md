# Release Gate Record — 2026-09-06

## 1. Release Identity

| Field | Value |
| --- | --- |
| Commit | `b6ad0ab` |
| Version | `1.0.179` |
| Date | `2026-09-06` |
| Repo | `alrjaa/Seellie` |
| Channel | Production web (`www.seellie.com`) via GitHub → Vercel |

---

## 2. Validation Results

| Suite | Result |
| --- | --- |
| Smoke (login, admin route, home / competitions / unique) | **PASS** |
| E2E critical + smoke (`npm run test:e2e`) | **9/9 PASS** |

**Note:** Multi-role scenarios that previously **SKIP**ped (missing `E2E_*` credentials) were executed with dedicated E2E accounts and **PASS**ed (follower, organizer, admin via `/admin`).

Secrets used for that run were subsequently rotated; see `docs/E2E_SECRETS_AUDIT_2026-09-06.md`.

---

## 3. Security / Runtime Status

| Item | Status |
| --- | --- |
| Edge CORS (FIX-06) | Allowlist reflect — verified `Origin: https://www.seellie.com` → `Access-Control-Allow-Origin: https://www.seellie.com`; non-allowlisted origins receive no ACAO |
| Edge redeployed | `sports-proxy`, `send-email`, `verify-store-purchase` |
| P0–P2 merges | On `main` at approved commit `b6ad0ab` (plus docs closeout commits after this record if any) |
| E2E secrets in git | **No secret values** in tracked files / history (placeholders only) |

---

## 4. Residual Risks

| Risk | Count / detail | Impact | Blocks launch? |
| --- | --- | --- | --- |
| `npm audit --omit=dev` high | **10 high** (33 total: 23 moderate / 10 high / 0 critical) | Mostly transitive Expo 54 / tooling chain; full clear needs Expo 57-class upgrade (`audit fix --force` rejected as breaking) | **No** — accepted with mitigation timeline |
| CSP still allows `'unsafe-inline'` / `'unsafe-eval'` on web | Expo web constraint | XSS defense-in-depth weaker than ideal | **No** — track hardening when Expo allows |
| E2E credentials operational | Disposable Supabase users; rotate after exposure | Test env compromise ≠ prod data if RLS holds | **No** |

---

## 5. Mitigation Timeline

| Horizon | Actions |
| --- | --- |
| **7 days** | Confirm production Supabase project parity for P0/P2 SQL if any env differs from linked project; store E2E secrets only in Secret Manager / CI encrypted vars; scrub local `test-results/` after every failure |
| **30 days** | Plan Expo SDK upgrade path to clear high audit findings; tighten CSP as Expo web permits; add CI job for `npm run test:e2e` using encrypted secrets (no plaintext in logs) |
| **90 days** | Complete dependency high-vuln burn-down; re-audit Edge CORS allowlist for new hosts; periodic E2E account rotation schedule (at least quarterly) |

---

## 6. Approvals

| Role | Name / ID | Timestamp (UTC) |
| --- | --- | --- |
| Prepared by | Cursor agent (operational closeout) | 2026-09-06T20:49:23Z |
| Reviewed by | _Pending human review_ | — |
| Approved by | _Pending release owner_ | — |

**Operator note:** Fill Reviewed/Approved after human sign-off. This record documents technical gate evidence for `b6ad0ab` / `1.0.179`.

---

## Related docs

- `docs/E2E_SECRETS_AUDIT_2026-09-06.md`
- `REMEDIATION_REPORT_P0.md` / `P1` / `P2` (repo root)
