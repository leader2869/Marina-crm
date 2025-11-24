import { AppDataSource } from '../config/database';
import { Vessel } from '../entities/Vessel';
import * as dotenv from 'dotenv';

dotenv.config();

const checkVesselsPassengerCapacity = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    const vesselRepository = AppDataSource.getRepository(Vessel);
    
    // Получаем все катера
    const vessels = await vesselRepository.find({
      select: ['id', 'name', 'passengerCapacity'],
      take: 10,
    });

    console.log(`\n📊 Найдено катеров: ${vessels.length}`);
    console.log('\nДанные о пассажировместимости:');
    console.log('─'.repeat(60));
    
    vessels.forEach((vessel) => {
      console.log(`ID: ${vessel.id} | Название: ${vessel.name} | Пассажировместимость: ${vessel.passengerCapacity ?? 'NULL/undefined'}`);
    });

    // Проверяем, есть ли катера без пассажировместимости
    const vesselsWithoutCapacity = await vesselRepository
      .createQueryBuilder('vessel')
      .where('vessel.passengerCapacity IS NULL')
      .getCount();

    console.log(`\n⚠️  Катеров без пассажировместимости: ${vesselsWithoutCapacity}`);

    if (vesselsWithoutCapacity > 0) {
      console.log('\n💡 Рекомендация: Обновите существующие катера, добавив пассажировместимость');
    }

    await AppDataSource.destroy();
    console.log('\n✅ Проверка завершена!');
  } catch (error: any) {
    console.error('❌ Ошибка при проверке:', error.message);
    console.error('❌ Stack:', error.stack);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
};

checkVesselsPassengerCapacity();

