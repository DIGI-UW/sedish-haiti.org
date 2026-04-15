#!/usr/bin/env bash
# set-subscription.sh
#
# Repoint a subscription at a new target URL by deleting the existing
# subscription whose targetAddress == OLD_URL and creating a new one with NEW_URL.
#
# Usage:
#   set-subscription.sh <OLD_URL> <NEW_URL> [BASE_URL]
#
# BASE_URL defaults to $LNSP_MEDIATOR_URL or http://localhost:3000
#
# Requires: curl, jq

set -euo pipefail

OLD_URL="${1:-}"
NEW_URL="${2:-}"
BASE_URL="${3:-${LNSP_MEDIATOR_URL:-http://localhost:3000}}"

if [[ -z "$OLD_URL" || -z "$NEW_URL" ]]; then
  echo "Usage: $0 <OLD_URL> <NEW_URL> [BASE_URL]" >&2
  echo "  BASE_URL defaults to \$LNSP_MEDIATOR_URL or http://localhost:3000" >&2
  exit 2
fi

command -v curl >/dev/null || { echo "curl is required" >&2; exit 127; }
command -v jq   >/dev/null || { echo "jq is required"   >&2; exit 127; }

echo "Looking up subscription where targetAddress=${OLD_URL} at ${BASE_URL} ..."
OLD_ID=$(curl -fsS "${BASE_URL}/subscription" \
  | jq -r --arg url "$OLD_URL" '.[] | select(.targetAddress == $url) | ._id' \
  | head -n 1)

if [[ -n "$OLD_ID" ]]; then
  echo "Deleting subscription ${OLD_ID} (${OLD_URL}) ..."
  curl -fsS -X DELETE "${BASE_URL}/subscription/${OLD_ID}" >/dev/null
else
  echo "No existing subscription for ${OLD_URL} -- skipping delete."
fi

echo "Creating subscription for ${NEW_URL} ..."
curl -fsS -X POST "${BASE_URL}/subscription" \
  -H 'Content-Type: application/json' \
  -d "{\"targetAddress\":\"${NEW_URL}\"}" \
  | jq .

echo "Done."
