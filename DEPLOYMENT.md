# Инструкция по развертыванию проекта на домен

## 📋 Содержание
1. [Подготовка проекта](#подготовка-проекта)
2. [Варианты хостинга](#варианты-хостинга)
3. [Развертывание на VPS](#развертывание-на-vps)
4. [Развертывание на облачных платформах](#развертывание-на-облачных-платформах)
5. [Настройка домена](#настройка-домена)
6. [Настройка базы данных](#настройка-базы-данных)
7. [Настройка SSL/HTTPS](#настройка-sslhttps)

---

## 🚀 Подготовка проекта

### 1. Сборка проекта для продакшена

#### Backend:
```bash
npm run build:server
```

#### Frontend:
```bash
cd client
npm run build
cd ..
```

### 2. Переменные окружения

Создайте файл `.env` на сервере со следующими переменными:

```env
# Сервер
NODE_ENV=production
PORT=3001

# База данных
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=marina_crm

# JWT
JWT_SECRET=your_very_secure_secret_key_here
JWT_EXPIRES_IN=7d

# Frontend URL (ваш домен)
FRONTEND_URL=https://yourdomain.com

# CORS
CORS_ORIGIN=https://yourdomain.com
```

### 3. Структура файлов на сервере

```
/var/www/marina-crm/
├── dist/              # Скомпилированный backend
├── client/dist/       # Скомпилированный frontend
├── .env              # Переменные окружения
├── package.json
└── node_modules/
```

---

## 🌐 Варианты хостинга

### Вариант 1: VPS (Virtual Private Server)
- **Рекомендуемые провайдеры**: DigitalOcean, Linode, Hetzner, Timeweb, Selectel
- **Минимальные требования**: 2GB RAM, 1 CPU, 20GB SSD
- **Стоимость**: от $5-10/месяц

### Вариант 2: Облачные платформы
- **Backend**: Railway, Render, Heroku, Fly.io
- **Frontend**: Vercel, Netlify, Cloudflare Pages
- **База данных**: Supabase, Neon, Railway PostgreSQL

### Вариант 3: Российские хостинги
- **Timeweb**, **Selectel**, **REG.RU**, **Beget**

---

## 🖥️ Развертывание на VPS

### Шаг 1: Подключение к серверу

```bash
ssh root@your_server_ip
```

### Шаг 2: Установка необходимого ПО

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установка PostgreSQL
apt install -y postgresql postgresql-contrib

# Установка Nginx
apt install -y nginx

# Установка PM2 для управления процессами Node.js
npm install -g pm2
```

### Шаг 3: Настройка PostgreSQL

```bash
# Переключение на пользователя postgres
sudo -u postgres psql

# Создание базы данных и пользователя
CREATE DATABASE marina_crm;
CREATE USER marina_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE marina_crm TO marina_user;
\q
```

### Шаг 4: Загрузка проекта на сервер

#### Вариант A: Через Git
```bash
# Установка Git
apt install -y git

# Клонирование репозитория
cd /var/www
git clone https://github.com/yourusername/marina-crm.git
cd marina-crm
```

#### Вариант B: Через SCP
```bash
# На локальной машине
scp -r ./marina-crm root@your_server_ip:/var/www/
```

### Шаг 5: Установка зависимостей и сборка

```bash
cd /var/www/marina-crm

# Установка зависимостей backend
npm install --production

# Сборка backend
npm run build:server

# Установка зависимостей и сборка frontend
cd client
npm install
npm run build
cd ..
```

### Шаг 6: Настройка переменных окружения

```bash
# Создание .env файла
nano .env

# Вставьте переменные окружения (см. выше)
# Сохраните: Ctrl+O, Enter, Ctrl+X
```

### Шаг 7: Запуск миграций и seed

```bash
# Запуск миграций
npm run migrate

# Запуск seed (опционально, только для начальных данных)
npm run seed
```

### Шаг 8: Запуск приложения через PM2

```bash
# Запуск backend
pm2 start dist/server.js --name marina-crm-api

# Сохранение конфигурации PM2
pm2 save

# Настройка автозапуска при перезагрузке сервера
pm2 startup
```

### Шаг 9: Настройка Nginx

Создайте конфигурационный файл:

```bash
nano /etc/nginx/sites-available/marina-crm
```

Содержимое файла:

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/marina-crm/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кеширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Активация конфигурации:

```bash
# Создание символической ссылки
ln -s /etc/nginx/sites-available/marina-crm /etc/nginx/sites-enabled/

# Проверка конфигурации
nginx -t

# Перезагрузка Nginx
systemctl reload nginx
```

### Шаг 10: Настройка SSL/HTTPS (Let's Encrypt)

```bash
# Установка Certbot
apt install -y certbot python3-certbot-nginx

# Получение SSL сертификата
certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Автоматическое обновление сертификата
certbot renew --dry-run
```

---

## ☁️ Развертывание на облачных платформах

### Railway (Backend + Frontend + Database)

1. **Создайте аккаунт на [Railway](https://railway.app/)**

2. **Подключите GitHub репозиторий**

3. **Создайте PostgreSQL сервис**

4. **Создайте Backend сервис:**
   - Source: ваш репозиторий
   - Build Command: `npm install && npm run build:server`
   - Start Command: `node dist/server.js`
   - Environment Variables: добавьте все переменные из `.env`

5. **Создайте Frontend сервис:**
   - Source: ваш репозиторий
   - Root Directory: `client`
   - Build Command: `npm install && npm run build`
   - Output Directory: `dist`
   - Environment Variables:
     ```
     VITE_API_URL=https://your-backend-url.railway.app/api
     ```

### Vercel (Frontend) + Railway (Backend)

1. **Frontend на Vercel:**
   - Подключите репозиторий
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables:
     ```
     VITE_API_URL=https://your-backend-url.railway.app/api
     ```

2. **Backend на Railway:**
   - Следуйте инструкциям выше

---

## 🌍 Настройка домена

### 1. Покупка домена
- **Рекомендуемые регистраторы**: Namecheap, GoDaddy, REG.RU, Timeweb

### 2. Настройка DNS записей

#### Для VPS:
```
A     @              your_server_ip
A     www            your_server_ip
A     api            your_server_ip
CNAME api            yourdomain.com
```

#### Для Railway:
```
CNAME @              your-app.railway.app
CNAME www            your-app.railway.app
CNAME api            your-backend.railway.app
```

#### Для Vercel:
```
CNAME @              cname.vercel-dns.com
CNAME www            cname.vercel-dns.com
```

### 3. Ожидание распространения DNS
- Обычно занимает 1-24 часа
- Проверить можно через: https://dnschecker.org/

---

## 🗄️ Настройка базы данных

### Локальная база данных (VPS)

```bash
# Подключение к PostgreSQL
sudo -u postgres psql

# Создание базы данных
CREATE DATABASE marina_crm;

# Создание пользователя
CREATE USER marina_user WITH PASSWORD 'secure_password';

# Предоставление прав
GRANT ALL PRIVILEGES ON DATABASE marina_crm TO marina_user;
ALTER DATABASE marina_crm OWNER TO marina_user;

# Выход
\q
```

### Облачная база данных

#### Supabase (PostgreSQL)
1. Создайте проект на [Supabase](https://supabase.com/)
2. Получите connection string
3. Обновите `.env`:
   ```
   DB_HOST=db.xxxxx.supabase.co
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=postgres
   ```

#### Neon (PostgreSQL)
1. Создайте проект на [Neon](https://neon.tech/)
2. Получите connection string
3. Обновите `.env`

---

## 🔒 Настройка SSL/HTTPS

### Let's Encrypt (бесплатно)

```bash
# Установка Certbot
apt install -y certbot python3-certbot-nginx

# Получение сертификата
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Автоматическое обновление
certbot renew --dry-run
```

### Cloudflare (бесплатно)
1. Добавьте домен в Cloudflare
2. Измените nameservers на вашем регистраторе
3. Включите SSL/TLS: Full (strict)

---

## 📝 Чеклист развертывания

- [ ] Проект собран для продакшена
- [ ] Переменные окружения настроены
- [ ] База данных создана и настроена
- [ ] Миграции выполнены
- [ ] Backend запущен и работает
- [ ] Frontend собран и развернут
- [ ] Nginx настроен
- [ ] SSL сертификат установлен
- [ ] DNS записи настроены
- [ ] Домен работает
- [ ] Тестирование функционала

---

## 🔧 Полезные команды

### PM2
```bash
# Просмотр процессов
pm2 list

# Просмотр логов
pm2 logs marina-crm-api

# Перезапуск
pm2 restart marina-crm-api

# Остановка
pm2 stop marina-crm-api
```

### Nginx
```bash
# Проверка конфигурации
nginx -t

# Перезагрузка
systemctl reload nginx

# Просмотр логов
tail -f /var/log/nginx/error.log
```

### PostgreSQL
```bash
# Подключение
sudo -u postgres psql

# Резервное копирование
pg_dump -U marina_user marina_crm > backup.sql

# Восстановление
psql -U marina_user marina_crm < backup.sql
```

---

## 🆘 Решение проблем

### Backend не запускается
- Проверьте логи: `pm2 logs marina-crm-api`
- Проверьте переменные окружения
- Проверьте подключение к базе данных

### Frontend не загружается
- Проверьте путь к собранным файлам
- Проверьте конфигурацию Nginx
- Проверьте переменную `VITE_API_URL`

### База данных не подключается
- Проверьте credentials в `.env`
- Проверьте firewall на сервере
- Проверьте доступность PostgreSQL

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи приложения
2. Проверьте логи Nginx
3. Проверьте логи PostgreSQL
4. Убедитесь, что все порты открыты

---

**Удачи с развертыванием! 🚀**

