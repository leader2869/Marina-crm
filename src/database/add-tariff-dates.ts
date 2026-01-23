import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addTariffDates = async (): Promise<void> => {
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

    console.log('📝 Выполняем миграцию: добавление полей startDate и endDate в таблицу tariffs...');

    // SQL скрипт для добавления полей
    const sqlScript = `
-- Добавление полей startDate и endDate в таблицу tariffs
-- startDate: дата начала действия тарифа
-- endDate: дата окончания действия тарифа

-- Добавляем колонку startDate (если еще не существует)
ALTER TABLE tariffs
ADD COLUMN IF NOT EXISTS "startDate" DATE;

-- Добавляем колонку endDate (если еще не существует)
ALTER TABLE tariffs
ADD COLUMN IF NOT EXISTS "endDate" DATE;
    `;

    // Выполняем SQL скрипт
    await queryRunner.query(sqlScript);

    console.log('✅ Поля startDate и endDate успешно добавлены в таблицу tariffs');

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

addTariffDates();

