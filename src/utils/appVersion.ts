import { execSync } from 'child_process';
import path from 'path';

let cachedVersion: string | null = null;

/** Версия деплоя: APP_VERSION из .env или git commit на VPS */
export function getAppVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  if (process.env.APP_VERSION && process.env.APP_VERSION.trim()) {
    cachedVersion = process.env.APP_VERSION.trim();
    return cachedVersion;
  }

  try {
    const projectRoot = path.join(__dirname, '..');
    cachedVersion = execSync('git rev-parse --short HEAD', {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return cachedVersion;
  } catch {
    cachedVersion = 'unknown';
    return cachedVersion;
  }
}
