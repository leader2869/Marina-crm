# Примеры использования API

## 🔐 Аутентификация

### Регистрация пользователя

```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "Иван",
  "lastName": "Иванов",
  "phone": "+7 (999) 123-45-67",
  "role": "vessel_owner"
}
```

**Ответ:**
```json
{
  "message": "Регистрация успешна",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "Иван",
    "lastName": "Иванов",
    "role": "vessel_owner"
  }
}
```

### Вход в систему

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Получение профиля

```bash
GET /api/auth/profile
Authorization: Bearer <token>
```

## 🏢 Яхт-клубы

### Получение списка клубов (с фильтрами)

```bash
GET /api/clubs?location=Сочи&minPrice=3000&maxPrice=10000&available=true&page=1&limit=10
```

**Параметры запроса:**
- `location` - поиск по адресу или названию
- `minPrice` - минимальная цена за день
- `maxPrice` - максимальная цена за день
- `available` - только доступные клубы
- `page` - номер страницы
- `limit` - количество на странице

### Создание яхт-клуба

```bash
POST /api/clubs
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Премиум Яхт-Клуб",
  "description": "Элитный яхт-клуб с современной инфраструктурой",
  "address": "г. Сочи, ул. Приморская, 1",
  "latitude": 43.5855,
  "longitude": 39.7231,
  "phone": "+7 (862) 123-45-67",
  "email": "info@premium-yachtclub.ru",
  "website": "https://premium-yachtclub.ru",
  "totalBerths": 50,
  "minRentalPeriod": 7,
  "maxRentalPeriod": 365,
  "basePrice": 5000
}
```

### Получение деталей клуба

```bash
GET /api/clubs/1
```

### Обновление клуба

```bash
PUT /api/clubs/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Обновленное название",
  "basePrice": 6000
}
```

## ⛵ Судна

### Создание судна

```bash
POST /api/vessels
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Морская Звезда",
  "type": "Яхта",
  "length": 18.5,
  "width": 4.2,
  "registrationNumber": "RU-12345",
  "documentPath": "/uploads/documents/vessel-doc.pdf",
  "technicalSpecs": {
    "engine": "Volvo Penta",
    "fuel": "Дизель",
    "capacity": 8
  },
  "photo": "/uploads/photos/vessel.jpg"
}
```

### Получение списка судов

```bash
GET /api/vessels?page=1&limit=10
Authorization: Bearer <token>
```

## 📅 Бронирования

### Создание бронирования

```bash
POST /api/bookings
Authorization: Bearer <token>
Content-Type: application/json

{
  "clubId": 1,
  "berthId": 5,
  "vesselId": 1,
  "startDate": "2024-06-01",
  "endDate": "2024-06-30",
  "autoRenewal": false
}
```

**Ответ:**
```json
{
  "id": 1,
  "clubId": 1,
  "berthId": 5,
  "vesselId": 1,
  "startDate": "2024-06-01",
  "endDate": "2024-06-30",
  "totalPrice": 150000,
  "status": "pending",
  "autoRenewal": false,
  "createdAt": "2024-05-15T10:00:00Z"
}
```

### Получение списка бронирований

```bash
GET /api/bookings?page=1&limit=10
Authorization: Bearer <token>
```

### Отмена бронирования

```bash
DELETE /api/bookings/1
Authorization: Bearer <token>
```

## 💰 Финансы

### Создание дохода

```bash
POST /api/finances/incomes
Authorization: Bearer <token>
Content-Type: application/json

{
  "clubId": 1,
  "type": "rental",
  "amount": 150000,
  "currency": "RUB",
  "date": "2024-06-01",
  "description": "Оплата аренды за июнь",
  "invoiceNumber": "INV-2024-001",
  "bookingId": 1
}
```

### Создание расхода

```bash
POST /api/finances/expenses
Authorization: Bearer <token>
Content-Type: application/json

{
  "clubId": 1,
  "categoryId": 1,
  "amount": 50000,
  "currency": "RUB",
  "date": "2024-06-01",
  "description": "Зарплата персонала за май",
  "paymentMethod": "bank_transfer",
  "counterparty": "ООО 'Персонал'",
  "tags": ["зарплата", "май"],
  "project": "Основной проект"
}
```

### Утверждение расхода

```bash
POST /api/finances/expenses/1/approve
Authorization: Bearer <token>
```

### Получение финансовой аналитики

```bash
GET /api/finances/analytics?clubId=1&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

**Ответ:**
```json
{
  "period": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  },
  "income": {
    "total": 5000000,
    "count": 120,
    "byType": {
      "rental": 4500000,
      "additional_services": 300000,
      "membership_fee": 200000
    }
  },
  "expense": {
    "total": 3000000,
    "count": 85,
    "byCategory": {
      "Заработная плата персонала": 1500000,
      "Коммунальные услуги": 500000,
      "Ремонт и обслуживание": 1000000
    }
  },
  "metrics": {
    "netProfit": 2000000,
    "profitability": 40.0,
    "marinaRatio": 60.0
  }
}
```

### Создание категории расходов

```bash
POST /api/finances/expense-categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Реклама в соцсетях",
  "description": "Расходы на рекламу в социальных сетях",
  "type": "marketing",
  "icon": "megaphone",
  "color": "#10B981",
  "parentId": null,
  "clubId": 1
}
```

### Создание бюджета

```bash
POST /api/finances/budgets
Authorization: Bearer <token>
Content-Type: application/json

{
  "clubId": 1,
  "name": "Бюджет на 2024 год",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "plannedIncome": 5000000,
  "plannedExpense": 3000000,
  "currency": "RUB",
  "notes": "Плановый бюджет на год"
}
```

## 💸 Платежи

### Создание платежа

```bash
POST /api/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookingId": 1,
  "amount": 150000,
  "currency": "RUB",
  "method": "online",
  "dueDate": "2024-05-20",
  "notes": "Оплата за бронирование"
}
```

### Обновление статуса платежа

```bash
PUT /api/payments/1/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "paid",
  "transactionId": "TXN-123456",
  "paidDate": "2024-05-18"
}
```

### Получение просроченных платежей

```bash
GET /api/payments/overdue?clubId=1
Authorization: Bearer <token>
```

## 🔑 Статусы и типы

### Статусы бронирования
- `pending` - Ожидает подтверждения
- `confirmed` - Подтверждено
- `active` - Активно
- `completed` - Завершено
- `cancelled` - Отменено

### Статусы платежей
- `pending` - Ожидает оплаты
- `paid` - Оплачено
- `overdue` - Просрочено
- `refunded` - Возвращено

### Типы доходов
- `rental` - Аренда
- `additional_services` - Дополнительные услуги
- `membership_fee` - Членские взносы
- `penalty` - Штрафы и пени
- `other` - Прочее

### Типы расходов
- `salary` - Заработная плата
- `utilities` - Коммунальные услуги
- `taxes` - Налоги
- `maintenance` - Ремонт и обслуживание
- `marketing` - Маркетинг
- `rent` - Аренда
- `supplies` - Хозяйственные расходы
- `custom` - Произвольный

### Способы оплаты
- `cash` - Наличные
- `card` - Банковская карта
- `bank_transfer` - Банковский перевод
- `online` - Онлайн платеж

### Валюты
- `RUB` - Российский рубль
- `USD` - Доллар США
- `EUR` - Евро



