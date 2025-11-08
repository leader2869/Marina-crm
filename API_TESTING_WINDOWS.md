# 🧪 Тестирование API в Windows

## ⚠️ Проблема с curl в Windows

В Windows PowerShell команда `curl` является алиасом для `Invoke-WebRequest`, который работает иначе, чем curl в Linux/Mac.

## ✅ Правильные способы тестирования API в Windows

### Способ 1: PowerShell (Invoke-RestMethod) - Рекомендуется

#### Вход в систему:
```powershell
$body = @{
    email = "admin@marina-crm.com"
    password = "admin123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Токен: $($response.token)"
```

#### Получение профиля:
```powershell
$token = "YOUR_TOKEN_HERE"
$headers = @{
    Authorization = "Bearer $token"
}

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/profile" `
    -Method GET `
    -Headers $headers

$response | ConvertTo-Json
```

#### Получение списка клубов:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/clubs" -Method GET | ConvertTo-Json
```

### Способ 2: Использовать скрипт test-login.ps1

```powershell
.\test-login.ps1
```

### Способ 3: Установить настоящий curl для Windows

1. **Скачайте curl для Windows:**
   - https://curl.se/windows/
   - Или используйте Git Bash (включает curl)

2. **Используйте полный путь:**
   ```bash
   "C:\Program Files\Git\usr\bin\curl.exe" -X POST http://localhost:3000/api/auth/login ^
     -H "Content-Type: application/json" ^
     -d "{\"email\": \"admin@marina-crm.com\", \"password\": \"admin123\"}"
   ```

### Способ 4: Использовать Git Bash

Если у вас установлен Git, используйте Git Bash:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@marina-crm.com", "password": "admin123"}'
```

## 📝 Примеры команд для PowerShell

### 1. Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health"
```

### 2. Регистрация
```powershell
$body = @{
    email = "test@example.com"
    password = "test123"
    firstName = "Тест"
    lastName = "Тестов"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### 3. Вход и сохранение токена
```powershell
$body = @{
    email = "admin@marina-crm.com"
    password = "admin123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

$token = $response.token
Write-Host "Токен сохранен: $token"
```

### 4. Получение профиля с токеном
```powershell
$token = "YOUR_TOKEN_HERE"
$headers = @{
    Authorization = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/profile" `
    -Method GET `
    -Headers $headers
```

### 5. Получение списка клубов
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/clubs" | ConvertTo-Json -Depth 10
```

### 6. Создание клуба (требует токен)
```powershell
$token = "YOUR_TOKEN_HERE"
$headers = @{
    Authorization = "Bearer $token"
}

$body = @{
    name = "Новый Яхт-Клуб"
    address = "г. Москва, ул. Тестовая, 1"
    latitude = 55.7558
    longitude = 37.6173
    totalBerths = 20
    basePrice = 3000
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/clubs" `
    -Method POST `
    -ContentType "application/json" `
    -Headers $headers `
    -Body $body
```

## 🔧 Использование Postman или Insomnia

Для удобного тестирования API рекомендуется использовать:
- **Postman** - https://www.postman.com/
- **Insomnia** - https://insomnia.rest/
- **Thunder Client** (расширение для VS Code)

## 📋 Готовый скрипт для тестирования

Создайте файл `test-api.ps1`:

```powershell
# test-api.ps1
Write-Host "🧪 Тестирование API Marina CRM" -ForegroundColor Cyan

# 1. Health Check
Write-Host "`n1. Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health"
    Write-Host "✅ Сервер работает: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Сервер не отвечает" -ForegroundColor Red
    exit
}

# 2. Вход
Write-Host "`n2. Вход в систему..." -ForegroundColor Yellow
$body = @{
    email = "admin@marina-crm.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body
    
    $token = $login.token
    Write-Host "✅ Вход выполнен успешно!" -ForegroundColor Green
    Write-Host "   Токен: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Ошибка входа: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# 3. Получение профиля
Write-Host "`n3. Получение профиля..." -ForegroundColor Yellow
$headers = @{
    Authorization = "Bearer $token"
}

try {
    $profile = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/profile" `
        -Method GET `
        -Headers $headers
    
    Write-Host "✅ Профиль получен:" -ForegroundColor Green
    Write-Host "   Email: $($profile.email)" -ForegroundColor Gray
    Write-Host "   Роль: $($profile.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Ошибка получения профиля: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Получение списка клубов
Write-Host "`n4. Получение списка клубов..." -ForegroundColor Yellow
try {
    $clubs = Invoke-RestMethod -Uri "http://localhost:3000/api/clubs" `
        -Method GET
    
    Write-Host "✅ Найдено клубов: $($clubs.data.Count)" -ForegroundColor Green
    if ($clubs.data.Count -gt 0) {
        Write-Host "   Первый клуб: $($clubs.data[0].name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Ошибка получения клубов: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Тестирование завершено!" -ForegroundColor Cyan
```

Запустите:
```powershell
.\test-api.ps1
```

## 🎯 Быстрый тест

Просто запустите:
```powershell
.\test-login.ps1
```

Это выполнит вход и покажет токен.

