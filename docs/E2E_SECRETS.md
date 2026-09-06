# E2E secrets — operator warning

**Do not store real secrets in the repository.**

- Use `.env.e2e.example` as a template (placeholders only).
- Copy to `.env.e2e.local` (gitignored) or inject via Secret Manager / CI encrypted environment variables.
- Never commit passwords, tokens, or `.env.e2e.local`.
- After any suspected exposure: rotate Supabase Auth passwords for E2E users and scrub local Playwright `test-results/`.

See `docs/E2E_SECRETS_AUDIT_2026-09-06.md` for the 2026-09-06 audit and rotation record.
