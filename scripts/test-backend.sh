#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env in repo root. Copy .env.example first."
  exit 1
fi

set -a
source .env
set +a

cd backend
poetry run pytest -q
