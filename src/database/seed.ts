import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Club } from '../entities/Club';
import { Berth } from '../entities/Berth';
import { Vessel } from '../entities/Vessel';
import { ExpenseCategory } from '../entities/ExpenseCategory';
import { UserRole, ExpenseType } from '../types';
import { hashPassword } from '../utils/password';

// Загружаем переменные окружения из .env файла
dotenv.config();

const seed = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    const userRepository = AppDataSource.getRepository(User);
    const clubRepository = AppDataSource.getRepository(Club);
    const berthRepository = AppDataSource.getRepository(Berth);
    const vesselRepository = AppDataSource.getRepository(Vessel);
    const categoryRepository = AppDataSource.getRepository(ExpenseCategory);

    // Создание суперадминистратора
    const superAdmin = userRepository.create({
      email: 'admin@marina-crm.com',
      password: await hashPassword('admin123'),
      firstName: 'Суперадминистратор',
      lastName: 'Системы',
      role: UserRole.SUPER_ADMIN,
      emailVerified: true,
      isActive: true,
    });
    await userRepository.save(superAdmin);
    console.log('✅ Создан суперадминистратор');

    // Создание владельца клуба
    const clubOwner = userRepository.create({
      email: 'owner@yachtclub.com',
      password: await hashPassword('owner123'),
      firstName: 'Иван',
      lastName: 'Петров',
      role: UserRole.CLUB_OWNER,
      emailVerified: true,
      isActive: true,
    });
    await userRepository.save(clubOwner);
    console.log('✅ Создан владелец клуба');

    // Создание судовладельца
    const vesselOwner = userRepository.create({
      email: 'vessel@owner.com',
      password: await hashPassword('vessel123'),
      firstName: 'Алексей',
      lastName: 'Сидоров',
      role: UserRole.VESSEL_OWNER,
      emailVerified: true,
      isActive: true,
    });
    await userRepository.save(vesselOwner);
    console.log('✅ Создан судовладелец');

    // Создание яхт-клуба
    const club = clubRepository.create({
      name: 'Премиум Яхт-Клуб',
      description: 'Элитный яхт-клуб с современной инфраструктурой',
      address: 'г. Сочи, ул. Приморская, 1',
      latitude: 43.5855,
      longitude: 39.7231,
      phone: '+7 (862) 123-45-67',
      email: 'info@premium-yachtclub.ru',
      website: 'https://premium-yachtclub.ru',
      totalBerths: 50,
      minRentalPeriod: 7,
      maxRentalPeriod: 365,
      basePrice: 5000,
      ownerId: clubOwner.id,
      isActive: true,
    });
    await clubRepository.save(club);
    console.log('✅ Создан яхт-клуб');

    // Создание причалов
    const berths = [];
    for (let i = 1; i <= 50; i++) {
      const berth = berthRepository.create({
        number: `${i}`,
        length: 15 + Math.random() * 10, // 15-25 метров
        width: 5,
        pricePerDay: 5000 + Math.random() * 2000, // 5000-7000 рублей
        clubId: club.id,
        isAvailable: true,
      });
      berths.push(berth);
    }
    await berthRepository.save(berths);
    console.log('✅ Создано 50 причалов');

    // Создание судна
    const vessel = vesselRepository.create({
      name: 'Морская Звезда',
      type: 'Яхта',
      length: 18.5,
      width: 4.2,
      registrationNumber: 'RU-12345',
      ownerId: vesselOwner.id,
    });
    await vesselRepository.save(vessel);
    console.log('✅ Создано судно');

    // Создание категорий расходов
    const expenseCategories = [
      {
        name: 'Заработная плата персонала',
        description: 'Выплаты сотрудникам',
        type: ExpenseType.SALARY,
        icon: 'users',
        color: '#3B82F6',
      },
      {
        name: 'Коммунальные услуги',
        description: 'Электричество, вода, отопление',
        type: ExpenseType.UTILITIES,
        icon: 'zap',
        color: '#F59E0B',
      },
      {
        name: 'Налоги и сборы',
        description: 'Налоговые платежи',
        type: ExpenseType.TAXES,
        icon: 'file-text',
        color: '#EF4444',
      },
      {
        name: 'Ремонт и обслуживание',
        description: 'Ремонтные работы и техническое обслуживание',
        type: ExpenseType.MAINTENANCE,
        icon: 'tool',
        color: '#8B5CF6',
      },
      {
        name: 'Маркетинг и реклама',
        description: 'Рекламные кампании и маркетинг',
        type: ExpenseType.MARKETING,
        icon: 'megaphone',
        color: '#10B981',
      },
      {
        name: 'Аренда и лизинги',
        description: 'Арендные платежи',
        type: ExpenseType.RENT,
        icon: 'home',
        color: '#6366F1',
      },
      {
        name: 'Хозяйственные расходы',
        description: 'Хозяйственные нужды',
        type: ExpenseType.SUPPLIES,
        icon: 'shopping-cart',
        color: '#EC4899',
      },
    ];

    for (const categoryData of expenseCategories) {
      const category = categoryRepository.create(categoryData);
      await categoryRepository.save(category);
    }
    console.log('✅ Созданы категории расходов');

    console.log('\n🎉 Seed данные успешно созданы!');
    console.log('\n📝 Учетные данные:');
    console.log('Суперадминистратор: admin@marina-crm.com / admin123');
    console.log('Владелец клуба: owner@yachtclub.com / owner123');
    console.log('Судовладелец: vessel@owner.com / vessel123');

    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Ошибка при создании seed данных:', error);
    process.exit(1);
  }
};

seed();


