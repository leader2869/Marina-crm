#!/usr/bin/env bash
# Первичная настройка VPS для Marina CRM API (Ubuntu 22.04/24.04/26.04).
# Запуск на сервере: bash setup-server.sh
set -eu

APP_DIR="${APP_DIR:-/var/www/marina-crm}"
APP_USER="${APP_USER:-root}"
REPO_URL="${REPO_URL:-https://github.com/leader2869/Marina-crm.git}"
BRANCH="${BRANCH:-main}"
NODE_MAJOR="${NODE_MAJOR:-20}"

echo "==> Marina CRM VPS setup"
echo "    APP_DIR=$APP_DIR"
echo "    REPO_URL=$REPO_URL"

export DEBIAN_FRONTEND=noninteractive

echo "==> Обновление пакетов..."
apt-get update -y
apt-get upgrade -y

echo "==> Базовые пакеты..."
apt-get install -y curl git nginx ufw ca-certificates gnupg

echo "==> Node.js ${NODE_MAJOR}.x..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo "==> Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Каталог приложения..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/uploads"
chmod 755 "$APP_DIR/uploads"

if [[ ! -d "$APP_DIR/.git" ]]; then
  if [[ -f "$APP_DIR/.env" ]]; then
    echo "==> Каталог без git, но есть .env — клонируем через repair-and-deploy..."
    if [[ -f "$APP_DIR/scripts/vps/repair-and-deploy.sh" ]]; then
      bash "$APP_DIR/scripts/vps/repair-and-deploy.sh"
      exit 0
    fi
    ENV_BACKUP="$(mktemp)"
    cp "$APP_DIR/.env" "$ENV_BACKUP"
    UPLOADS_DIR=""
    if [[ -d "$APP_DIR/uploads" ]]; then
      UPLOADS_DIR="$(mktemp -d)"
      cp -a "$APP_DIR/uploads/." "$UPLOADS_DIR/" 2>/dev/null || true
    fi
    rm -rf "$APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    cp "$ENV_BACKUP" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    rm -f "$ENV_BACKUP"
    if [[ -n "$UPLOADS_DIR" ]]; then
      mkdir -p "$APP_DIR/uploads"
      cp -a "$UPLOADS_DIR/." "$APP_DIR/uploads/" 2>/dev/null || true
      rm -rf "$UPLOADS_DIR"
    fi
  else
    echo "==> Клонирование репозитория..."
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
else
  echo "==> Обновление репозитория..."
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull origin "$BRANCH"
fi

cd "$APP_DIR"

if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "ERROR: Нет $APP_DIR/.env — загрузите marina-vps.env с Mac (deploy-from-mac.sh)."
  exit 1
fi
chmod 600 "$APP_DIR/.env"

echo "==> Зависимости и сборка backend..."
npm ci
npm run build:server

echo "==> PM2: marina-crm-api..."
pm2 delete marina-crm-api 2>/dev/null || true
pm2 start dist/server.js --name marina-crm-api
pm2 save
pm2 startup systemd -u "$APP_USER" --hp "/root" | tail -1 | bash || true

echo "==> Nginx..."
install -m 644 "$APP_DIR/scripts/vps/nginx-api.1marina.ru.conf" /etc/nginx/sites-available/marina-crm-api
ln -sf /etc/nginx/sites-available/marina-crm-api /etc/nginx/sites-enabled/marina-crm-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo ""
echo "==> Готово (HTTP)."
echo "    Health: http://$(curl -s ifconfig.me 2>/dev/null || echo 'VPS_IP')/health"
echo ""
echo "Дальше:"
echo "  1. DNS: A-запись api.1marina.ru -> IP VPS"
echo "  2. SSL:  certbot --nginx -d api.1marina.ru"
echo "  3. GitHub Variable VITE_API_URL=https://api.1marina.ru/api + redeploy фронта"
echo "  4. Zvonok postback: https://api.1marina.ru/api/auth/phone-verification/postback?..."
