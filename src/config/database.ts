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

// Загружаем переменные окружения из .env файла
dotenv.config();

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
const shouldSynchronize = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

export const AppDataSource = new DataSource({
  ...getDatabaseConfig(),
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
    // Временно закомментировано до выполнения миграции БД
    // После выполнения миграции (создание таблицы vessel_owner_expense_categories) раскомментировать:
    // VesselOwnerExpenseCategory,
  ],
  migrations: ['src/database/migrations/**/*.ts'],
  subscribers: ['src/database/subscribers/**/*.ts'],
});



