import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserRole } from '../types';
import { hashPassword, comparePassword } from '../utils/password';

// Загружаем переменные окружения из .env файла
dotenv.config();

const checkUsers = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    const userRepository = AppDataSource.getRepository(User);

    // Получаем всех пользователей
    const users = await userRepository.find({
      order: { createdAt: 'ASC' },
    });

    console.log('📊 Пользователи в базе данных:');
    console.log('='.repeat(80));

    if (users.length === 0) {
      console.log('❌ Пользователи не найдены!');
      console.log('\n💡 Создаю тестовых пользователей...\n');
      
      // Создаем суперадминистратора
      const superAdmin = userRepository.create({
        email: 'admin@marina-crm.com',
        password: await hashPassword('admin123'),
        firstName: 'Суперадминистратор',
        lastName: 'Системы',
        role: UserRole.SUPER_ADMIN,
        emailVerified: true,
        isActive: true,
        isValidated: true,
      });
      await userRepository.save(superAdmin);
      console.log('✅ Создан суперадминистратор: admin@marina-crm.com / admin123');

      // Создаем владельца клуба
      const clubOwner = userRepository.create({
        email: 'owner@yachtclub.com',
        password: await hashPassword('owner123'),
        firstName: 'Иван',
        lastName: 'Петров',
        role: UserRole.CLUB_OWNER,
        emailVerified: true,
        isActive: true,
        isValidated: true,
      });
      await userRepository.save(clubOwner);
      console.log('✅ Создан владелец клуба: owner@yachtclub.com / owner123');

      // Создаем судовладельца
      const vesselOwner = userRepository.create({
        email: 'vessel@owner.com',
        password: await hashPassword('vessel123'),
        firstName: 'Алексей',
        lastName: 'Сидоров',
        role: UserRole.VESSEL_OWNER,
        emailVerified: true,
        isActive: true,
        isValidated: true,
      });
      await userRepository.save(vesselOwner);
      console.log('✅ Создан судовладелец: vessel@owner.com / vessel123');

      console.log('\n✅ Тестовые пользователи созданы!');
      await AppDataSource.destroy();
      return;
    }

    // Показываем всех пользователей
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   Email:           ${user.email}`);
      console.log(`   Роль:            ${user.role}`);
      console.log(`   Активен:         ${user.isActive ? '✅ Да' : '❌ Нет'}`);
      console.log(`   Email проверен:  ${user.emailVerified ? '✅ Да' : '❌ Нет'}`);
      console.log(`   Валидирован:     ${user.isValidated ? '✅ Да' : '❌ Нет'}`);
      console.log(`   Создан:          ${user.createdAt}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n📈 Всего пользователей: ${users.length}`);

    // Проверяем активных пользователей
    const activeUsers = users.filter(u => u.isActive);
    const inactiveUsers = users.filter(u => !u.isActive);
    
    console.log(`   ✅ Активных: ${activeUsers.length}`);
    console.log(`   ❌ Неактивных: ${inactiveUsers.length}`);

    // Проверяем суперадминистратора
    const admin = users.find(u => u.email === 'admin@marina-crm.com');
    if (admin) {
      console.log('\n🔐 Проверка пароля суперадминистратора:');
      
      // Проверяем несколько возможных паролей
      const testPasswords = ['admin123', 'SuperAdmin2024!', 'admin'];
      let passwordFound = false;
      
      for (const testPassword of testPasswords) {
        const isValid = await comparePassword(testPassword, admin.password);
        if (isValid) {
          console.log(`   ✅ Пароль "${testPassword}" верный`);
          passwordFound = true;
          break;
        }
      }
      
      if (!passwordFound) {
        console.log('   ❌ Пароль не найден среди тестовых');
        console.log('   💡 Сбрасываю пароль на "admin123"...');
        admin.password = await hashPassword('admin123');
        admin.isActive = true;
        await userRepository.save(admin);
        console.log('   ✅ Пароль сброшен на "admin123"');
      }

      if (!admin.isActive) {
        console.log('   ⚠️  Пользователь неактивен! Активирую...');
        admin.isActive = true;
        await userRepository.save(admin);
        console.log('   ✅ Пользователь активирован');
      }
    } else {
      console.log('\n⚠️  Суперадминистратор не найден!');
      console.log('💡 Создаю суперадминистратора...');
      
      const superAdmin = userRepository.create({
        email: 'admin@marina-crm.com',
        password: await hashPassword('admin123'),
        firstName: 'Суперадминистратор',
        lastName: 'Системы',
        role: UserRole.SUPER_ADMIN,
        emailVerified: true,
        isActive: true,
        isValidated: true,
      });
      await userRepository.save(superAdmin);
      console.log('✅ Создан суперадминистратор: admin@marina-crm.com / admin123');
    }

    // Активируем всех неактивных пользователей
    if (inactiveUsers.length > 0) {
      console.log(`\n⚠️  Найдено ${inactiveUsers.length} неактивных пользователей`);
      console.log('💡 Активирую всех пользователей...');
      
      for (const user of inactiveUsers) {
        user.isActive = true;
        await userRepository.save(user);
      }
      
      console.log('✅ Все пользователи активированы');
    }

    console.log('\n📝 Учетные данные для входа:');
    console.log('='.repeat(80));
    
    // Показываем учетные данные для каждого пользователя
    const testUsers = [
      { email: 'admin@marina-crm.com', password: 'admin123', role: 'SUPER_ADMIN' },
      { email: 'owner@yachtclub.com', password: 'owner123', role: 'CLUB_OWNER' },
      { email: 'vessel@owner.com', password: 'vessel123', role: 'VESSEL_OWNER' },
    ];

    for (const testUser of testUsers) {
      const user = users.find(u => u.email === testUser.email);
      if (user) {
        console.log(`\n${testUser.role}:`);
        console.log(`   Email:    ${testUser.email}`);
        console.log(`   Пароль:   ${testUser.password}`);
        console.log(`   Статус:   ${user.isActive ? '✅ Активен' : '❌ Неактивен'}`);
      }
    }

    await AppDataSource.destroy();
    console.log('\n✅ Проверка завершена!');
  } catch (error) {
    console.error('❌ Ошибка при проверке пользователей:', error);
    process.exit(1);
  }
};

checkUsers();

