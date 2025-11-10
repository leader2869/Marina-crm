import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { hashPassword } from '../utils/password';

// Загружаем переменные окружения из .env файла
dotenv.config();

const resetAdminPassword = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    const userRepository = AppDataSource.getRepository(User);

    // Находим суперадминистратора
    const admin = await userRepository.findOne({
      where: { email: 'admin@marina-crm.com' },
    });

    if (!admin) {
      console.error('❌ Суперадминистратор не найден');
      console.log('💡 Создайте суперадминистратора через npm run seed');
      process.exit(1);
    }

    // Генерируем новый пароль
    const newPassword = 'admin123';
    const hashedPassword = await hashPassword(newPassword);

    // Обновляем пароль
    admin.password = hashedPassword;
    await userRepository.save(admin);

    console.log('\n✅ Пароль суперадминистратора успешно сброшен!');
    console.log('\n📝 Новые учетные данные:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    admin@marina-crm.com`);
    console.log(`Пароль:   ${newPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  ВАЖНО: Сохраните этот пароль в безопасном месте!');

    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Ошибка при сбросе пароля:', error);
    process.exit(1);
  }
};

resetAdminPassword();

