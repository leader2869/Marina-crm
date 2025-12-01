import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { Contragent } from '../entities/Contragent';

dotenv.config();

const createContragentsTable = async (): Promise<void> => {
  try {
    console.log('🔄 Создание таблицы contragents...\n');

    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    // Проверяем, существует ли таблица
    const queryRunner = AppDataSource.createQueryRunner();
    const tableExists = await queryRunner.hasTable('contragents');

    if (tableExists) {
      console.log('⚠️  Таблица contragents уже существует');
      console.log('   Пропускаем создание таблицы\n');
    } else {
      console.log('📋 Создание таблицы contragents...');
      
      // Создаем таблицу напрямую через SQL
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS contragents (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          data JSONB NOT NULL,
          user_id INTEGER,
          club_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_contragent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          CONSTRAINT fk_contragent_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL
        )
      `);
      
      // Создаем индекс для быстрого поиска по user_id
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_contragents_user_id ON contragents(user_id)
      `);
      
      await queryRunner.release();
      
      console.log('✅ Таблица contragents создана успешно\n');
    }

    // Проверяем количество записей
    const contragentRepository = AppDataSource.getRepository(Contragent);
    const count = await contragentRepository.count();
    console.log(`📊 Количество контрагентов в БД: ${count}\n`);

    await AppDataSource.destroy();
    console.log('✅ Готово!');
  } catch (error: any) {
    console.error('❌ Ошибка при создании таблицы:', error.message);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
};

createContragentsTable();

