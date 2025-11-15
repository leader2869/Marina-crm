# 💰 Схема модуля доходов для судовладельца (VESSEL_OWNER)

## 📋 Обзор

Модуль доходов для судовладельца позволяет отслеживать все доходы, полученные от аренды мест в яхт-клубах, а также другие источники дохода, связанные с судами.

---

## 🗄️ База данных

### 1. Новая сущность: `VesselOwnerIncome`

```typescript
@Entity('vessel_owner_incomes')
export class VesselOwnerIncome {
  @PrimaryGeneratedColumn()
  id: number;

  // Тип дохода
  @Column({
    type: 'enum',
    enum: VesselOwnerIncomeType,
  })
  type: VesselOwnerIncomeType;

  // Сумма дохода
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  // Валюта
  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.RUB,
  })
  currency: Currency;

  // Дата получения дохода
  @Column({ type: 'date' })
  date: Date;

  // Описание
  @Column({ type: 'text', nullable: true })
  description: string;

  // Номер счета/накладной
  @Column({ nullable: true })
  invoiceNumber: string;

  // Путь к документу
  @Column({ nullable: true })
  documentPath: string;

  // Связи
  @ManyToOne(() => User, (user) => user.vesselOwnerIncomes)
  @JoinColumn({ name: 'vesselOwnerId' })
  vesselOwner: User;

  @Column()
  vesselOwnerId: number;

  @ManyToOne(() => Vessel, { nullable: true })
  @JoinColumn({ name: 'vesselId' })
  vessel: Vessel | null;

  @Column({ nullable: true })
  vesselId: number | null;

  @ManyToOne(() => Booking, { nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking | null;

  @Column({ nullable: true })
  bookingId: number | null;

  @ManyToOne(() => Payment, { nullable: true })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment | null;

  @Column({ nullable: true })
  paymentId: number | null;

  @ManyToOne(() => Club, { nullable: true })
  @JoinColumn({ name: 'clubId' })
  club: Club | null;

  @Column({ nullable: true })
  clubId: number | null;

  // Метаданные
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 2. Новый enum: `VesselOwnerIncomeType`

```typescript
export enum VesselOwnerIncomeType {
  // Доходы от аренды
  RENTAL_PAYMENT = 'rental_payment',        // Платеж за аренду места
  RENTAL_DEPOSIT = 'rental_deposit',        // Залог за аренду
  RENTAL_REFUND = 'rental_refund',          // Возврат средств за аренду

  // Услуги
  CHARTER_SERVICE = 'charter_service',       // Услуги чартера
  MAINTENANCE_SERVICE = 'maintenance_service', // Услуги обслуживания
  TRANSPORT_SERVICE = 'transport_service',   // Транспортные услуги

