#!/usr/bin/env bash
# Shared paths and defaults for verify-prayer-app helpers.
# Source this file; do not execute it.

set -euo pipefail

skill_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$here/.." && pwd
}

repo_root() {
  local skill
  skill="$(skill_root)"
  cd "$skill/../../.." && pwd
}

: "${PRAYER_APP_VERIFY_HOST:=127.0.0.1}"
: "${PRAYER_APP_VERIFY_PORT:=4200}"
: "${PRAYER_APP_VERIFY_RUN_ID:=$$}"

SKILL_ROOT="$(skill_root)"
REPO_ROOT="$(repo_root)"
STATE_DIR="${PRAYER_APP_VERIFY_STATE_DIR:-/tmp/prayer-app-verify-${PRAYER_APP_VERIFY_RUN_ID}}"
EVIDENCE_DIR="${PRAYER_APP_VERIFY_EVIDENCE_DIR:-${SKILL_ROOT}/artifacts/${PRAYER_APP_VERIFY_RUN_ID}}"
PID_FILE="${STATE_DIR}/ng-serve.pid"
LOG_FILE="${STATE_DIR}/ng-serve.log"
META_FILE="${STATE_DIR}/instance.json"
BASE_URL="${PRAYER_APP_VERIFY_BASE_URL:-http://${PRAYER_APP_VERIFY_HOST}:${PRAYER_APP_VERIFY_PORT}}"

PRODUCTION_HOSTS="prayerapp.romans8.net prayer.romans8.net"

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

ensure_evidence_dir() {
  mkdir -p "$EVIDENCE_DIR"
}

base_host() {
  python3 - <<'PY' "$BASE_URL"
import sys
from urllib.parse import urlparse
print((urlparse(sys.argv[1]).hostname or "").lower())
PY
}

is_production_host() {
  local host
  host="$(base_host)"
  for blocked in $PRODUCTION_HOSTS; do
    if [[ "$host" == "$blocked" ]]; then
      return 0
    fi
  done
  return 1
}

require_non_production() {
  if is_production_host; then
    echo "REFUSE: $BASE_URL is a production host. Drive local ng serve or a non-prod preview, never prayerapp.romans8.net / prayer.romans8.net." >&2
    exit 2
  fi
}

print_instance() {
  cat <<EOF
run_id=${PRAYER_APP_VERIFY_RUN_ID}
base_url=${BASE_URL}
state_dir=${STATE_DIR}
evidence_dir=${EVIDENCE_DIR}
pid_file=${PID_FILE}
log_file=${LOG_FILE}
EOF
}
