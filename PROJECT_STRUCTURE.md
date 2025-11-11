# Структура проекта Marina CRM

## Общая архитектура
**Монолитный проект** с разделением на backend (Node.js/Express/TypeScript) и frontend (React/TypeScript/Vite).

## Структура директорий

```
Marina-crm/
├── api/                    # Vercel serverless function entry point
│   └── index.ts           # Экспортирует Express app для Vercel
│
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   │   ├── Layout.tsx
│   │   │   ├── LoadingAnimation.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── RoleProtectedRoute.tsx
│   │   ├── contexts/      # React Context API
│   │   │   └── AuthContext.tsx
│   │   ├── pages/          # Страницы приложения
│   │   │   ├── Login.tsx, Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Clubs.tsx, Vessels.tsx, Bookings.tsx
│   │   │   ├── Users.tsx, Validation.tsx
│   │   │   ├── Payments.tsx, Finances.tsx, Tariffs.tsx
│   │   │   └── ...
│   │   ├── services/       # API клиент
│   │   │   └── api.ts     # Axios instance + сервисы
│   │   ├── types/          # TypeScript типы
│   │   │   └── index.ts
│   │   └── App.tsx         # Главный компонент
│   └── package.json
│
├── src/                    # Backend (Express + TypeORM)
│   ├── config/
│   │   ├── database.ts    # TypeORM конфигурация
│   │   └── env.ts         # Переменные окружения
│   │
│   ├── entities/          # TypeORM сущности (модели БД)
│   │   ├── User.ts
│   │   ├── Club.ts
│   │   ├── Vessel.ts
│   │   ├── Booking.ts
│   │   ├── Berth.ts
│   │   ├── Tariff.ts
│   │   ├── Payment.ts
│   │   └── ...
│   │
│   ├── modules/            # Модули по функциональности
│   │   ├── auth/          # Аутентификация
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.routes.ts
│   │   ├── clubs/         # Яхт-клубы
│   │   ├── vessels/       # Судна
│   │   ├── bookings/      # Бронирования
│   │   ├── users/         # Пользователи
│   │   ├── payments/      # Платежи
│   │   ├── finances/      # Финансы
│   │   ├── tariffs/       # Тарифы
│   │   ├── berths/        # Места (причалы)
│   │   └── booking-rules/ # Правила бронирования
│   │
│   ├── middleware/
│   │   ├── auth.ts        # JWT аутентификация
│   │   └── errorHandler.ts # Обработка ошибок
│   │
│   ├── utils/
│   │   ├── jwt.ts         # JWT токены
│   │   ├── password.ts    # Хеширование паролей
│   │   └── pagination.ts  # Пагинация
│   │
│   ├── database/          # Скрипты для БД
│   │   ├── migrate.ts
│   │   ├── seed.ts
│   │   └── ...
│   │
│   ├── types/             # TypeScript типы
│   │   └── index.ts
│   │
│   └── server.ts          # Точка входа Express сервера
│
├── vercel.json            # Конфигурация Vercel
└── package.json           # Backend зависимости
```

## Технологический стек

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: TypeORM
- **Database**: PostgreSQL (Supabase)
- **Auth**: JWT (jsonwebtoken)
- **Password**: bcryptjs

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Charts**: Recharts

## Роли пользователей (UserRole enum)
- `SUPER_ADMIN` - Суперадминистратор
- `ADMIN` - Администратор
- `CLUB_OWNER` - Владелец яхт-клуба
- `VESSEL_OWNER` - Владелец судна
- `GUEST` - Гость
- `PENDING_VALIDATION` - Ожидает валидации

## Основные сущности БД
1. **User** - Пользователи системы
2. **Club** - Яхт-клубы (с полями публикации: isActive, isValidated, isSubmittedForValidation)
3. **Vessel** - Судна
4. **Berth** - Места (причалы) в яхт-клубах
5. **Booking** - Бронирования
6. **Tariff** - Тарифы на места
7. **Payment** - Платежи
8. **Income/Expense** - Доходы/Расходы
9. **BookingRule** - Правила бронирования

## API структура
Все API endpoints начинаются с `/api/`:
- `/api/auth/*` - Аутентификация
- `/api/clubs/*` - Яхт-клубы
- `/api/vessels/*` - Судна
- `/api/bookings/*` - Бронирования
- `/api/users/*` - Пользователи
- `/api/payments/*` - Платежи
- `/api/finances/*` - Финансы
- `/api/tariffs/*` - Тарифы
- `/api/berths/*` - Места
- `/api/booking-rules/*` - Правила бронирования

## Особенности
- **Ролевая модель доступа**: Разные права для разных ролей
- **Публикация контента**: Клубы и судна проходят валидацию перед публикацией
- **Мягкое удаление**: Используется флаг `isActive` вместо физического удаления
- **CORS**: Настроен для работы на Vercel (разрешены все origin на Vercel)
- **Vercel Deployment**: Монолитное приложение с serverless functions

## Переменные окружения
- `DATABASE_URL` - Connection string для PostgreSQL
- `JWT_SECRET` - Секретный ключ для JWT
- `FRONTEND_URL` - URL фронтенда (для CORS)
- `VERCEL` - Автоматически устанавливается Vercel

## Команды разработки
- `npm run dev` - Запуск backend + frontend
- `npm run dev:server` - Только backend (порт 3001)
- `npm run dev:client` - Только frontend (порт 5173)
- `npm run build` - Сборка проекта
- `npm run migrate` - Миграции БД
- `npm run seed` - Заполнение тестовыми данными

