const { Client } = require('pg');
require('dotenv').config();

console.log('🔍 Проверка подключения к базе данных...\n');
console.log('Параметры подключения:');
console.log('  Host:', process.env.DB_HOST || '❌ НЕ УСТАНОВЛЕН');
console.log('  Port:', process.env.DB_PORT || '❌ НЕ УСТАНОВЛЕН');
console.log('  Database:', process.env.DB_NAME || '❌ НЕ УСТАНОВЛЕН');
console.log('  User:', process.env.DB_USER || '❌ НЕ УСТАНОВЛЕН');
console.log('  Password:', process.env.DB_PASSWORD ? '***установлен***' : '❌ НЕ УСТАНОВЛЕН');
console.log('');

if (!process.env.DB_HOST || !process.env.DB_PORT || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('❌ ОШИБКА: Не все параметры подключения установлены в .env файле!');
  console.error('\n💡 Создайте файл .env в корне проекта со следующим содержимым:');
  console.error(`
DB_HOST=localhost
DB_PORT=5432
DB_NAME=marina_crm
DB_USER=postgres
DB_PASSWORD=ваш_пароль_от_postgres
  `);
  process.exit(1);
}

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

console.log('Попытка подключения...\n');

client.connect()
  .then(() => {
    console.log('✅ Подключение к базе данных успешно!');
    return client.query('SELECT NOW() as current_time, current_database() as database_name, current_user as user_name');
  })
  .then((result) => {
    console.log('\n📊 Информация о подключении:');
    console.log('  📅 Время БД:', result.rows[0].current_time);
    console.log('  🗄️  База данных:', result.rows[0].database_name);
    console.log('  👤 Пользователь:', result.rows[0].user_name);
    console.log('\n✅ Всё работает! Можно запускать миграции.');
    client.end();
  })
  .catch((error) => {
    console.error('\n❌ ОШИБКА ПОДКЛЮЧЕНИЯ:');
    console.error('  Код:', error.code);
    console.error('  Сообщение:', error.message);
    
    console.error('\n💡 Возможные причины и решения:');
    
    if (error.code === '28P01') {
      console.error('  ❌ Неверный пароль или пользователь');
      console.error('  ✅ Решение:');
      console.error('     1. Проверьте пароль в .env файле');
      console.error('     2. Попробуйте подключиться через pgAdmin с тем же паролем');
      console.error('     3. Если забыли пароль - см. инструкцию по сбросу в TROUBLESHOOTING.md');
    } else if (error.code === '3D000') {
      console.error('  ❌ База данных не существует');
      console.error('  ✅ Решение:');
      console.error('     1. Создайте базу данных: CREATE DATABASE marina_crm;');
      console.error('     2. Или через pgAdmin: правой кнопкой на Databases → Create → Database');
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('  ❌ PostgreSQL не запущен или недоступен');
      console.error('  ✅ Решение:');
      console.error('     1. Проверьте, запущен ли PostgreSQL (services.msc)');
      console.error('     2. Проверьте, что порт 5432 не занят');
      console.error('     3. Проверьте настройки файрвола');
    } else {
      console.error('  ❌ Неизвестная ошибка');
      console.error('  ✅ Решение:');
      console.error('     1. Проверьте логи PostgreSQL');
      console.error('     2. Убедитесь, что PostgreSQL установлен и запущен');
      console.error('     3. Проверьте настройки в .env файле');
    }
    
    console.error('\n📚 Подробные инструкции:');
    console.error('   - DATABASE_SETUP.md - настройка базы данных');
    console.error('   - TROUBLESHOOTING.md - решение проблем');
    
    process.exit(1);
  });

