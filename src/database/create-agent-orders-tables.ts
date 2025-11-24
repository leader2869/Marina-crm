import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Миграция для создания таблиц агентских заказов
 */
const createAgentOrdersTables = async (): Promise<void> => {
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

    console.log('📝 Выполняем миграцию: создание таблиц для агентских заказов...');

    // Проверяем, существует ли таблица agent_orders
    const agentOrdersTableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'agent_orders'
      );
    `);

    if (!agentOrdersTableExists[0].exists) {
      // Создаем enum для статуса заказа
      await queryRunner.query(`
        CREATE TYPE agent_order_status_enum AS ENUM ('active', 'in_progress', 'completed', 'cancelled');
      `);
      console.log('✅ Enum agent_order_status_enum создан');

      // Создаем таблицу agent_orders
      await queryRunner.query(`
        CREATE TABLE agent_orders (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          "startDate" DATE NOT NULL,
          "endDate" DATE NOT NULL,
          "passengerCount" INTEGER NOT NULL,
          budget DECIMAL(10, 2),
          route TEXT,
          "additionalRequirements" TEXT,
          status agent_order_status_enum NOT NULL DEFAULT 'active',
          "selectedVesselId" INTEGER,
          "createdById" INTEGER NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_agent_order_created_by FOREIGN KEY ("createdById") REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_agent_order_vessel FOREIGN KEY ("selectedVesselId") REFERENCES vessels(id) ON DELETE SET NULL
        );
      `);
      console.log('✅ Таблица agent_orders создана');
    } else {
      console.log('ℹ️  Таблица agent_orders уже существует');
    }

    // Проверяем, существует ли таблица agent_order_responses
    const responsesTableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'agent_order_responses'
      );
    `);

    if (!responsesTableExists[0].exists) {
      // Создаем enum для статуса отклика
      await queryRunner.query(`
        CREATE TYPE agent_order_response_status_enum AS ENUM ('pending', 'accepted', 'rejected');
      `);
      console.log('✅ Enum agent_order_response_status_enum создан');

      // Создаем таблицу agent_order_responses
      await queryRunner.query(`
        CREATE TABLE agent_order_responses (
          id SERIAL PRIMARY KEY,
          "orderId" INTEGER NOT NULL,
          "vesselOwnerId" INTEGER NOT NULL,
          "vesselId" INTEGER NOT NULL,
          message TEXT,
          "proposedPrice" DECIMAL(10, 2),
          status agent_order_response_status_enum NOT NULL DEFAULT 'pending',
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_response_order FOREIGN KEY ("orderId") REFERENCES agent_orders(id) ON DELETE CASCADE,
          CONSTRAINT fk_response_vessel_owner FOREIGN KEY ("vesselOwnerId") REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_response_vessel FOREIGN KEY ("vesselId") REFERENCES vessels(id) ON DELETE CASCADE,
          CONSTRAINT unique_order_vessel_response UNIQUE ("orderId", "vesselId")
        );
      `);
      console.log('✅ Таблица agent_order_responses создана');
    } else {
      console.log('ℹ️  Таблица agent_order_responses уже существует');
    }

    await queryRunner.release();
    await dataSource.destroy();
    console.log('✅ Миграция завершена успешно');
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    throw error;
  }
};

// Запускаем миграцию
createAgentOrdersTables()
  .then(() => {
    console.log('✅ Миграция успешно завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  });

