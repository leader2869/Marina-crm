import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addPaymentStatusCancelled = async (): Promise<void> => {
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

    console.log('📝 Выполняем миграцию: добавление статуса "cancelled" в payment_status enum...');

    // SQL скрипт для добавления статуса 'cancelled' в enum
    const sqlScript = `
DO $$ 
DECLARE
    enum_name TEXT;
BEGIN
    -- Ищем enum, используемый в колонке status таблицы payments
    SELECT t.typname INTO enum_name
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'payments' 
    AND a.attname = 'status'
    AND t.typtype = 'e';
    
    -- Если нашли enum, добавляем значение
    IF enum_name IS NOT NULL THEN
        -- Проверяем, существует ли уже значение 'cancelled'
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_enum 
            WHERE enumlabel = 'cancelled' 
            AND enumtypid = (
                SELECT oid 
                FROM pg_type 
                WHERE typname = enum_name
            )
        ) THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''cancelled''', enum_name);
            RAISE NOTICE 'Статус "cancelled" добавлен в enum %', enum_name;
        ELSE
            RAISE NOTICE 'Статус "cancelled" уже существует в enum %', enum_name;
        END IF;
    ELSE
        RAISE NOTICE 'Enum для статуса платежей не найден';
    END IF;
END $$;
    `;

    // Выполняем SQL скрипт
    await queryRunner.query(sqlScript);

    console.log('✅ Статус "cancelled" успешно добавлен в payment_status enum');

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Готово!');
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
};

addPaymentStatusCancelled();

