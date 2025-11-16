import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addVesselIdToCashes = async (): Promise<void> => {
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

    console.log('📝 Выполняем миграцию: добавление поля vesselId в таблицу vessel_owner_cashes...');

    // SQL скрипт для добавления поля vesselId
    const sqlScript = `
-- Добавление поля vesselId в таблицу vessel_owner_cashes
-- Каждая касса теперь привязана к конкретному катеру

-- Добавляем колонку vesselId
ALTER TABLE vessel_owner_cashes
ADD COLUMN IF NOT EXISTS "vesselId" INTEGER;

-- Добавляем внешний ключ (с проверкой на существование)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'FK_vessel_owner_cashes_vessel'
  ) THEN
    ALTER TABLE vessel_owner_cashes
    ADD CONSTRAINT FK_vessel_owner_cashes_vessel
    FOREIGN KEY ("vesselId") REFERENCES vessels(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Создаем индекс для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_vessel_owner_cashes_vessel_id ON vessel_owner_cashes("vesselId");
    `;

    // Выполняем SQL скрипт
    await queryRunner.query(sqlScript);

    console.log('✅ Поле vesselId успешно добавлено в таблицу vessel_owner_cashes');
    console.log('✅ Внешний ключ и индекс созданы');

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

addVesselIdToCashes();

