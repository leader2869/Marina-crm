import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const execAsync = promisify(exec);

interface BackupOptions {
  outputDir?: string;
  filename?: string;
  format?: 'custom' | 'plain' | 'tar';
}

async function createBackup(options: BackupOptions = {}) {
  const {
    outputDir = './backups',
    filename,
    format = 'custom',
  } = options;

  // Получаем параметры подключения к БД
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'marina_crm';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'postgres';

  // Создаем директорию для резервных копий, если её нет
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Создана директория для резервных копий: ${outputDir}`);
  }

  // Генерируем имя файла, если не указано
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFilename = filename || `marina_crm_backup_${timestamp}.dump`;
  const backupPath = path.join(outputDir, backupFilename);

  // Определяем расширение файла в зависимости от формата
  let fileExtension = '.dump';
  if (format === 'plain') {
    fileExtension = '.sql';
  } else if (format === 'tar') {
    fileExtension = '.tar';
  }

  const finalBackupPath = backupPath.endsWith(fileExtension) 
    ? backupPath 
    : backupPath + fileExtension;

  console.log('Начинаю создание резервной копии...');
  console.log(`База данных: ${dbName}`);
  console.log(`Хост: ${dbHost}:${dbPort}`);
  console.log(`Формат: ${format}`);
  console.log(`Путь к файлу: ${finalBackupPath}`);

  try {
    // Формируем команду pg_dump
    let pgDumpCommand = `pg_dump`;
    
    // Добавляем параметры
    pgDumpCommand += ` -h ${dbHost}`;
    pgDumpCommand += ` -p ${dbPort}`;
    pgDumpCommand += ` -U ${dbUser}`;
    pgDumpCommand += ` -d ${dbName}`;
    
    // Формат резервной копии
    if (format === 'custom') {
      pgDumpCommand += ` -Fc`; // Custom format (сжатый, можно восстанавливать выборочно)
    } else if (format === 'tar') {
      pgDumpCommand += ` -Ft`; // Tar format
    } else {
      pgDumpCommand += ` -Fp`; // Plain format (SQL текст)
    }
    
    pgDumpCommand += ` -f "${finalBackupPath}"`;

    // Устанавливаем переменную окружения для пароля
    const env = {
      ...process.env,
      PGPASSWORD: dbPassword,
    };

    // Выполняем команду
    const { stdout, stderr } = await execAsync(pgDumpCommand, {
      env,
      maxBuffer: 10 * 1024 * 1024, // 10MB буфер
    });

    if (stderr && !stderr.includes('NOTICE')) {
      console.warn('Предупреждения:', stderr);
    }

    if (stdout) {
      console.log(stdout);
    }

    // Проверяем, что файл создан
    if (fs.existsSync(finalBackupPath)) {
      const stats = fs.statSync(finalBackupPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log('\n✅ Резервная копия успешно создана!');
      console.log(`📁 Файл: ${finalBackupPath}`);
      console.log(`📊 Размер: ${fileSizeMB} MB`);
      console.log(`🕐 Дата создания: ${new Date().toLocaleString('ru-RU')}`);
      
      return finalBackupPath;
    } else {
      throw new Error('Файл резервной копии не был создан');
    }
  } catch (error: any) {
    console.error('\n❌ Ошибка при создании резервной копии:');
    console.error(error.message);
    
    if (error.message.includes('pg_dump')) {
      console.error('\n💡 Убедитесь, что:');
      console.error('   1. PostgreSQL установлен и pg_dump доступен в PATH');
      console.error('   2. Параметры подключения к БД указаны правильно в .env файле');
      console.error('   3. Пользователь БД имеет права на создание резервных копий');
    }
    
    throw error;
  }
}

// Функция для восстановления из резервной копии
async function restoreBackup(backupPath: string, options: { clean?: boolean } = {}) {
  const { clean = false } = options;

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'marina_crm';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'postgres';

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Файл резервной копии не найден: ${backupPath}`);
  }

  console.log('Начинаю восстановление из резервной копии...');
  console.log(`Файл: ${backupPath}`);
  console.log(`База данных: ${dbName}`);
  console.log(`⚠️  ВНИМАНИЕ: Все данные в базе будут заменены!`);

  try {
    let restoreCommand = `pg_restore`;
    
    restoreCommand += ` -h ${dbHost}`;
    restoreCommand += ` -p ${dbPort}`;
    restoreCommand += ` -U ${dbUser}`;
    restoreCommand += ` -d ${dbName}`;
    
    if (clean) {
      restoreCommand += ` --clean`; // Удалить существующие объекты перед восстановлением
    }
    
    restoreCommand += ` --if-exists`; // Не выдавать ошибку, если объект не существует
    restoreCommand += ` --no-owner`; // Не восстанавливать владельца объектов
    restoreCommand += ` --no-acl`; // Не восстанавливать права доступа
    restoreCommand += ` "${backupPath}"`;

    const env = {
      ...process.env,
      PGPASSWORD: dbPassword,
    };

    const { stdout, stderr } = await execAsync(restoreCommand, {
      env,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr && !stderr.includes('NOTICE') && !stderr.includes('WARNING')) {
      console.warn('Предупреждения:', stderr);
    }

    if (stdout) {
      console.log(stdout);
    }

    console.log('\n✅ База данных успешно восстановлена!');
  } catch (error: any) {
    console.error('\n❌ Ошибка при восстановлении:');
    console.error(error.message);
    throw error;
  }
}

// Функция для получения списка резервных копий
function listBackups(backupDir: string = './backups') {
  if (!fs.existsSync(backupDir)) {
    console.log('Директория с резервными копиями не найдена.');
    return [];
  }

  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.dump') || file.endsWith('.sql') || file.endsWith('.tar'))
    .map(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        path: filePath,
        size: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
        created: stats.birthtime,
      };
    })
    .sort((a, b) => b.created.getTime() - a.created.getTime());

  return files;
}

// Основная функция
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'create' || !command) {
      // Создание резервной копии
      const format = args[1] as 'custom' | 'plain' | 'tar' || 'custom';
      await createBackup({ format });
    } else if (command === 'restore') {
      // Восстановление из резервной копии
      const backupPath = args[1];
      if (!backupPath) {
        console.error('Укажите путь к файлу резервной копии');
        console.error('Пример: npm run backup restore ./backups/marina_crm_backup_2025-11-10.dump');
        process.exit(1);
      }
      const clean = args.includes('--clean');
      await restoreBackup(backupPath, { clean });
    } else if (command === 'list') {
      // Список резервных копий
      const backups = listBackups();
      if (backups.length === 0) {
        console.log('Резервные копии не найдены.');
      } else {
        console.log('\n📋 Список резервных копий:\n');
        backups.forEach((backup, index) => {
          console.log(`${index + 1}. ${backup.filename}`);
          console.log(`   Размер: ${backup.sizeMB} MB`);
          console.log(`   Создана: ${backup.created.toLocaleString('ru-RU')}`);
          console.log(`   Путь: ${backup.path}\n`);
        });
      }
    } else {
      console.log('Использование:');
      console.log('  npm run backup              - Создать резервную копию (custom формат)');
      console.log('  npm run backup create       - Создать резервную копию');
      console.log('  npm run backup create plain - Создать резервную копию в SQL формате');
      console.log('  npm run backup create tar   - Создать резервную копию в TAR формате');
      console.log('  npm run backup restore <путь> [--clean] - Восстановить из резервной копии');
      console.log('  npm run backup list         - Показать список резервных копий');
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

// Запускаем только если скрипт вызван напрямую
if (require.main === module) {
  main();
}

export { createBackup, restoreBackup, listBackups };

