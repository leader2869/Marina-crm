import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { Club } from '../entities/Club';

dotenv.config();

const checkClubs = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    const clubRepository = AppDataSource.getRepository(Club);

    // Проверяем наличие клубов
    const clubs = await clubRepository.find({
      relations: ['owner'],
    });

    console.log(`\n📋 Найдено яхт-клубов: ${clubs.length}`);

    if (clubs.length === 0) {
      console.log('\n⚠️  Яхт-клубы не найдены в базе данных!');
      console.log('💡 Запустите: npm run seed');
    } else {
      console.log('\n📋 Список яхт-клубов:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      clubs.forEach((club, index) => {
        console.log(`\n${index + 1}. ${club.name}`);
        console.log(`   ID: ${club.id}`);
        console.log(`   Адрес: ${club.address}`);
        console.log(`   Владелец: ${club.owner?.firstName} ${club.owner?.lastName} (${club.owner?.email})`);
        console.log(`   Мест: ${club.totalBerths}`);
        console.log(`   Активен: ${club.isActive ? '✅ Да' : '❌ Нет'}`);
        console.log(`   Создан: ${club.createdAt}`);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
};

checkClubs();

