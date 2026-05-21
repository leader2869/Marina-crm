import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addUserClubStaffPermissions = async (): Promise<void> => {
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
      ALTER TABLE user_clubs
      ADD COLUMN IF NOT EXISTS "accessEnabled" BOOLEAN NOT NULL DEFAULT true;
    `);

    await queryRunner.query(`
      ALTER TABLE user_clubs
      ADD COLUMN IF NOT EXISTS permissions JSONB NULL;
    `);

    console.log('✅ Колонки accessEnabled и permissions добавлены в user_clubs');
    await queryRunner.release();
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
};

void addUserClubStaffPermissions();
