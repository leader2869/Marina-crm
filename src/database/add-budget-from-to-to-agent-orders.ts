import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const addBudgetFromToToAgentOrders = async (): Promise<void> => {
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
    await queryRunner.startTransaction();

    try {
      // Проверяем, существуют ли уже колонки
      const budgetFromExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'agent_orders' 
          AND column_name = 'budgetFrom'
        );
      `);

      const budgetToExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'agent_orders' 
          AND column_name = 'budgetTo'
        );
      `);

      if (!budgetFromExists[0].exists) {
        await queryRunner.query(`
          ALTER TABLE agent_orders 
          ADD COLUMN "budgetFrom" DECIMAL(10, 2);
        `);
        console.log('✅ Колонка budgetFrom добавлена');
      } else {
        console.log('ℹ️  Колонка budgetFrom уже существует');
      }

      if (!budgetToExists[0].exists) {
        await queryRunner.query(`
          ALTER TABLE agent_orders 
          ADD COLUMN "budgetTo" DECIMAL(10, 2);
        `);
        console.log('✅ Колонка budgetTo добавлена');
      } else {
        console.log('ℹ️  Колонка budgetTo уже существует');
      }

      await queryRunner.commitTransaction();
      console.log('✅ Миграция успешно завершена');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
};

// Запускаем миграцию, если файл выполняется напрямую
if (require.main === module) {
  addBudgetFromToToAgentOrders()
    .then(() => {
      console.log('✅ Миграция завершена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка миграции:', error);
      process.exit(1);
    });
}

export default addBudgetFromToToAgentOrders;

