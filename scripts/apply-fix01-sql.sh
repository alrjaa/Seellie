#!/usr/bin/env bash
# Apply FIX-01-ANALYST-SECRETS.sql using a Database connection string.
# Usage:
#   export SEELLIE_DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@aws-0-....pooler.supabase.com:6543/postgres'
#   bash scripts/apply-fix01-sql.sh
# Never commit the URL. Never use service_role in the app.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/supabase/FIX-01-ANALYST-SECRETS.sql"
URL="${SEELLIE_DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "SEELLIE_DATABASE_URL is required (Database URI from Supabase → Settings → Database)."
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL client or run the SQL in Supabase SQL Editor."
  exit 3
fi
echo "Applying FIX-01-ANALYST-SECRETS.sql (no secrets will be printed)..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "Done. Verify with REST: analyst_access_codes + RPCs."
