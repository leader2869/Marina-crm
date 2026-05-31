#!/bin/bash
# Запустить на MacBook после того, как bootstrap-on-vps-console.sh выполнен на VPS.
set -eu

VPS_IP="${VPS_IP:-185.46.11.187}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/marina_vps}"
REPO="${REPO:-leader2869/Marina-crm}"

echo "==> Проверка SSH..."
if ! ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10 "root@${VPS_IP}" 'echo SSH_OK'; then
  echo ""
  echo "SSH не работает. Сначала на VPS (консоль reg.ru) выполните:"
  echo "  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/scripts/vps/bootstrap-on-vps-console.sh | bash"
  exit 1
fi

echo ""
echo "==> GitHub secret VPS_SSH_KEY (скопируйте в GitHub → Settings → Secrets):"
echo "---BEGIN VPS_SSH_KEY---"
cat "$SSH_KEY"
echo "---END VPS_SSH_KEY---"
echo ""
echo "Также нужны secrets:"
echo "  VPS_HOST = ${VPS_IP}"
echo "  VPS_USER = root"
echo ""
echo "Проверка формата ключа:"
ssh-keygen -y -f "$SSH_KEY" >/dev/null && echo "  формат OK"
echo ""
echo "==> Деплой .env и проверка API..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${ENV_FILE:-$(cd "$SCRIPT_DIR/../.." && pwd)/marina-vps.env}"
if [ -f "$ENV_FILE" ]; then
  scp -i "$SSH_KEY" "$ENV_FILE" "root@${VPS_IP}:/var/www/marina-crm/.env"
  ssh -i "$SSH_KEY" "root@${VPS_IP}" 'chmod 600 /var/www/marina-crm/.env'
  echo "  .env загружен"
else
  echo "  marina-vps.env не найден — пропуск"
fi

ssh -i "$SSH_KEY" "root@${VPS_IP}" 'bash /var/www/marina-crm/scripts/vps/repair-and-deploy.sh' || \
  ssh -i "$SSH_KEY" "root@${VPS_IP}" 'curl -fsSL https://raw.githubusercontent.com/leader2869/Marina-crm/main/scripts/vps/repair-and-deploy.sh | sed "s/\r$//" | bash'

echo ""
curl -sf "https://api.1marina.ru/health" && echo ""
