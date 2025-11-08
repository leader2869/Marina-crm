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

// Загружаем переменные окружения из .env файла
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'marina_crm',
  synchronize: process.env.NODE_ENV === 'development',
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
  ],
  migrations: ['src/database/migrations/**/*.ts'],
  subscribers: ['src/database/subscribers/**/*.ts'],
});


