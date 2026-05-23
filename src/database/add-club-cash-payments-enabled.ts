import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addClubCashPaymentsEnabled = async (): Promise<void> => {
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

    await queryRunner.query(`
      ALTER TABLE clubs
      ADD COLUMN IF NOT EXISTS "cashPaymentsEnabled" BOOLEAN NOT NULL DEFAULT true;
    `);

    console.log('✅ Колонка cashPaymentsEnabled добавлена в clubs');
    await queryRunner.release();
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
};

void addClubCashPaymentsEnabled();
