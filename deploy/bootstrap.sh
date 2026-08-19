#!/usr/bin/env bash
# Bootstrap VPS stack: build, wait for health, index ChromaDB, optional Let's Encrypt.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Copy .env.example and fill production values."
  exit 1
fi

# shellcheck disable=SC1091
set -a && source .env && set +a

echo "==> Building and starting postgres + backend + frontend..."
$COMPOSE up -d --build postgres
$COMPOSE up -d --build backend frontend

echo "==> Waiting for backend /health..."
for i in $(seq 1 60); do
  if $COMPOSE exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" 2>/dev/null; then
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "ERROR: backend did not become healthy in time."
    $COMPOSE logs backend
    exit 1
  fi
  sleep 3
done

echo "==> Indexing ChromaDB (RAG)..."
$COMPOSE exec -T backend python -m app.rag.indexer

if [[ -n "${DOMAIN:-}" ]]; then
  echo "==> Setting up Nginx + Let's Encrypt for ${DOMAIN}..."
  bash deploy/init-letsencrypt.sh
else
  echo "WARN: DOMAIN not set — skipping nginx/certbot. Set DOMAIN in .env and run deploy/init-letsencrypt.sh"
fi

echo "==> Done."
echo "    Health: curl -s https://${DOMAIN:-localhost}/health"
echo "    Logs:   $COMPOSE logs -f"
