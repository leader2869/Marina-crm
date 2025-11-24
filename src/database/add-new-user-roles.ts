import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Миграция для добавления новых ролей пользователей в enum
 * Добавляет роли: agent, captain, mechanic
 */
const addNewUserRoles = async (): Promise<void> => {
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

    // Проверяем текущие значения enum
    const enumValues = await queryRunner.query(`
      SELECT unnest(enum_range(NULL::user_role_enum))::text as role;
    `);

    console.log('Текущие роли в enum:', enumValues.map((r: any) => r.role));

    const existingRoles = enumValues.map((r: any) => r.role);
    const newRoles = ['agent', 'captain', 'mechanic'];
    const rolesToAdd = newRoles.filter(role => !existingRoles.includes(role));

    if (rolesToAdd.length === 0) {
      console.log('ℹ️  Все новые роли уже существуют в enum');
      await queryRunner.release();
      await AppDataSource.destroy();
      return;
    }

    // Добавляем новые роли в enum
    for (const role of rolesToAdd) {
      try {
        await queryRunner.query(`
          ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS '${role}';
        `);
        console.log(`✅ Роль '${role}' добавлена в enum`);
      } catch (error: any) {
        // Если роль уже существует, пропускаем
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          console.log(`ℹ️  Роль '${role}' уже существует`);
        } else {
          throw error;
        }
      }
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
addNewUserRoles()
  .then(() => {
    console.log('✅ Миграция успешно завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  });

