# 🚀 Руководство по открытию проекта на Vercel

## 📍 Шаг 1: Получить URL проекта

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard)
2. Найдите ваш проект `Marina-crm`
3. Скопируйте **Production URL** (например: `https://marina-crm-xxxxx.vercel.app`)

## 🔧 Шаг 2: Настроить переменные окружения

В Vercel Dashboard → Settings → Environment Variables добавьте:

### Обязательные переменные:

```env
# База данных Supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:6543/postgres
# ИЛИ используйте отдельные переменные:
DB_HOST=db.xxxxx.supabase.co
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_very_secure_secret_key_here
JWT_EXPIRES_IN=7d

# Frontend URL (ваш Vercel URL или домен)
FRONTEND_URL=https://your-vercel-url.vercel.app

# Node Environment
NODE_ENV=production
```

### Где взять DATABASE_URL:

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings → Database**
4. Скопируйте **Connection string** (используйте **Session Pooler** с портом 6543)

## ✅ Шаг 3: Проверить работу API

### 1. Проверка health endpoint:

Откройте в браузере:
```
https://your-vercel-url.vercel.app/health
```

Должен вернуться JSON:
```json
{
  "status": "ok",
  "timestamp": "2025-01-10T19:00:00.000Z"
}
```

### 2. Проверка API endpoints:

- **Health**: `https://your-vercel-url.vercel.app/health`
- **Auth**: `https://your-vercel-url.vercel.app/api/auth/login`
- **Clubs**: `https://your-vercel-url.vercel.app/api/clubs`
- **Vessels**: `https://your-vercel-url.vercel.app/api/vessels`

## 🌐 Шаг 4: Настройка Frontend для работы с Vercel API

### Вариант 1: Frontend запущен локально

Если frontend запущен локально (`npm run dev`), создайте файл `client/.env`:

```env
VITE_API_URL=https://your-vercel-url.vercel.app/api
```

**Важно:** Замените `your-vercel-url.vercel.app` на ваш реальный URL из Vercel Dashboard.

### Вариант 2: Frontend задеплоен на Vercel

Если frontend задеплоен на Vercel (в том же проекте или отдельном), API будет работать автоматически с относительным путем `/api`.

**Примечание:** Код уже настроен для автоматического использования относительного пути `/api` в production.

## 🚀 Шаг 5: Деплой Frontend (опционально)

Если нужно задеплоить frontend отдельно:

### Вариант 1: Vercel (отдельный проект)

1. Создайте новый проект в Vercel
2. Root Directory: `client`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Environment Variables:
   ```env
   VITE_API_URL=https://your-backend-url.vercel.app/api
   ```

### Вариант 2: Локальный запуск frontend

```bash
cd client
npm install
npm run dev
```

Откройте: `http://localhost:5173`

В файле `client/.env` укажите:
```env
VITE_API_URL=https://your-vercel-url.vercel.app/api
```

## 🔍 Шаг 5: Проверка логов

Если что-то не работает:

1. Откройте Vercel Dashboard → ваш проект
2. Перейдите в **Deployments**
3. Выберите последний деплой
4. Откройте **Logs** для просмотра ошибок

## 🐛 Устранение проблем

### Ошибка: "База данных не подключена"

**Решение:**
1. Проверьте `DATABASE_URL` в Environment Variables
2. Убедитесь, что используете **Session Pooler** (порт 6543)
3. Проверьте, что проект Supabase активен

### Ошибка: 503 Service Unavailable

**Решение:**
1. Проверьте логи в Vercel Dashboard
2. Убедитесь, что все переменные окружения установлены
3. Проверьте подключение к Supabase

### Ошибка: CORS

**Решение:**
1. Убедитесь, что `FRONTEND_URL` установлен правильно
2. Проверьте, что URL совпадает с адресом frontend

## 📝 Полезные команды

### Проверка подключения к базе данных:

```bash
npm run check-data
```

### Просмотр логов локально:

```bash
npm run dev:server
```

## 🎯 Следующие шаги

1. ✅ Настроить переменные окружения в Vercel
2. ✅ Проверить health endpoint
3. ✅ Протестировать API endpoints
4. ✅ Задеплоить frontend (если нужно)
5. ✅ Настроить домен (опционально)

---

**Важно:** После изменения переменных окружения нужно **передеплоить** проект:
- Vercel Dashboard → Deployments → ⋮ → Redeploy

