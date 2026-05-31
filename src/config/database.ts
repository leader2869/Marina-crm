import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Club } from '../entities/Club';
import { Vessel } from '../entities/Vessel';
import { Booking } from '../entities/Booking';
import { Berth } from '../entities/Berth';
import { Income } from '../entities/Income';
import { Expense } from '../entities/Expense';
import { ExpenseCategory } from '../entities/ExpenseCategory';
import { Payment } from '../entities/Payment';
import { Budget } from '../entities/Budget';
import { UserClub } from '../entities/UserClub';
import { Tariff } from '../entities/Tariff';
import { TariffBerth } from '../entities/TariffBerth';
import { BookingRule } from '../entities/BookingRule';
import { ActivityLog } from '../entities/ActivityLog';
import { VesselOwnerCash } from '../entities/VesselOwnerCash';
import { CashTransaction } from '../entities/CashTransaction';
import { IncomeCategory } from '../entities/IncomeCategory';
import { VesselOwnerExpenseCategory } from '../entities/VesselOwnerExpenseCategory';
import { AgentOrder } from '../entities/AgentOrder';
import { AgentOrderResponse } from '../entities/AgentOrderResponse';
import { Contragent } from '../entities/Contragent';
import { ClubPartner } from '../entities/ClubPartner';
import { ClubCashTransaction } from '../entities/ClubCashTransaction';
import { ClubPartnerManager } from '../entities/ClubPartnerManager';

// Загружаем переменные окружения из .env файла
dotenv.config();

const isPersistentServer = !process.env.VERCEL && !process.env.VERCEL_ENV;

const databaseUrl = process.env.DATABASE_URL || '';
const dbPort = parseInt(process.env.DB_PORT || '', 10);
const isTransactionPooler =
  dbPort === 6543 ||
  databaseUrl.includes(':6543/') ||
  process.env.SUPABASE_POOL_MODE === 'transaction';

// Session pooler (:5432): лимит pool_size ~15. Transaction pooler (:6543): много клиентов.
const pgPoolMax =
  parseInt(process.env.PG_POOL_MAX || '', 10) ||
  (isPersistentServer ? (isTransactionPooler ? 10 : 6) : 2);

const pgPoolExtra: Record<string, unknown> = {
  connectionTimeoutMillis: 45000,
  query_timeout: isPersistentServer ? 120000 : 60000,
  statement_timeout: isPersistentServer ? 120000 : 60000,
  idle_in_transaction_session_timeout: 30000,
  idleTimeoutMillis: 20000,
  max: pgPoolMax,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// PgBouncer/Supavisor transaction mode не поддерживает prepared statements
if (isTransactionPooler) {
  pgPoolExtra.prepareThreshold = 0;
}

// Поддержка connection string для Supabase и других облачных провайдеров
const getDatabaseConfig = () => {
  // Если указан DATABASE_URL (connection string), используем его
  if (process.env.DATABASE_URL) {
    // Проверяем, используется ли Supabase
    const isSupabase = 
      process.env.DATABASE_URL.includes('supabase.co') || 
      process.env.DATABASE_URL.includes('pooler.supabase.com');
    
    return {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      // Supabase требует SSL всегда
      ssl: isSupabase || process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false,
      extra: pgPoolExtra,
    };
  }

  // Иначе используем отдельные параметры
  const host = process.env.DB_HOST || 'localhost';
  const isSupabaseHost = 
    host.includes('supabase.co') || 
    host.includes('pooler.supabase.com');
  
  return {
    type: 'postgres' as const,
    host,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'marina_crm',
    // Supabase требует SSL всегда
    ssl: isSupabaseHost || process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
    extra: pgPoolExtra,
  };
};

// Определяем, нужно ли использовать synchronize
// Для Supabase и development используем synchronize
// Для production локальной БД лучше использовать миграции
const isSupabase = 
  process.env.DATABASE_URL?.includes('supabase.co') || 
  process.env.DATABASE_URL?.includes('pooler.supabase.com') ||
  process.env.DB_HOST?.includes('supabase.co') ||
  process.env.DB_HOST?.includes('pooler.supabase.com');

// Отключаем synchronize на production для безопасности
// Используем миграции вместо synchronize
// На Vercel synchronize отключен, поэтому структура БД должна быть создана вручную
const shouldSynchronize = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

export const AppDataSource = new DataSource({
  ...getDatabaseConfig(),
  poolSize: pgPoolMax,
  synchronize: shouldSynchronize,
  logging: process.env.NODE_ENV === 'development',
  entities: [
    User,
    Club,
    Vessel,
    Booking,
    Berth,
    Income,
    Expense,
    ExpenseCategory,
    Payment,
    Budget,
    UserClub,
    Tariff,
    TariffBerth,
    BookingRule,
    ActivityLog,
    VesselOwnerCash,
    CashTransaction,
    IncomeCategory,
    VesselOwnerExpenseCategory,
    AgentOrder,
    AgentOrderResponse,
    ClubPartner,
    ClubCashTransaction,
    ClubPartnerManager,
    Contragent,
  ],
  migrations: ['src/database/migrations/**/*.ts'],
  subscribers: ['src/database/subscribers/**/*.ts'],
  // Отключаем синхронизацию для Contragent, если таблица создана вручную
  // Это предотвратит ошибки при инициализации, если структура немного отличается
  entitySkipConstructor: false,
});



