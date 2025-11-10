# Быстрое развертывание проекта на домен

## 🚀 Быстрый старт (VPS)

### 1. Подготовка проекта локально

```bash
# Сборка проекта
npm run build

# Проверка сборки
npm start  # Backend должен запуститься
```

### 2. Загрузка на сервер

```bash
# Через Git (рекомендуется)
git push origin main

# На сервере
cd /var/www
git clone https://github.com/yourusername/marina-crm.git
cd marina-crm
```

### 3. Установка на сервере

```bash
# Установка зависимостей
npm install --production
cd client && npm install && npm run build && cd ..

# Создание .env файла
nano .env
# Вставьте переменные окружения (см. DEPLOYMENT.md)
```

### 4. Настройка базы данных

```bash
# Создание базы данных
sudo -u postgres psql
CREATE DATABASE marina_crm;
CREATE USER marina_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE marina_crm TO marina_user;
\q

# Запуск миграций
npm run migrate
npm run seed  # Опционально
```

### 5. Запуск приложения

```bash
# Установка PM2
npm install -g pm2

# Запуск backend
pm2 start dist/server.js --name marina-crm-api
pm2 save
pm2 startup
```

### 6. Настройка Nginx

```bash
# Создание конфигурации
sudo nano /etc/nginx/sites-available/marina-crm
# Вставьте конфигурацию из DEPLOYMENT.md

# Активация
sudo ln -s /etc/nginx/sites-available/marina-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Настройка SSL

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 8. Настройка DNS

На вашем регистраторе домена добавьте A-записи:
```
A     @     your_server_ip
A     www   your_server_ip
```

---

## ☁️ Облачные платформы (проще)

### Railway (всё в одном месте)

1. Зарегистрируйтесь на [railway.app](https://railway.app/)
2. Подключите GitHub репозиторий
3. Создайте PostgreSQL сервис
4. Создайте Backend сервис:
   - Build: `npm install && npm run build:server`
   - Start: `node dist/server.js`
5. Создайте Frontend сервис:
   - Root: `client`
   - Build: `npm install && npm run build`
   - Output: `dist`

### Vercel (Frontend) + Railway (Backend)

1. **Frontend на Vercel:**
   - Подключите репозиторий
   - Root: `client`
   - Build: `npm run build`
   - Output: `dist`
   - Env: `VITE_API_URL=https://your-backend.railway.app/api`

2. **Backend на Railway:**
   - Следуйте инструкциям выше

---

## 📝 Переменные окружения

Создайте `.env` файл на сервере:

```env
NODE_ENV=production
PORT=3001

DB_HOST=localhost
DB_PORT=5432
DB_USER=marina_user
DB_PASSWORD=your_password
DB_NAME=marina_crm

JWT_SECRET=your_very_secure_secret_key
JWT_EXPIRES_IN=7d

FRONTEND_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
```

---

## ✅ Проверка

После развертывания проверьте:

1. ✅ Backend работает: `https://api.yourdomain.com/health`
2. ✅ Frontend открывается: `https://yourdomain.com`
3. ✅ База данных подключена
4. ✅ SSL сертификат установлен

---

## 🔧 Полезные команды

```bash
# Просмотр логов
pm2 logs marina-crm-api

# Перезапуск
pm2 restart marina-crm-api

# Обновление проекта
git pull
npm install --production
cd client && npm install && npm run build && cd ..
pm2 restart marina-crm-api
```

---

**Подробная инструкция**: см. `DEPLOYMENT.md`

