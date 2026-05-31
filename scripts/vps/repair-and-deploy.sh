#!/bin/bash
# Восстановление и деплой API на VPS.
# Запуск: bash repair-and-deploy.sh
# Одной строкой:
#   curl -fsSL https://raw.githubusercontent.com/leader2869/Marina-crm/main/scripts/vps/repair-and-deploy.sh | sed 's/\r$//' | bash
if [ -z "${BASH_VERSION:-}" ]; then
  echo "ERROR: нужен bash. Запустите: bash repair-and-deploy.sh"
  exit 1
fi
set -eu

APP_DIR="${APP_DIR:-/var/www/marina-crm}"
REPO_URL="${REPO_URL:-https://github.com/leader2869/Marina-crm.git}"
BRANCH="${BRANCH:-main}"

echo "==> Marina CRM: repair + deploy"
echo "    APP_DIR=$APP_DIR"

resolve_repo_root() {
  if [ -d "$APP_DIR/.git" ] && [ -f "$APP_DIR/package.json" ]; then
    echo "$APP_DIR"
    return 0
  fi
  if [ -d "$APP_DIR/repo/.git" ] && [ -f "$APP_DIR/repo/package.json" ]; then
    echo "$APP_DIR/repo"
    return 0
  fi
  return 1
}

backup_and_clone() {
  echo "==> Репозиторий не найден — клонируем заново в $APP_DIR"

  env_backup=""
  uploads_backup=""

  if [ -f "$APP_DIR/.env" ]; then
    env_backup="$(mktemp)"
    cp "$APP_DIR/.env" "$env_backup"
    echo "    .env сохранён"
  elif [ -f "$APP_DIR/repo/.env" ]; then
    env_backup="$(mktemp)"
    cp "$APP_DIR/repo/.env" "$env_backup"
    echo "    .env сохранён (из repo/)"
  fi

  if [ -d "$APP_DIR/uploads" ]; then
    uploads_backup="$(mktemp -d)"
    cp -a "$APP_DIR/uploads/." "$uploads_backup/" 2>/dev/null || true
    echo "    uploads сохранены"
  fi

  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"

  if [ -n "$env_backup" ]; then
    cp "$env_backup" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    rm -f "$env_backup"
  fi

  if [ -n "$uploads_backup" ]; then
    mkdir -p "$APP_DIR/uploads"
    cp -a "$uploads_backup/." "$APP_DIR/uploads/" 2>/dev/null || true
    rm -rf "$uploads_backup"
  fi
}

if ! REPO_ROOT="$(resolve_repo_root)"; then
  backup_and_clone
  REPO_ROOT="$APP_DIR"
fi

cd "$REPO_ROOT"
echo "==> Рабочая директория: $(pwd)"

if [ ! -f .env ]; then
  echo ""
  echo "ERROR: Нет файла .env в $REPO_ROOT"
  echo "Загрузите marina-vps.env с Mac:"
  echo "  scp -i ~/.ssh/marina_vps marina-vps.env root@185.46.11.187:/var/www/marina-crm/.env"
  exit 1
fi
chmod 600 .env

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js не установлен. Запустите: bash scripts/vps/setup-server.sh"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo "==> git pull..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

APP_VERSION="$(git rev-parse --short HEAD)"
if grep -q '^APP_VERSION=' .env; then
  sed -i "s/^APP_VERSION=.*/APP_VERSION=${APP_VERSION}/" .env
else
  echo "APP_VERSION=${APP_VERSION}" >> .env
fi
echo "    version=$APP_VERSION"

echo "==> npm ci..."
npm ci

echo "==> npm run build:server..."
npm run build:server

if [ ! -f dist/server.js ]; then
  echo "ERROR: dist/server.js не найден"
  ls -la dist/ 2>/dev/null || ls -la
  exit 1
fi

echo "==> PM2 restart..."
pm2 delete marina-crm-api 2>/dev/null || true
pm2 start dist/server.js --name marina-crm-api
pm2 save

echo "==> Health check..."
sleep 3
if curl -sf "http://127.0.0.1:3001/health"; then
  echo ""
  echo "==> Готово. Проверка снаружи:"
  echo "    curl https://api.1marina.ru/health"
else
  echo ""
  echo "ERROR: API не отвечает на :3001"
  pm2 status
  pm2 logs marina-crm-api --lines 40 --nostream
  exit 1
fi
