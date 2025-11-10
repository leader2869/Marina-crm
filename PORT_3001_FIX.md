# Решение проблемы "Порт 3001 занят"

## Проблема

Ошибка: `Error: listen EADDRINUSE: address already in use :::3001`

Это означает, что порт 3001 уже занят другим процессом.

## Решение

### Способ 1: Использовать скрипт (рекомендуется)

```powershell
.\kill-port-3001.ps1
```

Этот скрипт автоматически найдет и завершит процесс, использующий порт 3001.

### Способ 2: Вручную через PowerShell

```powershell
# 1. Найти процесс, использующий порт 3001
Get-NetTCPConnection -LocalPort 3001 | Select-Object LocalPort, State, OwningProcess

# 2. Завершить процесс (замените PID на реальный ID процесса)
Stop-Process -Id <PID> -Force
```

### Способ 3: Через командную строку

```cmd
# 1. Найти процесс
netstat -ano | findstr :3001

# 2. Завершить процесс (замените PID на реальный ID процесса)
taskkill /F /PID <PID>
```

## После освобождения порта

Запустите сервер:

```bash
npm run dev:server
```

## Проверка

Проверьте, что сервер запущен:

```powershell
netstat -ano | findstr "LISTENING" | findstr :3001
```

Или проверьте health endpoint:

```powershell
Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET
```

## Автоматическое освобождение порта

Если проблема возникает часто, можно добавить скрипт в `package.json`:

```json
{
  "scripts": {
    "kill-port": "powershell -ExecutionPolicy Bypass -File kill-port-3001.ps1",
    "dev:server": "npm run kill-port && nodemon --exec ts-node src/server.ts"
  }
}
```

Тогда порт будет автоматически освобождаться перед запуском сервера.

