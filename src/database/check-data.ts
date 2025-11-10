import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Club } from '../entities/Club';
import { Vessel } from '../entities/Vessel';
import { Berth } from '../entities/Berth';
import { Booking } from '../entities/Booking';
import { Payment } from '../entities/Payment';
import { Income } from '../entities/Income';
import { Expense } from '../entities/Expense';
import { Budget } from '../entities/Budget';
import { ExpenseCategory } from '../entities/ExpenseCategory';
import { Tariff } from '../entities/Tariff';
import { TariffBerth } from '../entities/TariffBerth';
import { BookingRule } from '../entities/BookingRule';
import { UserClub } from '../entities/UserClub';

dotenv.config();

const checkData = async (): Promise<void> => {
  try {
    console.log('🔍 Проверка подключения и данных в базе...\n');

    // Показываем, к какой БД подключаемся
    if (process.env.DATABASE_URL) {
      const url = process.env.DATABASE_URL;
      const maskedUrl = url.replace(/:[^:@]+@/, ':****@');
      console.log(`📡 Подключение через DATABASE_URL: ${maskedUrl}`);
      
      if (url.includes('supabase.co') || url.includes('pooler.supabase.com')) {
        console.log('   ⚠️  Обнаружено подключение к Supabase');
        console.log('   💡 Для экспорта данных используйте локальную БД');
      }
    } else {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const database = process.env.DB_NAME || 'marina_crm';
      console.log(`📡 Подключение к: ${host}:${port}/${database}`);
      
      if (host === 'localhost' || host === '127.0.0.1') {
        console.log('   ✅ Локальная база данных');
      } else if (host.includes('supabase.co') || host.includes('pooler.supabase.com')) {
        console.log('   ⚠️  Обнаружено подключение к Supabase');
        console.log('   💡 Для экспорта данных используйте локальную БД');
      }
    }

    console.log('');

    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    // Проверяем количество записей в каждой таблице
    const userRepository = AppDataSource.getRepository(User);
    const clubRepository = AppDataSource.getRepository(Club);
    const vesselRepository = AppDataSource.getRepository(Vessel);
    const berthRepository = AppDataSource.getRepository(Berth);
    const bookingRepository = AppDataSource.getRepository(Booking);
    const paymentRepository = AppDataSource.getRepository(Payment);
    const incomeRepository = AppDataSource.getRepository(Income);
    const expenseRepository = AppDataSource.getRepository(Expense);
    const budgetRepository = AppDataSource.getRepository(Budget);
    const categoryRepository = AppDataSource.getRepository(ExpenseCategory);
    const tariffRepository = AppDataSource.getRepository(Tariff);
    const tariffBerthRepository = AppDataSource.getRepository(TariffBerth);
    const bookingRuleRepository = AppDataSource.getRepository(BookingRule);
    const userClubRepository = AppDataSource.getRepository(UserClub);

    const counts = {
      users: await userRepository.count(),
      clubs: await clubRepository.count(),
      vessels: await vesselRepository.count(),
      berths: await berthRepository.count(),
      bookings: await bookingRepository.count(),
      payments: await paymentRepository.count(),
      incomes: await incomeRepository.count(),
      expenses: await expenseRepository.count(),
      budgets: await budgetRepository.count(),
      expenseCategories: await categoryRepository.count(),
      tariffs: await tariffRepository.count(),
      tariffBerths: await tariffBerthRepository.count(),
      bookingRules: await bookingRuleRepository.count(),
      userClubs: await userClubRepository.count(),
    };

    console.log('📊 Количество записей в таблицах:');
    console.log(`   👥 Пользователи: ${counts.users}`);
    console.log(`   🏢 Яхт-клубы: ${counts.clubs}`);
    console.log(`   🚢 Судна: ${counts.vessels}`);
    console.log(`   ⚓ Места: ${counts.berths}`);
    console.log(`   📅 Бронирования: ${counts.bookings}`);
    console.log(`   💳 Платежи: ${counts.payments}`);
    console.log(`   💰 Доходы: ${counts.incomes}`);
    console.log(`   💸 Расходы: ${counts.expenses}`);
    console.log(`   📊 Бюджеты: ${counts.budgets}`);
    console.log(`   📁 Категории расходов: ${counts.expenseCategories}`);
    console.log(`   💵 Тарифы: ${counts.tariffs}`);
    console.log(`   🔗 Связи тарифов и мест: ${counts.tariffBerths}`);
    console.log(`   📋 Правила бронирования: ${counts.bookingRules}`);
    console.log(`   👤 Связи пользователей и клубов: ${counts.userClubs}`);

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    console.log(`\n📈 Всего записей: ${total}`);

    if (total === 0) {
      console.log('\n⚠️  В базе данных нет данных!');
      console.log('💡 Для создания тестовых данных запустите:');
      console.log('   npm run seed');
    } else {
      console.log('\n✅ В базе данных есть данные для экспорта');
    }

    await AppDataSource.destroy();
  } catch (error: any) {
    console.error('❌ Ошибка при проверке данных:', error.message || error);
    if (error.message?.includes('ENOTFOUND') || error.message?.includes('ENODATA')) {
      console.error('\n💡 Возможные причины:');
      console.error('   1. Неправильный хост в .env файле');
      console.error('   2. База данных не запущена (для локальной БД)');
      console.error('   3. Проект Supabase приостановлен или удален');
    }
    process.exit(1);
  }
};

checkData();

