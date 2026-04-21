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
      ALTER TABLE club_cash_transactions
      ADD COLUMN IF NOT EXISTS "paidByManagerId" INTEGER;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_club_cash_transactions_paidByManagerId'
        ) THEN
          ALTER TABLE club_cash_transactions
          ADD CONSTRAINT "FK_club_cash_transactions_paidByManagerId"
          FOREIGN KEY ("paidByManagerId")
          REFERENCES club_partner_managers(id)
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Колонка paidByManagerId добавлена в club_cash_transactions');
  } catch (error) {
    console.error('❌ Ошибка миграции add-paid-by-manager-to-cash-transactions:', error);
    throw error;
  }
};

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
