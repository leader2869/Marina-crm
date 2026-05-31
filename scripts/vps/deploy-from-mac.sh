#!/usr/bin/env bash
# Деплой/обновление API на VPS с MacBook.
# Использование: ./scripts/vps/deploy-from-mac.sh
set -euo pipefail

VPS_IP="${VPS_IP:-185.46.11.187}"
SSH_USER="${SSH_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/marina_vps}"
APP_DIR="${APP_DIR:-/var/www/marina-crm}"
ENV_FILE="${ENV_FILE:-$(cd "$(dirname "$0")/../.." && pwd)/marina-vps.env}"

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)

echo "==> VPS: ${SSH_USER}@${VPS_IP}"
echo "==> ENV:  ${ENV_FILE}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Нет файла $ENV_FILE"
  exit 1
fi

if ! ssh "${SSH_OPTS[@]}" -o BatchMode=yes -o ConnectTimeout=10 "${SSH_USER}@${VPS_IP}" 'echo ok' >/dev/null 2>&1; then
  cat <<'EOF'

ERROR: SSH не подключается (ключ не принят сервером).

Что сделать в reg.ru:
  1. VPS → Sapphire Einsteinium Marina → «Доступ» / «SSH-ключи»
  2. Привяжите ключ marina-vps.pub к ЭТОМУ серверу
     (или пересоздайте VPS с уже добавленным ключом)
  3. Либо используйте пароль root из письма reg.ru:
       ssh root@185.46.11.187
     и вручную добавьте ключ:
       mkdir -p ~/.ssh && chmod 700 ~/.ssh
       echo 'ВАШ_ПУБЛИЧНЫЙ_КЛЮЧ' >> ~/.ssh/authorized_keys
       chmod 600 ~/.ssh/authorized_keys

Публичный ключ на Mac:
  cat ~/.ssh/marina_vps.pub

EOF
  exit 1
fi

echo "==> Загрузка .env..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${VPS_IP}" "mkdir -p '$APP_DIR'"
scp "${SSH_OPTS[@]}" "$ENV_FILE" "${SSH_USER}@${VPS_IP}:${APP_DIR}/.env"

echo "==> Запуск setup-server.sh..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${VPS_IP}" "bash -s" <<REMOTE
set -euo pipefail
APP_DIR='$APP_DIR'
if [[ ! -d "\$APP_DIR/.git" ]]; then
  apt-get update -y
  apt-get install -y git
  git clone --branch main https://github.com/leader2869/Marina-crm.git "\$APP_DIR"
fi
bash "\$APP_DIR/scripts/vps/setup-server.sh"
REMOTE

echo ""
echo "==> Проверка health..."
sleep 2
curl -sf "http://${VPS_IP}/health" && echo "" || echo "Health пока недоступен (проверьте pm2 logs)"

echo "Готово."
