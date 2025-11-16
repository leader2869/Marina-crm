import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addCategoryIdToCashTransactions = async (): Promise<void> => {
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

    console.log('📝 Выполняем миграцию: добавление поля categoryId в таблицу cash_transactions...');

    // Проверяем, существует ли колонка
    const columns = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cash_transactions' AND column_name = 'categoryId';
    `);

    if (columns.length === 0) {
      // Добавляем колонку categoryId
      await queryRunner.query(`
        ALTER TABLE cash_transactions 
        ADD COLUMN "categoryId" INTEGER REFERENCES income_categories(id) ON DELETE SET NULL;
      `);
      console.log('✅ Колонка categoryId добавлена в cash_transactions');
      
      // Создаем индекс для оптимизации
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_cash_transactions_category_id ON cash_transactions("categoryId");
      `);
      console.log('✅ Индекс создан');
    } else {
      console.log('ℹ️  Колонка categoryId уже существует');
    }

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Миграция завершена успешно!');
  } catch (error: any) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
};

addCategoryIdToCashTransactions();

