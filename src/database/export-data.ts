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
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface ExportData {
  users: any[];
  clubs: any[];
  vessels: any[];
  berths: any[];
  bookings: any[];
  payments: any[];
  incomes: any[];
  expenses: any[];
  budgets: any[];
  expenseCategories: any[];
  tariffs: any[];
  tariffBerths: any[];
  bookingRules: any[];
  userClubs: any[];
}

const exportData = async (): Promise<void> => {
  try {
    // Показываем, к какой БД подключаемся
    if (process.env.DATABASE_URL) {
      const url = process.env.DATABASE_URL;
      const maskedUrl = url.replace(/:[^:@]+@/, ':****@');
      console.log(`📡 Подключение через DATABASE_URL: ${maskedUrl}`);
      
      if (url.includes('supabase.co') || url.includes('pooler.supabase.com')) {
        console.log('   ⚠️  ВНИМАНИЕ: Обнаружено подключение к Supabase!');
        console.log('   💡 Для экспорта данных из локальной БД:');
        console.log('      1. Удалите или закомментируйте DATABASE_URL в .env');
        console.log('      2. Используйте DB_HOST=localhost, DB_PORT=5432 и т.д.');
        console.log('      3. Перезапустите экспорт\n');
      }
    } else {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const database = process.env.DB_NAME || 'marina_crm';
      console.log(`📡 Подключение к: ${host}:${port}/${database}`);
      
      if (host === 'localhost' || host === '127.0.0.1') {
        console.log('   ✅ Локальная база данных\n');
      } else if (host.includes('supabase.co') || host.includes('pooler.supabase.com')) {
        console.log('   ⚠️  ВНИМАНИЕ: Обнаружено подключение к Supabase!');
        console.log('   💡 Для экспорта данных используйте локальную БД\n');
      }
    }

    await AppDataSource.initialize();
    console.log('✅ База данных подключена\n');

    const exportDir = './exports';
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const exportFile = path.join(exportDir, `data_export_${timestamp}.json`);

    console.log('📊 Начинаю экспорт данных...\n');

    // Экспортируем данные из всех таблиц
    const data: ExportData = {
      users: [],
      clubs: [],
      vessels: [],
      berths: [],
      bookings: [],
      payments: [],
      incomes: [],
      expenses: [],
      budgets: [],
      expenseCategories: [],
      tariffs: [],
      tariffBerths: [],
      bookingRules: [],
      userClubs: [],
    };

    // Пользователи
    const userRepository = AppDataSource.getRepository(User);
    data.users = await userRepository.find({
      relations: ['vessels', 'ownedClubs'],
    });
    // Удаляем пароли из экспорта (безопасность)
    data.users = data.users.map(user => ({
      ...user,
      password: '[REDACTED]', // Пароли не экспортируем
    }));
    console.log(`✅ Экспортировано пользователей: ${data.users.length}`);

    // Яхт-клубы
    const clubRepository = AppDataSource.getRepository(Club);
    data.clubs = await clubRepository.find({
      relations: ['owner', 'berths'],
    });
    console.log(`✅ Экспортировано яхт-клубов: ${data.clubs.length}`);

    // Места
    const berthRepository = AppDataSource.getRepository(Berth);
    data.berths = await berthRepository.find({
      relations: ['club'],
    });
    console.log(`✅ Экспортировано мест: ${data.berths.length}`);

    // Судна
    const vesselRepository = AppDataSource.getRepository(Vessel);
    data.vessels = await vesselRepository.find({
      relations: ['owner'],
    });
    console.log(`✅ Экспортировано судов: ${data.vessels.length}`);

    // Бронирования
    const bookingRepository = AppDataSource.getRepository(Booking);
    data.bookings = await bookingRepository.find({
      relations: ['vesselOwner', 'club', 'berth', 'vessel'],
    });
    console.log(`✅ Экспортировано бронирований: ${data.bookings.length}`);

    // Платежи
    const paymentRepository = AppDataSource.getRepository(Payment);
    data.payments = await paymentRepository.find({
      relations: ['booking'],
    });
    console.log(`✅ Экспортировано платежей: ${data.payments.length}`);

    // Доходы
    const incomeRepository = AppDataSource.getRepository(Income);
    data.incomes = await incomeRepository.find({
      relations: ['club'],
    });
    console.log(`✅ Экспортировано доходов: ${data.incomes.length}`);

    // Расходы
    const expenseRepository = AppDataSource.getRepository(Expense);
    data.expenses = await expenseRepository.find({
      relations: ['club', 'category'],
    });
    console.log(`✅ Экспортировано расходов: ${data.expenses.length}`);

    // Бюджеты
    const budgetRepository = AppDataSource.getRepository(Budget);
    data.budgets = await budgetRepository.find({
      relations: ['club'],
    });
    console.log(`✅ Экспортировано бюджетов: ${data.budgets.length}`);

    // Категории расходов
    const categoryRepository = AppDataSource.getRepository(ExpenseCategory);
    data.expenseCategories = await categoryRepository.find();
    console.log(`✅ Экспортировано категорий расходов: ${data.expenseCategories.length}`);

    // Тарифы
    const tariffRepository = AppDataSource.getRepository(Tariff);
    data.tariffs = await tariffRepository.find({
      relations: ['club'],
    });
    console.log(`✅ Экспортировано тарифов: ${data.tariffs.length}`);

    // Связи тарифов и мест
    const tariffBerthRepository = AppDataSource.getRepository(TariffBerth);
    data.tariffBerths = await tariffBerthRepository.find({
      relations: ['tariff', 'berth'],
    });
    console.log(`✅ Экспортировано связей тарифов и мест: ${data.tariffBerths.length}`);

    // Правила бронирования
    const bookingRuleRepository = AppDataSource.getRepository(BookingRule);
    data.bookingRules = await bookingRuleRepository.find({
      relations: ['club', 'tariff'],
    });
    console.log(`✅ Экспортировано правил бронирования: ${data.bookingRules.length}`);

    // Связи пользователей и клубов
    const userClubRepository = AppDataSource.getRepository(UserClub);
    data.userClubs = await userClubRepository.find({
      relations: ['user', 'club'],
    });
    console.log(`✅ Экспортировано связей пользователей и клубов: ${data.userClubs.length}`);

    // Сохраняем данные в JSON файл
    fs.writeFileSync(exportFile, JSON.stringify(data, null, 2), 'utf-8');

    const stats = fs.statSync(exportFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('\n✅ Экспорт данных завершен!');
    console.log(`📁 Файл: ${exportFile}`);
    console.log(`📊 Размер: ${fileSizeMB} MB`);
    console.log(`🕐 Дата экспорта: ${new Date().toLocaleString('ru-RU')}`);

    await AppDataSource.destroy();
  } catch (error: any) {
    console.error('❌ Ошибка при экспорте данных:', error.message || error);
    process.exit(1);
  }
};

exportData();

