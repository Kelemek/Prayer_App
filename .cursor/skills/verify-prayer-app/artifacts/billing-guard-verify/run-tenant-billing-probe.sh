#!/usr/bin/env bash
# Run tenant billing self-grant probes on local Postgres only (127.0.0.1:54322).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="${DIR}/tenant-billing-probe-results.log"
PG_HOST=127.0.0.1
PG_PORT=54322
export PGPASSWORD=postgres

: >"$LOG"
echo "Tenant billing guard probe $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC" | tee -a "$LOG"
echo "Host: ${PG_HOST}:${PG_PORT} (local Docker only)" | tee -a "$LOG"
echo "" | tee -a "$LOG"

psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=0 \
  -f "$DIR/tenant-billing-self-grant-probe.sql" 2>&1 | tee -a "$LOG"

echo "" | tee -a "$LOG"
echo "Done. Full log: $LOG"
