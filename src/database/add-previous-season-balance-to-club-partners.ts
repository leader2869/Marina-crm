import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

const run = async (): Promise<void> => {
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
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    await queryRunner.query(`
      ALTER TABLE club_partners
      ADD COLUMN IF NOT EXISTS "previousSeasonBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;
    `);

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Колонка previousSeasonBalance добавлена в club_partners');
  } catch (error) {
    console.error('❌ Ошибка миграции add-previous-season-balance-to-club-partners:', error);
    throw error;
  }
};

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

