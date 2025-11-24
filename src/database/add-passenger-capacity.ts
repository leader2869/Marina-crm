import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addPassengerCapacity = async (): Promise<void> => {
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

    console.log('📝 Выполняем миграцию: добавление поля passengerCapacity в таблицу vessels...');

    // Проверяем, существует ли колонка
    const columns = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vessels' AND column_name = 'passengerCapacity';
    `);

    if (columns.length === 0) {
      // Добавляем колонку passengerCapacity как обязательное поле
      // Для существующих записей устанавливаем значение по умолчанию 1
      await queryRunner.query(`
        ALTER TABLE vessels 
        ADD COLUMN "passengerCapacity" INTEGER NOT NULL DEFAULT 1;
      `);
      console.log('✅ Колонка passengerCapacity добавлена в vessels');
      
      // Удаляем значение по умолчанию после добавления (чтобы поле было обязательным для новых записей)
      await queryRunner.query(`
        ALTER TABLE vessels 
        ALTER COLUMN "passengerCapacity" DROP DEFAULT;
      `);
      console.log('✅ Значение по умолчанию удалено');
    } else {
      console.log('ℹ️  Колонка passengerCapacity уже существует');
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

addPassengerCapacity();

