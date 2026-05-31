#!/bin/bash
# Вывести base64 deploy-ключа для GitHub Secret VPS_SSH_KEY_B64
set -eu

VPS_IP="${VPS_IP:-185.46.11.187}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/marina_vps}"

REMOTE_KEY="/root/.ssh/github_actions"

if ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 "root@${VPS_IP}" "test -f ${REMOTE_KEY}" 2>/dev/null; then
  ssh -i "$SSH_KEY" -o BatchMode=yes "root@${VPS_IP}" "base64 < ${REMOTE_KEY} | tr -d '\n'"
  echo ""
  echo "# одна строка -> GitHub -> Settings -> Secrets -> VPS_SSH_KEY_B64" >&2
  echo "# Fingerprint: SHA256:xbgDZQRTV5qeUU6/f/zWxSsprIMnCuzxMroyS0GwHeE" >&2
else
  echo "Ключ ${REMOTE_KEY} не найден на VPS." >&2
  exit 1
fi
