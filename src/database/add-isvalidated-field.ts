import { AppDataSource } from '../config/database';
import * as dotenv from 'dotenv';

dotenv.config();

const addIsValidatedField = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    // Проверяем, существует ли поле
    const table = await queryRunner.getTable('users');
    const hasIsValidated = table?.columns.find(col => col.name === 'isValidated');

    if (hasIsValidated) {
      console.log('✅ Поле isValidated уже существует');
    } else {
      // Добавляем поле
      await queryRunner.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS "isValidated" BOOLEAN NOT NULL DEFAULT true;
      `);
      console.log('✅ Поле isValidated добавлено');

      // Обновляем существующих пользователей: для CLUB_OWNER устанавливаем false, для остальных true
      await queryRunner.query(`
        UPDATE users 
        SET "isValidated" = CASE 
          WHEN role = 'club_owner' THEN false 
          ELSE true 
        END;
      `);
      console.log('✅ Значения поля isValidated обновлены');
    }

    await queryRunner.release();
    await AppDataSource.destroy();
    console.log('✅ Готово!');
  } catch (error) {
    console.error('❌ Ошибка при добавлении поля:', error);
    process.exit(1);
  }
};

addIsValidatedField();

