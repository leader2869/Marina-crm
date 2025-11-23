import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addExpenseCategoryIdToCashTransactions = async (): Promise<void> => {
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
    ssl: process.env.DATABASE_URL?.includes('supabase.co') || process.env.DB_HOST?.includes('supabase.co')
      ? {
          rejectUnauthorized: false
        } : false,
  });
  
  try {
    await dataSource.initialize();
    console.log('✅ База данных подключена');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    console.log('📝 Выполняем миграцию: создание таблицы vessel_owner_expense_categories и добавление поля expenseCategoryId...');

    // Создаем таблицу vessel_owner_expense_categories
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vessel_owner_expense_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        "isActive" BOOLEAN DEFAULT TRUE,
        "vesselOwnerId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблица vessel_owner_expense_categories создана');

    // Создаем индекс для оптимизации запросов по владельцу категории
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_vessel_owner_expense_categories_vessel_owner_id 
      ON vessel_owner_expense_categories("vesselOwnerId");
    `);
    console.log('✅ Индекс для vessel_owner_expense_categories создан');

    // Проверяем, существует ли колонка expenseCategoryId
    const columns = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cash_transactions' AND column_name = 'expenseCategoryId';
    `);

    if (columns.length === 0) {
      // Добавляем колонку expenseCategoryId
      await queryRunner.query(`
        ALTER TABLE cash_transactions 
        ADD COLUMN "expenseCategoryId" INTEGER 
        REFERENCES vessel_owner_expense_categories(id) ON DELETE SET NULL;
      `);
      console.log('✅ Колонка expenseCategoryId добавлена в cash_transactions');
      
      // Создаем индекс для оптимизации
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_cash_transactions_expense_category_id 
        ON cash_transactions("expenseCategoryId");
      `);
      console.log('✅ Индекс для expenseCategoryId создан');
    } else {
      console.log('ℹ️  Колонка expenseCategoryId уже существует');
    }

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Миграция завершена успешно!');
  } catch (error: any) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    console.error('❌ Stack:', error.stack);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
};

addExpenseCategoryIdToCashTransactions();

