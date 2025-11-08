import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';

// Загружаем переменные окружения из .env файла
dotenv.config();

const migrate = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    // TypeORM автоматически синхронизирует схему в режиме разработки
    // В продакшене используйте миграции
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  В продакшене используйте миграции TypeORM');
      console.log('Выполните: npm run typeorm migration:run');
    } else {
      console.log('✅ Схема базы данных синхронизирована');
    }

    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
    process.exit(1);
  }
};

migrate();