  // Прочее
  INSURANCE_COMPENSATION = 'insurance_compensation', // Страховые выплаты
  OTHER = 'other',                          // Прочие доходы
}
```

### 3. Обновление сущности `User`

```typescript
// Добавить в User.ts
@OneToMany(() => VesselOwnerIncome, (income) => income.vesselOwner)
vesselOwnerIncomes: VesselOwnerIncome[];
```

---

## 🔄 Автоматизация создания доходов

### Логика автоматического создания дохода при оплате платежа

**Место реализации:** `src/modules/payments/payments.controller.ts` → метод `updateStatus`

```typescript
// Когда платеж получает статус PAID
if (status === PaymentStatus.PAID) {
  // 1. Получаем информацию о бронировании
  const booking = await bookingRepository.findOne({
    where: { id: payment.bookingId },
    relations: ['vessel', 'vesselOwner', 'club'],
  });

  if (booking && booking.vesselOwnerId) {
    // 2. Создаем доход для судовладельца
    const incomeRepository = AppDataSource.getRepository(VesselOwnerIncome);
    
    // Определяем тип дохода на основе типа платежа
    let incomeType: VesselOwnerIncomeType;
    if (payment.paymentType === PaymentType.DEPOSIT) {
      incomeType = VesselOwnerIncomeType.RENTAL_DEPOSIT;
    } else if (payment.paymentType === PaymentType.REFUND) {
      incomeType = VesselOwnerIncomeType.RENTAL_REFUND;
    } else {
      incomeType = VesselOwnerIncomeType.RENTAL_PAYMENT;
    }

    // Проверяем, не создан ли уже доход для этого платежа
    const existingIncome = await incomeRepository.findOne({
      where: { paymentId: payment.id },
    });

    if (!existingIncome) {
      const income = incomeRepository.create({
        type: incomeType,
        amount: payment.amount,
        currency: payment.currency,
        date: payment.paidDate || new Date(),
        description: `Платеж за бронирование #${booking.id}`,
        vesselOwnerId: booking.vesselOwnerId,
        vesselId: booking.vesselId,
        bookingId: booking.id,
        paymentId: payment.id,
        clubId: booking.clubId,
      });

      await incomeRepository.save(income);
      console.log(`[VesselOwnerIncome] Автоматически создан доход ${income.id} для платежа ${payment.id}`);
    }
  }

  // 3. Проверяем подтверждение бронирования (существующая логика)
  // ...
}
```

---

## 🎯 API Endpoints

### Контроллер: `src/modules/vessel-owner-incomes/vessel-owner-incomes.controller.ts`

#### 1. Получить список доходов
```
GET /api/vessel-owner/incomes
```

**Query параметры:**
- `page` - номер страницы (по умолчанию: 1)
- `limit` - количество на странице (по умолчанию: 20)
- `startDate` - начальная дата (YYYY-MM-DD)
- `endDate` - конечная дата (YYYY-MM-DD)
- `type` - тип дохода (VesselOwnerIncomeType)
- `vesselId` - ID судна
- `bookingId` - ID бронирования
- `clubId` - ID яхт-клуба

**Ответ:**
```json
{
  "data": [
    {
      "id": 1,
      "type": "rental_payment",
      "amount": "50000.00",
      "currency": "RUB",
      "date": "2025-11-15",
      "description": "Платеж за бронирование #38",
      "invoiceNumber": null,
      "documentPath": null,
      "vesselOwnerId": 5,
      "vesselId": 10,
      "bookingId": 38,
      "paymentId": 113,
      "clubId": 2,
      "vesselOwner": { "id": 5, "firstName": "Иван", "lastName": "Петров" },
      "vessel": { "id": 10, "name": "Яхта-1" },
      "booking": { "id": 38, "startDate": "2025-05-01", "endDate": "2025-10-31" },
      "payment": { "id": 113, "amount": "50000.00", "status": "paid" },
      "club": { "id": 2, "name": "Яхт-клуб 'Волна'" },
      "createdAt": "2025-11-15T10:30:00Z",
      "updatedAt": "2025-11-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

#### 2. Получить доход по ID
```
GET /api/vessel-owner/incomes/:id
```

#### 3. Создать доход вручную
```
POST /api/vessel-owner/incomes
```

**Тело запроса:**
```json
{
  "type": "rental_payment",
  "amount": 50000,
  "currency": "RUB",
  "date": "2025-11-15",
  "description": "Платеж за аренду",
  "invoiceNumber": "INV-001",
  "vesselId": 10,
  "bookingId": 38,
  "clubId": 2
}
```

**Валидация:**
- `vesselOwnerId` автоматически берется из `req.userId`
- Если указан `bookingId`, автоматически заполняются `vesselId`, `clubId`, `vesselOwnerId`
- Если указан `paymentId`, автоматически заполняются все связанные поля

#### 4. Обновить доход
```
PUT /api/vessel-owner/incomes/:id
```

#### 5. Удалить доход
```
DELETE /api/vessel-owner/incomes/:id
```

#### 6. Получить аналитику доходов
```
GET /api/vessel-owner/incomes/analytics
```

**Query параметры:**
- `startDate` - обязательный
- `endDate` - обязательный
- `vesselId` - опционально
- `clubId` - опционально

**Ответ:**
```json
{
  "period": {
    "startDate": "2025-01-01",
    "endDate": "2025-12-31"
  },
  "summary": {
    "totalIncome": 1500000.00,
    "totalCount": 45,
    "averageIncome": 33333.33
  },
  "byType": {
    "rental_payment": 1200000.00,
    "rental_deposit": 200000.00,
    "charter_service": 100000.00
  },
  "byVessel": [
    {
      "vesselId": 10,
      "vesselName": "Яхта-1",
      "totalIncome": 500000.00,
      "count": 15
    }
  ],
  "byClub": [
    {
      "clubId": 2,
      "clubName": "Яхт-клуб 'Волна'",
      "totalIncome": 800000.00,
      "count": 25
    }
  ],
  "byMonth": [
    {
      "month": "2025-01",
      "totalIncome": 100000.00,
      "count": 3
    }
  ]
}
```

---

## 🔐 Права доступа

### Правила доступа:
1. **VESSEL_OWNER** может:
   - Просматривать только свои доходы (`vesselOwnerId === req.userId`)
   - Создавать доходы только для себя
   - Редактировать/удалять только свои доходы

2. **SUPER_ADMIN** и **ADMIN** могут:
   - Просматривать все доходы
   - Создавать доходы для любого судовладельца
   - Редактировать/удалять любые доходы

3. **CLUB_OWNER** может:
   - Просматривать доходы судовладельцев, связанные с его клубами (`clubId IN (ownedClubIds)`)
   - Не может создавать/редактировать/удалять доходы судовладельцев

---

## 📊 Frontend (React)

### Страница: `client/src/pages/VesselOwnerIncomes.tsx`

**Основные функции:**
1. **Список доходов** с фильтрами:
   - По дате (календарь)
   - По типу дохода
   - По судну
   - По яхт-клубу
   - По бронированию

2. **Таблица доходов:**
   - Дата
   - Тип дохода (с цветовой индикацией)
   - Сумма
   - Судно
   - Яхт-клуб
   - Бронирование
   - Платеж (ссылка)
   - Действия (редактировать, удалить)

3. **Добавление дохода:**
   - Модальное окно или отдельная страница
   - Форма с валидацией

4. **Аналитика:**
   - График доходов по месяцам
   - Распределение по типам (pie chart)
   - Распределение по судам (bar chart)
   - Распределение по яхт-клубам (bar chart)
   - Общая статистика (карточки)

5. **Экспорт данных:**
   - Экспорт в Excel/CSV
   - Фильтры применяются к экспорту

---

## 🔄 Миграция базы данных

### SQL миграция

```sql
-- Создание enum типа для типов доходов судовладельца
CREATE TYPE vessel_owner_income_type_enum AS ENUM (
  'rental_payment',
  'rental_deposit',
  'rental_refund',
  'charter_service',
  'maintenance_service',
  'transport_service',
  'insurance_compensation',
  'other'
);

-- Создание таблицы доходов судовладельца
CREATE TABLE vessel_owner_incomes (
  id SERIAL PRIMARY KEY,
  type vessel_owner_income_type_enum NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency currency_enum DEFAULT 'RUB',
  date DATE NOT NULL,
  description TEXT,
  "invoiceNumber" VARCHAR(255),
  "documentPath" VARCHAR(255),
  "vesselOwnerId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "vesselId" INTEGER REFERENCES vessels(id) ON DELETE SET NULL,
  "bookingId" INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  "paymentId" INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  "clubId" INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_vessel_owner_incomes_vessel_owner_id ON vessel_owner_incomes("vesselOwnerId");
CREATE INDEX idx_vessel_owner_incomes_vessel_id ON vessel_owner_incomes("vesselId");
CREATE INDEX idx_vessel_owner_incomes_booking_id ON vessel_owner_incomes("bookingId");
CREATE INDEX idx_vessel_owner_incomes_payment_id ON vessel_owner_incomes("paymentId");
CREATE INDEX idx_vessel_owner_incomes_club_id ON vessel_owner_incomes("clubId");
CREATE INDEX idx_vessel_owner_incomes_date ON vessel_owner_incomes(date);
CREATE INDEX idx_vessel_owner_incomes_type ON vessel_owner_incomes(type);

-- Уникальный индекс для предотвращения дублирования доходов от одного платежа
CREATE UNIQUE INDEX idx_vessel_owner_incomes_payment_id_unique ON vessel_owner_incomes("paymentId") WHERE "paymentId" IS NOT NULL;
```

---

## 📝 Типы TypeScript

### Backend: `src/types/index.ts`

```typescript
export enum VesselOwnerIncomeType {
  RENTAL_PAYMENT = 'rental_payment',
  RENTAL_DEPOSIT = 'rental_deposit',
  RENTAL_REFUND = 'rental_refund',
  CHARTER_SERVICE = 'charter_service',
  MAINTENANCE_SERVICE = 'maintenance_service',
  TRANSPORT_SERVICE = 'transport_service',
  INSURANCE_COMPENSATION = 'insurance_compensation',
  OTHER = 'other',
}
```

### Frontend: `client/src/types/index.ts`

```typescript
export enum VesselOwnerIncomeType {
  RENTAL_PAYMENT = 'rental_payment',
  RENTAL_DEPOSIT = 'rental_deposit',
  RENTAL_REFUND = 'rental_refund',
  CHARTER_SERVICE = 'charter_service',
  MAINTENANCE_SERVICE = 'maintenance_service',
  TRANSPORT_SERVICE = 'transport_service',
  INSURANCE_COMPENSATION = 'insurance_compensation',
  OTHER = 'other',
}

export interface VesselOwnerIncome {
  id: number
  type: VesselOwnerIncomeType
  amount: number
  currency: string
  date: string
  description?: string
  invoiceNumber?: string
  documentPath?: string
  vesselOwnerId: number
  vesselId?: number
  bookingId?: number
  paymentId?: number
  clubId?: number
  vesselOwner?: User
  vessel?: Vessel
  booking?: Booking
  payment?: Payment
  club?: Club
  createdAt: string
  updatedAt: string
}
```

---

## 🎨 UI/UX Рекомендации

### Цветовая индикация типов доходов:
- `rental_payment` - 🟢 Зеленый
- `rental_deposit` - 🔵 Синий
- `rental_refund` - 🟡 Желтый
- `charter_service` - 🟣 Фиолетовый
- `maintenance_service` - 🟠 Оранжевый
- `transport_service` - 🔴 Красный
- `insurance_compensation` - ⚪ Серый
- `other` - ⚫ Черный

### Иконки:
- `rental_payment` - 💰
- `rental_deposit` - 🔒
- `rental_refund` - ↩️
- `charter_service` - ⛵
- `maintenance_service` - 🔧
- `transport_service` - 🚢
- `insurance_compensation` - 🛡️
- `other` - 📋

---

## ✅ Чеклист реализации

### Backend:
- [ ] Создать enum `VesselOwnerIncomeType` в `src/types/index.ts`
- [ ] Создать сущность `VesselOwnerIncome` в `src/entities/VesselOwnerIncome.ts`
- [ ] Обновить сущность `User` (добавить связь `vesselOwnerIncomes`)
- [ ] Создать миграцию базы данных
- [ ] Создать контроллер `VesselOwnerIncomesController`
- [ ] Создать роуты `vessel-owner-incomes.routes.ts`
- [ ] Добавить роуты в `src/server.ts`
- [ ] Реализовать автоматическое создание дохода при оплате платежа
- [ ] Добавить валидацию и права доступа
- [ ] Добавить логирование активности

### Frontend:
- [ ] Добавить типы в `client/src/types/index.ts`
- [ ] Создать страницу `client/src/pages/VesselOwnerIncomes.tsx`
- [ ] Создать компонент таблицы доходов
- [ ] Создать компонент формы добавления/редактирования
- [ ] Создать компонент аналитики (графики)
- [ ] Добавить фильтры и поиск
- [ ] Добавить экспорт данных
- [ ] Обновить меню (уже добавлено "Доходы")

### Тестирование:
- [ ] Протестировать автоматическое создание дохода при оплате
- [ ] Протестировать права доступа
- [ ] Протестировать фильтры и поиск
- [ ] Протестировать аналитику
- [ ] Протестировать экспорт данных

---

## 🔮 Будущие улучшения

1. **Уведомления:**
   - Email/SMS уведомления при получении дохода
   - Уведомления о крупных доходах

2. **Интеграции:**
   - Интеграция с бухгалтерскими системами
   - Интеграция с банковскими API для автоматического импорта

3. **Отчеты:**
   - Автоматическая генерация отчетов (ежемесячно, ежеквартально)
   - Отправка отчетов на email

4. **Многовалютность:**
   - Конвертация валют
   - Отображение доходов в разных валютах

---

## 📚 Связанные документы

- `PAYMENT_SYSTEM_DESIGN.md` - Дизайн системы платежей
- `PROJECT_SUMMARY.md` - Общее описание проекта
- `ARCHITECTURE.md` - Архитектура приложения

