import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';

dotenv.config();

const addPhotosColumns = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    const queryRunner = AppDataSource.createQueryRunner();

    // Проверяем, существует ли колонка photos
    const photosColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vessels' AND column_name = 'photos'
    `);

    if (photosColumnExists.length === 0) {
      console.log('📝 Добавляю колонку photos...');
      await queryRunner.query(`
        ALTER TABLE vessels ADD COLUMN photos TEXT;
      `);
      console.log('✅ Колонка photos добавлена');
    } else {
      console.log('✅ Колонка photos уже существует');
    }

    // Проверяем, существует ли колонка mainPhotoIndex
    const mainPhotoIndexColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vessels' AND column_name = 'mainPhotoIndex'
    `);

    if (mainPhotoIndexColumnExists.length === 0) {
      console.log('📝 Добавляю колонку mainPhotoIndex...');
      await queryRunner.query(`
        ALTER TABLE vessels ADD COLUMN "mainPhotoIndex" INTEGER;
      `);
      console.log('✅ Колонка mainPhotoIndex добавлена');
    } else {
      console.log('✅ Колонка mainPhotoIndex уже существует');
    }

    // Преобразуем существующие данные из photo в photos
    console.log('📝 Преобразую существующие данные из photo в photos...');
    await queryRunner.query(`
      UPDATE vessels 
      SET 
        photos = CASE 
          WHEN photo IS NOT NULL AND photo != '' THEN 
            '["' || REPLACE(photo, '"', '\"') || '"]'
          ELSE NULL
        END,
        "mainPhotoIndex" = CASE 
          WHEN photo IS NOT NULL AND photo != '' THEN 0
          ELSE NULL
        END
      WHERE photo IS NOT NULL AND photo != '' AND (photos IS NULL OR photos = '');
    `);
    console.log('✅ Данные преобразованы');

    await queryRunner.release();
    await AppDataSource.destroy();
    
    console.log('\n🎉 Миграция завершена успешно!');
  } catch (error: any) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  }
};

addPhotosColumns();

