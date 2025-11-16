import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const createIncomeTables = async (): Promise<void> => {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
  });
  
  try {
    await dataSource.initialize();
    console.log('✅ База данных подключена');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    console.log('📝 Выполняем миграцию: создание таблиц income_categories и incomes...');

    // Создание enum типа для способов оплаты (если еще не существует)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cash_payment_method_enum') THEN
          CREATE TYPE cash_payment_method_enum AS ENUM ('cash', 'non_cash');
        END IF;
      END $$;
    `);
    console.log('✅ Enum cash_payment_method_enum проверен/создан');

    // Создание таблицы категорий приходов
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS income_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        "isActive" BOOLEAN DEFAULT TRUE,
        "vesselOwnerId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Индекс для оптимизации запросов по владельцу категории
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_income_categories_vessel_owner_id ON income_categories("vesselOwnerId");
    `);

    // Проверяем, существует ли таблица incomes
    const incomesTableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'incomes'
      );
    `);

    if (!incomesTableExists[0].exists) {
      // Создание таблицы приходов
      await queryRunner.query(`
        CREATE TABLE incomes (
          id SERIAL PRIMARY KEY,
          "categoryId" INTEGER NOT NULL REFERENCES income_categories(id) ON DELETE CASCADE,
          "vesselId" INTEGER NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
          "cashId" INTEGER NOT NULL REFERENCES vessel_owner_cashes(id) ON DELETE CASCADE,
          amount DECIMAL(12, 2) NOT NULL,
          currency currency_enum DEFAULT 'RUB',
          "paymentMethod" cash_payment_method_enum NOT NULL,
          date DATE NOT NULL,
          description TEXT,
          counterparty VARCHAR(255),
          "documentPath" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Таблица incomes создана');
    } else {
      console.log('ℹ️  Таблица incomes уже существует, проверяем колонки...');
      
      // Проверяем и добавляем недостающие колонки
      const columns = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'incomes';
      `);
      const columnNames = columns.map((c: any) => c.column_name);
      
      if (!columnNames.includes('categoryId')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN "categoryId" INTEGER REFERENCES income_categories(id) ON DELETE CASCADE;
        `);
        console.log('✅ Колонка categoryId добавлена');
      }
      if (!columnNames.includes('vesselId')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN "vesselId" INTEGER REFERENCES vessels(id) ON DELETE CASCADE;
        `);
        console.log('✅ Колонка vesselId добавлена');
      }
      if (!columnNames.includes('cashId')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN "cashId" INTEGER REFERENCES vessel_owner_cashes(id) ON DELETE CASCADE;
        `);
        console.log('✅ Колонка cashId добавлена');
      }
      if (!columnNames.includes('amount')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN amount DECIMAL(12, 2);
        `);
        console.log('✅ Колонка amount добавлена');
      }
      if (!columnNames.includes('currency')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN currency currency_enum DEFAULT 'RUB';
        `);
        console.log('✅ Колонка currency добавлена');
      }
      if (!columnNames.includes('paymentMethod')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN "paymentMethod" cash_payment_method_enum;
        `);
        console.log('✅ Колонка paymentMethod добавлена');
      }
      if (!columnNames.includes('date')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN date DATE;
        `);
        console.log('✅ Колонка date добавлена');
      }
      if (!columnNames.includes('description')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN description TEXT;
        `);
        console.log('✅ Колонка description добавлена');
      }
      if (!columnNames.includes('counterparty')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN counterparty VARCHAR(255);
        `);
        console.log('✅ Колонка counterparty добавлена');
      }
      if (!columnNames.includes('documentPath')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          ADD COLUMN "documentPath" TEXT;
        `);
        console.log('✅ Колонка documentPath добавлена');
      }
      
      // Удаляем старую колонку type, если она существует (она не нужна в новой структуре)
      if (columnNames.includes('type')) {
        await queryRunner.query(`
          ALTER TABLE incomes 
          DROP COLUMN IF EXISTS type;
        `);
        console.log('✅ Старая колонка type удалена');
      }
    }

    // Индексы для оптимизации запросов (с обработкой ошибок)
    try {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_incomes_category_id ON incomes("categoryId");
      `);
    } catch (e: any) {
      if (e.code !== '42703') throw e;
      console.log('ℹ️  Индекс idx_incomes_category_id уже существует или колонка отсутствует');
    }
    try {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_incomes_vessel_id ON incomes("vesselId");
      `);
    } catch (e: any) {
      if (e.code !== '42703') throw e;
      console.log('ℹ️  Индекс idx_incomes_vessel_id уже существует или колонка отсутствует');
    }
    try {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_incomes_cash_id ON incomes("cashId");
      `);
    } catch (e: any) {
      if (e.code !== '42703') throw e;
      console.log('ℹ️  Индекс idx_incomes_cash_id уже существует или колонка отсутствует');
    }
    try {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
      `);
    } catch (e: any) {
      if (e.code !== '42703') throw e;
      console.log('ℹ️  Индекс idx_incomes_date уже существует или колонка отсутствует');
    }

    console.log('✅ Таблицы income_categories и incomes успешно созданы');
    console.log('✅ Индексы созданы');

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Миграция завершена успешно!');
  } catch (error: any) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Таблица уже существует, это нормально');
    } else if (error.code === '42710') {
      console.log('ℹ️  Индекс уже существует, это нормально');
    } else {
      console.error('❌ Полная ошибка:', error);
    }
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
};

createIncomeTables();

