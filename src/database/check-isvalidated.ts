import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import * as dotenv from 'dotenv';

dotenv.config();

const checkIsValidated = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    const userRepository = AppDataSource.getRepository(User);
    
    // Получаем всех пользователей
    const users = await userRepository.find({
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isValidated'],
    });

    console.log('\n📊 Статус валидации пользователей:');
    console.log('='.repeat(80));
    
    users.forEach((user) => {
      const status = user.isValidated ? '✅ Валидирован' : '⏳ Ожидает валидации';
      console.log(`${user.id}. ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   Роль: ${user.role}`);
      console.log(`   Статус: ${status}`);
      console.log('');
    });

    // Проверяем CLUB_OWNER
    const clubOwners = users.filter(u => u.role === 'club_owner');
    const validatedClubOwners = clubOwners.filter(u => u.isValidated);
    const pendingClubOwners = clubOwners.filter(u => !u.isValidated);

    console.log('📈 Статистика:');
    console.log(`   Всего пользователей: ${users.length}`);
    console.log(`   Владельцев клубов: ${clubOwners.length}`);
    console.log(`   - Валидированных: ${validatedClubOwners.length}`);
    console.log(`   - Ожидают валидации: ${pendingClubOwners.length}`);

    await AppDataSource.destroy();
    console.log('\n✅ Проверка завершена!');
  } catch (error) {
    console.error('❌ Ошибка при проверке:', error);
    process.exit(1);
  }
};

checkIsValidated();

