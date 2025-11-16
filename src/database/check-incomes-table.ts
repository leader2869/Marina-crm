import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const checkIncomesTable = async (): Promise<void> => {
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

    console.log('📝 Проверяем структуру таблицы incomes...');

    const columns = await queryRunner.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'incomes'
      ORDER BY ordinal_position;
    `);

    console.log('\nКолонки таблицы incomes:');
    console.table(columns);

    await queryRunner.release();
    await dataSource.destroy();
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
};

checkIncomesTable();

