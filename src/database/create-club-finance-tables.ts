import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const createClubFinanceTables = async (): Promise<void> => {
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

    console.log('📝 Выполняем миграцию: создание таблиц club_partners и club_cash_transactions...');

    const sqlScript = `
-- 0) Создание enum-типов при необходимости
DO $$ BEGIN
  CREATE TYPE cash_transaction_type_enum AS ENUM ('income', 'expense');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cash_payment_method_enum AS ENUM ('cash', 'non_cash');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE currency_enum AS ENUM ('RUB', 'USD', 'EUR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1) Таблица партнеров яхт-клуба
CREATE TABLE IF NOT EXISTS club_partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "sharePercent" DECIMAL(5,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "clubId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_club_partner_club
    FOREIGN KEY ("clubId")
    REFERENCES clubs(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_club_partners_club_id ON club_partners("clubId");
CREATE INDEX IF NOT EXISTS idx_club_partners_active ON club_partners("isActive");

-- 2) Таблица кассовых операций яхт-клуба
CREATE TABLE IF NOT EXISTS club_cash_transactions (
  id SERIAL PRIMARY KEY,
  "transactionType" cash_transaction_type_enum NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency currency_enum NOT NULL DEFAULT 'RUB',
  "paymentMethod" cash_payment_method_enum NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  "bookingId" INTEGER,
  "clubId" INTEGER NOT NULL,
  "acceptedByPartnerId" INTEGER,
  "paidByPartnerId" INTEGER,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_club_cash_tx_club
    FOREIGN KEY ("clubId")
    REFERENCES clubs(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_club_cash_tx_accepted_partner
    FOREIGN KEY ("acceptedByPartnerId")
    REFERENCES club_partners(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_club_cash_tx_paid_partner
    FOREIGN KEY ("paidByPartnerId")
    REFERENCES club_partners(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_club_cash_tx_created_by
    FOREIGN KEY ("createdById")
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_club_cash_tx_booking
    FOREIGN KEY ("bookingId")
    REFERENCES bookings(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_club_cash_tx_club_id ON club_cash_transactions("clubId");
CREATE INDEX IF NOT EXISTS idx_club_cash_tx_date ON club_cash_transactions(date);
CREATE INDEX IF NOT EXISTS idx_club_cash_tx_type ON club_cash_transactions("transactionType");
CREATE INDEX IF NOT EXISTS idx_club_cash_tx_accepted_partner ON club_cash_transactions("acceptedByPartnerId");
CREATE INDEX IF NOT EXISTS idx_club_cash_tx_paid_partner ON club_cash_transactions("paidByPartnerId");
    `;

    await queryRunner.query(sqlScript);

    console.log('✅ Таблицы club_partners и club_cash_transactions созданы/обновлены');

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Миграция завершена успешно!');
  } catch (error: any) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    console.error('❌ Полная ошибка:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
};

createClubFinanceTables();

