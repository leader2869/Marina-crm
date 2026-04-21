import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

const addCashTransferType = async (): Promise<void> => {
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

    const enumTypeRows = await queryRunner.query(`
      SELECT t.typname AS enum_name
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE c.relname = 'club_cash_transactions'
        AND a.attname = 'transactionType'
        AND t.typtype = 'e'
      LIMIT 1;
    `);

    if (!enumTypeRows.length || !enumTypeRows[0].enum_name) {
      throw new Error('Не найден enum-тип для поля club_cash_transactions.transactionType');
    }

    const enumName = String(enumTypeRows[0].enum_name);
    await queryRunner.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS 'transfer';`);

    await queryRunner.release();
    await dataSource.destroy();
    console.log(`✅ Значение 'transfer' добавлено в enum ${enumName}`);
  } catch (error) {
    console.error('❌ Ошибка миграции add-cash-transfer-type:', error);
    throw error;
  }
};

addCashTransferType()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

