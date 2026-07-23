#!/usr/bin/env bash
# Read-only HubDB API client. GET is hardcoded — this script cannot write.
# Usage: scripts/hubdb.sh <path> [curl-args...]
#   scripts/hubdb.sh /cms/v3/hubdb/tables
#   scripts/hubdb.sh /cms/v3/hubdb/tables/<idOrName>/rows
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$ROOT/.env"; set +a
fi

if [[ -z "${HUBSPOT_TOKEN:-}" ]]; then
  echo "error: HUBSPOT_TOKEN not set (expected in $ROOT/.env)" >&2
  exit 1
fi

PATH_ARG="${1:?usage: hubdb.sh <api-path>}"
shift || true

case "$PATH_ARG" in
  /cms/v3/hubdb/*) ;;
  *) echo "error: path not in HubDB read allowlist: $PATH_ARG" >&2; exit 1 ;;
esac

exec curl -sS --fail-with-body \
  --request GET \
  --url "https://api.hubapi.com${PATH_ARG}" \
  --header "Authorization: Bearer ${HUBSPOT_TOKEN}" \
  "$@"
