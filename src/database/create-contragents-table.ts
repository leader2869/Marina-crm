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
      
      // Создаем таблицу через synchronize
      // TypeORM автоматически создаст таблицу на основе entity
      await AppDataSource.synchronize();
      
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

