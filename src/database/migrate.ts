import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';

// Загружаем переменные окружения из .env файла
dotenv.config();

const migrate = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    // Проверяем, используется ли Supabase (по хосту или connection string)
    const isSupabase = 
      process.env.DATABASE_URL?.includes('supabase.co') || 
      process.env.DATABASE_URL?.includes('pooler.supabase.com') ||
      process.env.DB_HOST?.includes('supabase.co') ||
      process.env.DB_HOST?.includes('pooler.supabase.com');

    // Для Supabase и development используем synchronize
    // Для production локальной БД лучше использовать миграции
    if (isSupabase || process.env.NODE_ENV !== 'production') {
      console.log('✅ Схема базы данных синхронизирована через TypeORM synchronize');
      console.log('   Все таблицы и связи созданы автоматически');
    } else {
      console.log('⚠️  В production режиме рекомендуется использовать миграции TypeORM');
      console.log('   Для создания миграций используйте:');
      console.log('   npx typeorm migration:create src/database/migrations/MigrationName');
      console.log('   npx typeorm migration:run');
      console.log('');
      console.log('   Или используйте synchronize (не рекомендуется для production):');
      console.log('   Установите NODE_ENV=development в .env файле');
    }

    await AppDataSource.destroy();
  } catch (error: any) {
    console.error('❌ Ошибка при миграции:', error.message || error);
    
    // Проверяем типичные ошибки подключения
    if (error.code === 'ENOTFOUND' || error.message?.includes('ENOTFOUND')) {
      console.error('\n💡 Проблема: Не удается найти хост базы данных');
      console.error('\n📝 Решение:');
      console.error('   1. Проверьте файл .env в корне проекта');
      console.error('   2. Убедитесь, что указан правильный хост Supabase');
      console.error('   3. Если используете DATABASE_URL, проверьте connection string');
      console.error('   4. Если используете отдельные параметры, проверьте DB_HOST');
      console.error('\n   Пример правильного .env:');
      console.error('   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres');
      console.error('   ИЛИ');
      console.error('   DB_HOST=db.xxxxx.supabase.co  ← Замените на ваш реальный хост!');
      console.error('   DB_PORT=5432');
      console.error('   DB_NAME=postgres');
      console.error('   DB_USER=postgres');
      console.error('   DB_PASSWORD=ваш_пароль');
      console.error('\n   ⚠️  НЕ используйте пример "db.xxxxx.supabase.co" - это только шаблон!');
      console.error('   Получите реальный хост из Supabase Dashboard → Settings → Database');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Проблема: Отказано в подключении');
      console.error('\n📝 Решение:');
      console.error('   1. Проверьте, что проект Supabase активен');
      console.error('   2. Проверьте правильность порта (5432 для direct, 6543 для pooler)');
      console.error('   3. Проверьте интернет-соединение');
    } else if (error.message?.includes('password authentication failed')) {
      console.error('\n💡 Проблема: Неверный пароль');
      console.error('\n📝 Решение:');
      console.error('   1. Проверьте пароль в .env файле');
      console.error('   2. Убедитесь, что используете правильный пароль от Supabase проекта');
    }
    
    process.exit(1);
  }
};

migrate();



