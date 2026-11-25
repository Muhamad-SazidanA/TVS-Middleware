#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"

MODE="${DEPLOY_MODE:-auto}"
RUN_SEED="false"

for arg in "$@"; do
  case "$arg" in
    --docker) MODE="docker" ;;
    --pm2) MODE="pm2" ;;
    --seed) RUN_SEED="true" ;;
    *)
      echo "[docmatch] Unknown argument: $arg"
      echo "Usage: bash deploy/deploy.sh [--docker|--pm2] [--seed]"
      exit 1
      ;;
  esac
done

echo "[docmatch] Deploying in: $APP_DIR"

if [ ! -f ".env" ]; then
  echo "[docmatch] ERROR: File .env tidak ditemukan di $APP_DIR"
  echo "Salin template terlebih dahulu:"
  echo "  cp .env.production.example .env && nano .env"
  exit 1
fi

mkdir -p public/uploads

if [ -d ".git" ]; then
  echo "[docmatch] Pulling latest changes from origin/master..."
  git fetch origin master
  git pull --ff-only origin master
fi

read_port_from_env() {
  local port
  port="$(grep -E '^DOCMATCH_PORT=' .env | tail -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)"
  echo "${port:-3100}"
}

APP_PORT="$(read_port_from_env)"

if [ "$MODE" = "auto" ]; then
  if command -v pm2 >/dev/null 2>&1 && pm2 describe docmatch >/dev/null 2>&1; then
    MODE="pm2"
  elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    MODE="docker"
  elif command -v pm2 >/dev/null 2>&1; then
    MODE="pm2"
  else
    echo "[docmatch] ERROR: Tidak ditemukan Docker Compose maupun PM2 di VPS."
    exit 1
  fi
fi

echo "[docmatch] Using deploy mode: $MODE (port: $APP_PORT)"

if [ "$MODE" = "docker" ]; then
  docker compose up -d --build --remove-orphans
  docker image prune -f >/dev/null 2>&1 || true

  if [ "$RUN_SEED" = "true" ]; then
    echo "[docmatch] Seeding initial database accounts..."
    docker compose exec -T docmatch-app npm run db:seed
  fi
elif [ "$MODE" = "pm2" ]; then
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
  npm ci
  npx prisma generate
  npx prisma db push --skip-generate
  SKIP_ENV_VALIDATION=1 npm run build

  if [ "$RUN_SEED" = "true" ]; then
    echo "[docmatch] Seeding initial database accounts..."
    npm run db:seed
  fi

  if pm2 describe docmatch >/dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --update-env
  else
    pm2 start ecosystem.config.cjs
  fi
  pm2 save
else
  echo "[docmatch] ERROR: Invalid DEPLOY_MODE '$MODE'. Expected 'docker', 'pm2', or 'auto'."
  exit 1
fi

echo "[docmatch] Waiting for app health check at http://127.0.0.1:${APP_PORT}/login ..."
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/login" >/dev/null 2>&1; then
    echo "[docmatch] Deploy SUCCESS! App responding on 127.0.0.1:${APP_PORT}"
    exit 0
  fi
  sleep 2
done

echo "[docmatch] WARNING: App did not respond on http://127.0.0.1:${APP_PORT}/login within 40s."
if [ "$MODE" = "docker" ]; then
  docker compose logs --tail=50 docmatch-app || true
else
  pm2 logs docmatch --lines 50 --nostream || true
fi
exit 1
