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

    // Получаем новый пароль из аргументов командной строки или переменной окружения
    const newPassword = process.argv[2] || process.env.ADMIN_NEW_PASSWORD || 'admin123';
    
    // Валидация пароля
    if (newPassword.length < 6) {
      console.error('❌ Пароль должен содержать минимум 6 символов');
      process.exit(1);
    }

    const hashedPassword = await hashPassword(newPassword);

    // Обновляем пароль
    admin.password = hashedPassword;
    admin.isActive = true; // Убеждаемся, что пользователь активен
    await userRepository.save(admin);

    console.log('\n✅ Пароль суперадминистратора успешно изменен!');
    console.log('\n📝 Новые учетные данные:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    admin@marina-crm.com`);
    console.log(`Пароль:   ${newPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  ВАЖНО: Сохраните этот пароль в безопасном месте!');
    console.log('\n💡 Использование:');
    console.log('   npm run reset-admin <новый_пароль>');
    console.log('   или установите переменную окружения ADMIN_NEW_PASSWORD');

    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Ошибка при сбросе пароля:', error);
    process.exit(1);
  }
};

resetAdminPassword();

