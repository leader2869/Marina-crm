#!/bin/bash
# Запустить НА VPS в веб-консоли reg.ru (одной вставкой).
# Настраивает SSH-ключ и проверяет API.
set -eu

PUB_KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEnu1Wq6TLJjhDnpxn7PH3CZqpL0mqONlQV8Ty1eABQo marina-vps'

echo "==> 1. SSH: добавляем публичный ключ"
mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
if grep -qF "$PUB_KEY" /root/.ssh/authorized_keys; then
  echo "    ключ marina-vps уже есть"
else
  echo "$PUB_KEY" >> /root/.ssh/authorized_keys
  echo "    ключ marina-vps добавлен"
fi

echo "==> 2. SSH: права и sshd"
chown -R root:root /root/.ssh
# Разрешить вход root по ключу (Ubuntu по умолчанию)
if [ -f /etc/ssh/sshd_config ]; then
  sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || service ssh reload 2>/dev/null || true
fi

echo "==> 3. API: обновление кода"
APP_DIR=/var/www/marina-crm
if [ ! -d "$APP_DIR/.git" ]; then
  echo "    git clone..."
  ENV_BAK=""
  [ -f "$APP_DIR/.env" ] && ENV_BAK=$(mktemp) && cp "$APP_DIR/.env" "$ENV_BAK"
  rm -rf "$APP_DIR"
  git clone https://github.com/leader2869/Marina-crm.git "$APP_DIR"
  [ -n "$ENV_BAK" ] && cp "$ENV_BAK" "$APP_DIR/.env" && chmod 600 "$APP_DIR/.env" && rm -f "$ENV_BAK"
fi
cd "$APP_DIR"
git fetch origin main
git checkout main
git pull origin main
npm ci
npm run build:server
pm2 delete marina-crm-api 2>/dev/null || true
pm2 start dist/server.js --name marina-crm-api
pm2 save

echo "==> 4. Health"
sleep 2
curl -sf http://127.0.0.1:3001/health && echo ""
git rev-parse --short HEAD

echo ""
echo "==> Готово на сервере."
echo "    Теперь на Mac: ssh -i ~/.ssh/marina_vps root@185.46.11.187 'echo ok'"
