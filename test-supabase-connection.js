require('dotenv').config();
const { Client } = require('pg');

console.log('🔍 Проверка подключения к Supabase...\n');

// Определяем connection string
let connectionConfig;

if (process.env.DATABASE_URL) {
  // Используем connection string
  connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false,
  };
  console.log('📝 Используется DATABASE_URL (connection string)');
} else {
  // Используем отдельные параметры
  connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'marina_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
  console.log('📝 Используются отдельные параметры подключения');
  console.log(`   Host: ${connectionConfig.host}`);
  console.log(`   Port: ${connectionConfig.port}`);
  console.log(`   Database: ${connectionConfig.database}`);
  console.log(`   User: ${connectionConfig.user}`);
}

console.log('');

const client = new Client(connectionConfig);

client.connect()
  .then(() => {
    console.log('✅ Подключение к базе данных успешно!\n');
    return client.query('SELECT NOW() as current_time, version() as pg_version');
  })
  .then((result) => {
    console.log('📊 Информация о сервере:');
    console.log(`   Текущее время: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL версия: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}\n`);
    
    // Проверяем существование таблиц
    return client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
  })
  .then((result) => {
    if (result.rows.length > 0) {
      console.log(`📋 Найдено таблиц: ${result.rows.length}`);
      console.log('   Таблицы:');
      result.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name}`);
      });
    } else {
      console.log('⚠️  Таблицы не найдены. Возможно, схема БД еще не создана.');
    }
    console.log('');
    client.end();
    console.log('✅ Тест подключения завершен успешно!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Ошибка подключения:');
    console.error(`   ${err.message}\n`);
    
    if (err.message.includes('password authentication failed')) {
      console.error('💡 Возможные решения:');
      console.error('   1. Проверьте правильность пароля в .env файле');
      console.error('   2. Убедитесь, что используете правильный пароль от Supabase проекта');
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
      console.error('💡 Возможные решения:');
      console.error('   1. Проверьте правильность хоста в .env файле');
      console.error('   2. Убедитесь, что проект Supabase активен');
      console.error('   3. Проверьте интернет-соединение');
    } else if (err.message.includes('does not exist')) {
      console.error('💡 Возможные решения:');
      console.error('   1. Проверьте имя базы данных в .env файле');
      console.error('   2. В Supabase используется база "postgres" по умолчанию');
    }
    
    process.exit(1);
  });

