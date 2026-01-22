import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addMonthlyAmountsToTariffs = async (): Promise<void> => {
  // Создаем новый DataSource с synchronize: false для быстрого выполнения
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false, // Отключаем синхронизацию для быстрого выполнения
    logging: false,
  });
  
  try {
    await dataSource.initialize();
    console.log('✅ База данных подключена');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    console.log('📝 Выполняем миграцию: добавление полей months и monthlyAmounts в таблицу tariffs...');

    // SQL скрипт для добавления полей
    const sqlScript = `
-- Добавление полей months и monthlyAmounts в таблицу tariffs
-- months: массив месяцев для помесячной оплаты (1-12)
-- monthlyAmounts: JSON объект с суммами для каждого месяца

-- Добавляем колонку months (если еще не существует)
ALTER TABLE tariffs
ADD COLUMN IF NOT EXISTS "months" JSONB;

-- Добавляем колонку monthlyAmounts (если еще не существует)
ALTER TABLE tariffs
ADD COLUMN IF NOT EXISTS "monthlyAmounts" JSONB;
    `;

    // Выполняем SQL скрипт
    await queryRunner.query(sqlScript);

    console.log('✅ Поля months и monthlyAmounts успешно добавлены в таблицу tariffs');

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Миграция завершена успешно!');
  } catch (error: any) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Индекс уже существует, это нормально');
    } else if (error.code === '42710') {
      console.log('ℹ️  Ограничение уже существует, это нормально');
    } else if (error.code === '42701') {
      console.log('ℹ️  Колонка уже существует, это нормально');
    } else {
      console.error('❌ Полная ошибка:', error);
    }
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
};

addMonthlyAmountsToTariffs();

