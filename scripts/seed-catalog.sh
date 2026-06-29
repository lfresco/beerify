#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <API_BASE_URL> <ADMIN_SECRET>"
  echo "Example: $0 https://beerlog-api.onrender.com my-super-secret"
  exit 1
fi

API_BASE_URL="$1"
ADMIN_SECRET="$2"

curl -sS -X POST "$API_BASE_URL/catalog/ingest" \
  -H "X-Admin-Key: $ADMIN_SECRET" \
  -H "Content-Type: application/json"

echo
