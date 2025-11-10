# 🔧 Исправление проблемы IPv4 в Supabase

## ❌ Проблема: "Not IPv4 compatible"

В Supabase Dashboard в разделе Connection string вы видите сообщение:

```
Not IPv4 compatible
Use Session Pooler if on a IPv4 network or purchase IPv4 add-on
```

Это означает, что **Direct connection** (порт 5432) использует IPv6, но ваша сеть поддерживает только IPv4.

---

## ✅ Решение: Использование Session Pooler

**Session Pooler** работает через IPv4 и является рекомендуемым решением для большинства случаев.

---

## 📝 Шаг 1: Получение Connection String для Session Pooler

1. В Supabase Dashboard откройте ваш проект
2. Перейдите в **Settings** → **Database**
3. Прокрутите до раздела **"Connection string"**
4. Найдите раздел **"Session Pooler"** (не Direct connection!)
5. Выберите вкладку **"URI"**
6. Скопируйте connection string

**Connection string будет выглядеть так:**
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Пример:**
```
postgresql://postgres.toimcbqcpzusbrbqwxqn:MyPassword123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

---

## 📝 Шаг 2: Обновление .env файла

Откройте файл `.env` в корне проекта и обновите connection string:

**Вариант 1: Использование DATABASE_URL (рекомендуется)**

```env
# Session Pooler (IPv4 совместимый)
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Пример с реальными данными:**
```env
DATABASE_URL=postgresql://postgres.toimcbqcpzusbrbqwxqn:MyPassword123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

**Вариант 2: Использование отдельных параметров**

```env
# Session Pooler (IPv4 совместимый)
DB_HOST=aws-0-[REGION].pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.[PROJECT-REF]
DB_PASSWORD=[PASSWORD]
```

**Пример с реальными данными:**
```env
DB_HOST=aws-0-eu-central-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.toimcbqcpzusbrbqwxqn
DB_PASSWORD=MyPassword123
```

---

## ⚠️ Важные отличия Session Pooler

### 1. Порт: 6543 (вместо 5432)

Session Pooler использует порт **6543**, а не 5432.

### 2. Хост: pooler.supabase.com (вместо db.xxxxx.supabase.co)

Хост будет выглядеть как:
```
aws-0-[REGION].pooler.supabase.com
```

Где `[REGION]` - это регион вашего проекта (например: `eu-central-1`, `us-east-1`).

### 3. Пользователь: postgres.[PROJECT-REF] (вместо postgres)

Пользователь будет выглядеть как:
```
postgres.[PROJECT-REF]
```

Где `[PROJECT-REF]` - это Reference ID вашего проекта.

---

## 📝 Шаг 3: Проверка подключения

После обновления `.env` файла, проверьте подключение:

```bash
npm run diagnose-supabase
```

Теперь DNS должен успешно резолвить хост `aws-0-[REGION].pooler.supabase.com`.

---

## 📝 Шаг 4: Запуск миграции

После успешной проверки подключения, запустите миграцию:

```bash
npm run migrate
```

---

## 🔍 Как найти REGION

REGION можно найти в Supabase Dashboard:

1. Откройте проект
2. Перейдите в **Settings** → **General**
3. Найдите **Region** - это и есть ваш регион

Или в connection string для Session Pooler - он будет указан в хосте:
```
aws-0-eu-central-1.pooler.supabase.com
                    ^^^^^^^^^^^^
                    Это REGION
```

---

## ✅ Преимущества Session Pooler

1. ✅ **IPv4 совместимость** - работает в IPv4 сетях
2. ✅ **Лучшая производительность** - оптимизирован для приложений
3. ✅ **Масштабируемость** - поддерживает больше подключений
4. ✅ **Стабильность** - более надежное подключение

---

## ⚠️ Ограничения Session Pooler

1. **Нельзя использовать транзакции между запросами** - каждый запрос выполняется в отдельной сессии
2. **Для миграций это нормально** - TypeORM обрабатывает это корректно
3. **Для приложения это предпочтительно** - лучше для production

---

## 📝 Пример полного .env файла

```env
# Supabase Connection (Session Pooler для IPv4)
DATABASE_URL=postgresql://postgres.toimcbqcpzusbrbqwxqn:MyPassword123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Frontend URL
FRONTEND_URL=http://localhost:5173

# File Upload
UPLOAD_MAX_SIZE=10485760
UPLOAD_PATH=./uploads
```

---

## ✅ Чек-лист

- [ ] Открыл Supabase Dashboard → Settings → Database
- [ ] Нашел раздел "Session Pooler"
- [ ] Скопировал connection string из вкладки "URI"
- [ ] Обновил `.env` файл с новым connection string
- [ ] Убедился, что используется порт 6543
- [ ] Убедился, что хост содержит `pooler.supabase.com`
- [ ] Убедился, что пользователь содержит `postgres.[PROJECT-REF]`
- [ ] Проверил подключение: `npm run diagnose-supabase`
- [ ] Запустил миграцию: `npm run migrate`

---

## 🆘 Если все еще не работает

1. **Проверьте правильность REGION** в connection string
2. **Убедитесь, что используете Session Pooler**, а не Direct connection
3. **Проверьте правильность PROJECT-REF** в connection string
4. **Убедитесь, что пароль правильный**
5. **Попробуйте скопировать connection string заново** из Supabase Dashboard

---

**После обновления `.env` файла с Session Pooler connection string, подключение должно заработать! 🚀**

