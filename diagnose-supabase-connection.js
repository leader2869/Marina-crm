require('dotenv').config();
const { exec } = require('child_process');
const { promisify } = require('util');
const dns = require('dns').promises;

const execAsync = promisify(exec);

console.log('🔍 Диагностика подключения к Supabase...\n');

// Проверяем переменные окружения
console.log('📋 Проверка переменных окружения:');
console.log('');

if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL установлен');
  const url = process.env.DATABASE_URL;
  
  // Проверяем на переносы строк
  if (url.includes('\n') || url.includes('\r')) {
    console.error('❌ ОШИБКА: DATABASE_URL содержит переносы строк!');
    console.error('   Connection string должен быть на ОДНОЙ строке!');
    console.error('\n💡 Решение:');
    console.error('   1. Откройте файл .env');
    console.error('   2. Убедитесь, что DATABASE_URL на одной строке');
    console.error('   3. Удалите все переносы строк внутри connection string');
    console.error('   4. Сохраните файл');
    console.error('\n   Пример правильного формата:');
    console.error('   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres');
    console.error('   (ВСЕ на одной строке!)');
  }
  
  // Маскируем пароль для безопасности
  const maskedUrl = url.replace(/:[^:@]+@/, ':***@').replace(/[\n\r]/g, '');
  console.log(`   ${maskedUrl}`);
} else {
  console.log('⚠️  DATABASE_URL не установлен');
}

if (process.env.DB_HOST) {
  console.log(`✅ DB_HOST: ${process.env.DB_HOST}`);
} else {
  console.log('⚠️  DB_HOST не установлен');
}

if (process.env.DB_PORT) {
  console.log(`✅ DB_PORT: ${process.env.DB_PORT}`);
} else {
  console.log('⚠️  DB_PORT не установлен');
}

if (process.env.DB_NAME) {
  console.log(`✅ DB_NAME: ${process.env.DB_NAME}`);
} else {
  console.log('⚠️  DB_NAME не установлен');
}

if (process.env.DB_USER) {
  console.log(`✅ DB_USER: ${process.env.DB_USER}`);
} else {
  console.log('⚠️  DB_USER не установлен');
}

if (process.env.DB_PASSWORD) {
  console.log('✅ DB_PASSWORD установлен (скрыт)');
} else {
  console.log('⚠️  DB_PASSWORD не установлен');
}

console.log('');

// Определяем хост для проверки
let hostToCheck = null;

if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    hostToCheck = url.hostname;
  } catch (e) {
    console.error('❌ Ошибка парсинга DATABASE_URL:', e.message);
  }
} else if (process.env.DB_HOST) {
  hostToCheck = process.env.DB_HOST;
}

if (!hostToCheck) {
  console.error('❌ Не удалось определить хост для проверки');
  console.error('\n💡 Убедитесь, что в .env файле указан либо DATABASE_URL, либо DB_HOST');
  process.exit(1);
}

console.log(`🌐 Проверка DNS для хоста: ${hostToCheck}`);
console.log('');

// Проверяем DNS
async function checkDNS() {
  try {
    const addresses = await dns.resolve4(hostToCheck);
    console.log('✅ DNS резолюция успешна!');
    console.log(`   IP адреса: ${addresses.join(', ')}`);
    return true;
  } catch (error) {
    console.error('❌ DNS резолюция не удалась:');
    console.error(`   ${error.message}`);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      console.error('\n💡 Возможные причины:');
      console.error('   1. Проект Supabase приостановлен или удален');
      console.error('   2. Неправильный хост в .env файле');
      console.error('   3. Проект еще не полностью создан (подождите несколько минут)');
      console.error('   4. Проблемы с интернет-соединением');
      console.error('\n📝 Решение:');
      console.error('   1. Откройте Supabase Dashboard: https://supabase.com/dashboard');
      console.error('   2. Проверьте статус проекта:');
      console.error('      - ✅ Active (зеленый) - проект активен');
      console.error('      - ⏸️  Paused (желтый) - проект приостановлен (нажмите Restore)');
      console.error('      - ❌ Deleted (красный) - проект удален (создайте новый)');
      console.error('   3. Если проект приостановлен:');
      console.error('      - Нажмите "Restore" или "Resume"');
      console.error('      - Подождите 1-2 минуты');
      console.error('   4. Перейдите в Settings → Database');
      console.error('   5. Скопируйте connection string заново');
      console.error('   6. Проверьте Reference ID в Settings → General');
      console.error('   7. Убедитесь, что Reference ID совпадает с хостом в .env');
      console.error('\n💡 Альтернатива: Попробуйте использовать Connection Pooler');
      console.error('   - В Settings → Database найдите "Connection pooling"');
      console.error('   - Используйте connection string с портом 6543');
      console.error('   - Хост будет выглядеть как: aws-0-[REGION].pooler.supabase.com');
      console.error('\n📝 Проверка через браузер:');
      console.error(`   Попробуйте открыть: https://${hostToCheck}`);
      console.error('   - Если видите страницу - хост существует (проблема с DNS)');
      console.error('   - Если "Сайт не найден" - проект приостановлен/удален');
    }
    
    return false;
  }
}

// Проверяем ping (если доступен)
async function checkPing() {
  try {
    const { stdout, stderr } = await execAsync(`ping -n 1 ${hostToCheck}`, {
      timeout: 5000,
      windowsHide: true
    });
    
    if (stdout.includes('TTL') || stdout.includes('time=')) {
      console.log('✅ Ping успешен - хост доступен');
      return true;
    } else {
      console.log('⚠️  Ping не дал результатов');
      return false;
    }
  } catch (error) {
    console.log('⚠️  Ping не удался (это нормально, если ping заблокирован)');
    return false;
  }
}

// Проверяем подключение к порту
async function checkPort() {
  const net = require('net');
  const port = process.env.DB_PORT || 5432;
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log(`✅ Порт ${port} доступен`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log(`⚠️  Таймаут при подключении к порту ${port}`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (error) => {
      console.log(`⚠️  Не удалось подключиться к порту ${port}: ${error.message}`);
      resolve(false);
    });
    
    socket.connect(parseInt(port), hostToCheck);
  });
}

// Основная функция
async function main() {
  const dnsOk = await checkDNS();
  
  if (!dnsOk) {
    console.log('\n❌ Проблема с DNS - дальнейшие проверки невозможны');
    console.log('\n📝 Следующие шаги:');
    console.log('   1. Проверьте статус проекта в Supabase Dashboard');
    console.log('   2. Убедитесь, что проект не приостановлен');
    console.log('   3. Проверьте правильность хоста в .env файле');
    console.log('   4. Если проект только что создан, подождите 2-3 минуты');
    process.exit(1);
  }
  
  console.log('');
  await checkPing();
  console.log('');
  await checkPort();
  
  console.log('\n✅ Диагностика завершена');
  console.log('\n💡 Если DNS работает, но подключение не удается:');
  console.log('   1. Проверьте правильность пароля');
  console.log('   2. Проверьте, что используете правильный порт (5432 для direct, 6543 для pooler)');
  console.log('   3. Попробуйте использовать connection pooler вместо direct connection');
}

main().catch(console.error);

