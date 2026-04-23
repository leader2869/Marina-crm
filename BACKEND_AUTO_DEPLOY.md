# Backend auto-deploy to VPS

Workflow file: `.github/workflows/deploy-backend-vps.yml`

## Required GitHub Secrets

Add in `Settings -> Secrets and variables -> Actions`:

- `VPS_HOST` - server IP or domain (example: `89.108.78.221`)
- `VPS_USER` - SSH user (example: `root`)
- `VPS_PORT` - SSH port (usually `22`)
- `VPS_SSH_KEY` - private SSH key used by GitHub Actions
- `VPS_PROJECT_DIR` - project path on VPS (example: `/var/www/Marina-crm`)

## Optional GitHub Variable

- `API_HEALTH_URL` - health endpoint after deploy  
  Default: `https://api.1marina.ru/health`

## What workflow does

On push to `main`:

1. Connects to VPS via SSH
2. Runs `git pull --ff-only origin main`
3. Installs backend dependencies: `npm ci --omit=dev`
4. Builds backend: `npm run build:server`
5. Restarts app in PM2:
   - `pm2 restart marina-api` (if exists)
   - or starts `pm2 start dist/server.js --name marina-api`
6. Verifies API with health check URL

## One-time VPS preparation

Run once on VPS:

```bash
cd /var/www/Marina-crm
npm ci --omit=dev
npm run build:server
pm2 start dist/server.js --name marina-api
pm2 save
```
