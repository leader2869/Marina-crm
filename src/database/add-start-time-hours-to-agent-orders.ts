import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addStartTimeHoursToAgentOrders = async (): Promise<void> => {
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
    console.log('✅ Подключение к базе данных установлено');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    // Проверяем, существует ли колонка startTime
    const startTimeExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'agent_orders' AND column_name = 'startTime'
      );
    `);

    if (!startTimeExists[0].exists) {
      await queryRunner.query(`
        ALTER TABLE agent_orders 
        ADD COLUMN "startTime" TIME;
      `);
      console.log('✅ Колонка startTime добавлена в agent_orders');
    } else {
      console.log('ℹ️  Колонка startTime уже существует');
    }

    // Проверяем, существует ли колонка hoursCount
    const hoursCountExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'agent_orders' AND column_name = 'hoursCount'
      );
    `);

    if (!hoursCountExists[0].exists) {
      await queryRunner.query(`
        ALTER TABLE agent_orders 
        ADD COLUMN "hoursCount" DECIMAL(5, 2);
      `);
      console.log('✅ Колонка hoursCount добавлена в agent_orders');
    } else {
      console.log('ℹ️  Колонка hoursCount уже существует');
    }

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Миграция завершена успешно');
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    throw error;
  }
};

// Запуск миграции, если файл выполняется напрямую
if (require.main === module) {
  addStartTimeHoursToAgentOrders()
    .then(() => {
      console.log('Миграция выполнена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Ошибка миграции:', error);
      process.exit(1);
    });
}

export default addStartTimeHoursToAgentOrders;

