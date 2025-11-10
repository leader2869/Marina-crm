import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { hashPassword, comparePassword } from '../utils/password';

// Загружаем переменные окружения из .env файла
dotenv.config();

const checkAdmin = async (): Promise<void> => {
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

    console.log('\n📋 Информация о суперадминистраторе:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID:              ${admin.id}`);
    console.log(`Email:           ${admin.email}`);
    console.log(`Имя:             ${admin.firstName} ${admin.lastName}`);
    console.log(`Роль:            ${admin.role}`);
    console.log(`Активен:         ${admin.isActive ? '✅ Да' : '❌ Нет'}`);
    console.log(`Email проверен:  ${admin.emailVerified ? '✅ Да' : '❌ Нет'}`);
    console.log(`Создан:          ${admin.createdAt}`);
    console.log(`Обновлен:        ${admin.updatedAt}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Проверяем пароль
    const testPassword = 'SuperAdmin2024!';
    const isPasswordValid = await comparePassword(testPassword, admin.password);
    
    console.log(`\n🔐 Проверка пароля "SuperAdmin2024!": ${isPasswordValid ? '✅ Верный' : '❌ Неверный'}`);

    if (!admin.isActive) {
      console.log('\n⚠️  ВНИМАНИЕ: Пользователь неактивен!');
      console.log('💡 Активируем пользователя...');
      admin.isActive = true;
      await userRepository.save(admin);
      console.log('✅ Пользователь активирован');
    }

    if (!isPasswordValid) {
      console.log('\n⚠️  Пароль неверный! Сбрасываем пароль...');
      const newPassword = 'admin123';
      const hashedPassword = await hashPassword(newPassword);
      admin.password = hashedPassword;
      admin.isActive = true;
      await userRepository.save(admin);
      
      console.log('\n✅ Пароль сброшен!');
      console.log('\n📝 Новые учетные данные:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Email:    admin@marina-crm.com`);
      console.log(`Пароль:   ${newPassword}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
};

checkAdmin();

