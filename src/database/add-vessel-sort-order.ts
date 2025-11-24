import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addVesselSortOrder = async (): Promise<void> => {
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

    console.log('📝 Выполняем миграцию: добавление поля sortOrder в таблицу vessels...');

    // Проверяем, существует ли колонка
    const columns = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vessels' AND column_name = 'sortOrder';
    `);

    if (columns.length === 0) {
      // Добавляем колонку sortOrder
      await queryRunner.query(`
        ALTER TABLE vessels 
        ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
      `);
      console.log('✅ Колонка sortOrder добавлена в vessels');
      
      // Устанавливаем sortOrder для существующих записей на основе id (чтобы сохранить текущий порядок)
      await queryRunner.query(`
        UPDATE vessels 
        SET "sortOrder" = id;
      `);
      console.log('✅ Значения sortOrder установлены для существующих катеров');
    } else {
      console.log('ℹ️  Колонка sortOrder уже существует');
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

addVesselSortOrder();

