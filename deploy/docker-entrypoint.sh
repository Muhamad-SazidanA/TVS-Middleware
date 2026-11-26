#!/usr/bin/env bash
set -euo pipefail

mkdir -p /app/public/uploads

if [ "${RUN_DB_PUSH_ON_START:-true}" = "true" ]; then
  echo "[docmatch] Syncing Prisma schema to PostgreSQL..."
  attempts=0
  max_attempts=15
  until npx prisma db push --skip-generate; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge "$max_attempts" ]; then
      echo "[docmatch] ERROR: prisma db push failed after $max_attempts attempts."
      exit 1
    fi
    echo "[docmatch] Database not ready yet ($attempts/$max_attempts), retrying in 3s..."
    sleep 3
  done
fi

if [ "${RUN_EQUIVALENCY_SEED_ON_START:-true}" = "true" ]; then
  echo "[docmatch] Checking Kamus Ekuivalensi seed..."
  node scripts/seed-equivalencies.mjs
fi

if [ "${RUN_DB_SEED_ON_START:-false}" = "true" ]; then
  echo "[docmatch] Running seed script..."
  npm run db:seed
fi

exec "$@"
