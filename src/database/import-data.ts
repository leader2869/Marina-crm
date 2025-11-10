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
import { UserRole } from '../types';
import { hashPassword } from '../utils/password';

dotenv.config();

interface ImportData {
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

const importData = async (importFile: string): Promise<void> => {
  try {
    if (!fs.existsSync(importFile)) {
      console.error(`❌ Файл не найден: ${importFile}`);
      process.exit(1);
    }

    await AppDataSource.initialize();
    console.log('✅ База данных подключена');

    console.log('📊 Начинаю импорт данных...\n');

    // Читаем данные из файла
    const fileContent = fs.readFileSync(importFile, 'utf-8');
    const data: ImportData = JSON.parse(fileContent);

    const userRepository = AppDataSource.getRepository(User);
    const clubRepository = AppDataSource.getRepository(Club);
    const berthRepository = AppDataSource.getRepository(Berth);
    const vesselRepository = AppDataSource.getRepository(Vessel);
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

    // Импортируем в правильном порядке (с учетом зависимостей)

    // 1. Категории расходов (независимые)
    if (data.expenseCategories && data.expenseCategories.length > 0) {
      for (const category of data.expenseCategories) {
        const existing = await categoryRepository.findOne({ where: { id: category.id } });
        if (!existing) {
          await categoryRepository.save(categoryRepository.create(category));
        }
      }
      console.log(`✅ Импортировано категорий расходов: ${data.expenseCategories.length}`);
    }

    // 2. Пользователи (независимые, но нужны для других сущностей)
    const userMap = new Map<number, number>(); // Старый ID -> Новый ID
    let importedUsers = 0;
    let skippedUsers = 0;
    
    if (data.users && data.users.length > 0) {
      for (const userData of data.users) {
        // Проверяем, существует ли пользователь с таким email
        const existing = await userRepository.findOne({ where: { email: userData.email } });
        
        if (existing) {
          // Пользователь уже существует - используем его ID
          userMap.set(userData.id, existing.id);
          skippedUsers++;
          console.log(`   ⚠️  Пользователь ${userData.email} уже существует, используем существующий ID: ${existing.id}`);
          continue;
        }

        // Пользователь не существует - создаем нового
        const user = userRepository.create({
          email: userData.email,
          password: userData.password === '[REDACTED]' 
            ? await hashPassword('temp123') // Временный пароль, нужно будет изменить
            : userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          role: userData.role as UserRole,
          emailVerified: userData.emailVerified,
          isActive: userData.isActive,
          isValidated: userData.isValidated,
        });
        const saved = await userRepository.save(user);
        userMap.set(userData.id, (saved as any).id);
        importedUsers++;
        console.log(`   ✅ Создан пользователь ${userData.email} (ID: ${(saved as any).id})`);
      }
      console.log(`✅ Импортировано пользователей: ${importedUsers} (пропущено: ${skippedUsers}, всего: ${data.users.length})`);
      console.log(`   📊 Маппинг ID: ${userMap.size} пользователей`);
      
      // Показываем маппинг для отладки
      if (userMap.size > 0) {
        console.log('\n   📋 Маппинг старых ID на новые ID:');
        userMap.forEach((newId, oldId) => {
          console.log(`      Старый ID ${oldId} → Новый ID ${newId}`);
        });
      }
    } else {
      console.log('⚠️  В экспорте нет пользователей!');
    }

    // 3. Яхт-клубы (зависят от пользователей)
    const clubMap = new Map<number, number>();
    let importedClubs = 0;
    let skippedClubs = 0;
    
    if (data.clubs && data.clubs.length > 0) {
      console.log(`\n📊 Начинаю импорт ${data.clubs.length} яхт-клубов...`);
      
      for (const clubData of data.clubs) {
        const newOwnerId = userMap.get(clubData.ownerId);
        if (!newOwnerId) {
          console.error(`❌ Пропущен клуб "${clubData.name}" (ID: ${clubData.id}): владелец с ID ${clubData.ownerId} не найден в маппинге`);
          console.error(`   💡 Проверьте, что пользователь с ID ${clubData.ownerId} был импортирован`);
          console.error(`   📋 Доступные маппинги: ${Array.from(userMap.entries()).map(([old, newId]) => `${old}→${newId}`).join(', ')}`);
          skippedClubs++;
          continue;
        }

        // Проверяем, что пользователь существует в БД
        const ownerExists = await userRepository.findOne({ where: { id: newOwnerId } });
        if (!ownerExists) {
          console.error(`❌ Пропущен клуб "${clubData.name}": пользователь с ID ${newOwnerId} не существует в БД`);
          skippedClubs++;
          continue;
        }
        
        // Проверяем, что пользователь активен
        if (!ownerExists.isActive) {
          console.warn(`⚠️  Пользователь с ID ${newOwnerId} (${ownerExists.email}) не активен, но продолжаем создание клуба`);
        }

        // Проверяем, существует ли клуб с таким именем и владельцем
        const existingClub = await clubRepository.findOne({ 
          where: { name: clubData.name, ownerId: newOwnerId } 
        });
        
        if (existingClub) {
          // Клуб уже существует - используем его ID
          clubMap.set(clubData.id, existingClub.id);
          skippedClubs++;
          console.log(`   ⚠️  Клуб "${clubData.name}" уже существует, используем существующий ID: ${existingClub.id}`);
          continue;
        }

        try {
          // Создаем клуб только с нужными полями, исключая связанные объекты
          const club = clubRepository.create({
            name: clubData.name,
            description: clubData.description,
            address: clubData.address,
            latitude: clubData.latitude,
            longitude: clubData.longitude,
            phone: clubData.phone,
            email: clubData.email,
            website: clubData.website,
            logo: clubData.logo,
            totalBerths: clubData.totalBerths,
            minRentalPeriod: clubData.minRentalPeriod,
            maxRentalPeriod: clubData.maxRentalPeriod,
            basePrice: clubData.basePrice,
            minPricePerMonth: clubData.minPricePerMonth,
            season: clubData.season,
            rentalMonths: clubData.rentalMonths,
            bookingRulesText: clubData.bookingRulesText,
            isActive: clubData.isActive,
            isValidated: clubData.isValidated,
            isSubmittedForValidation: clubData.isSubmittedForValidation,
            rejectionComment: clubData.rejectionComment,
            ownerId: newOwnerId,
            // Исключаем id, createdAt, updatedAt, owner, berths и другие связанные объекты
          });
          const saved = await clubRepository.save(club);
          // save() возвращает объект, а не массив
          clubMap.set(clubData.id, (saved as any).id);
          importedClubs++;
          console.log(`   ✅ Создан клуб "${clubData.name}" (ID: ${(saved as any).id}, владелец: ${newOwnerId})`);
        } catch (error: any) {
          console.error(`❌ Ошибка при создании клуба "${clubData.name}": ${error.message}`);
          if (error.message?.includes('foreign key constraint')) {
            console.error(`   💡 Проверьте, что пользователь с ID ${newOwnerId} существует и активен`);
          }
          skippedClubs++;
        }
      }
      console.log(`✅ Импортировано яхт-клубов: ${importedClubs} (пропущено: ${skippedClubs}, всего: ${data.clubs.length})`);
    }

    // 4. Места (зависят от клубов)
    const berthMap = new Map<number, number>();
    let importedBerths = 0;
    let skippedBerths = 0;
    
    if (data.berths && data.berths.length > 0) {
      console.log(`\n📊 Начинаю импорт ${data.berths.length} мест...`);
      
      for (const berthData of data.berths) {
        const newClubId = clubMap.get(berthData.clubId);
        if (!newClubId) {
          console.warn(`⚠️  Пропущено место ${berthData.number}: клуб не найден`);
          skippedBerths++;
          continue;
        }

        // Проверяем, что клуб существует в БД
        const clubExists = await clubRepository.findOne({ where: { id: newClubId } });
        if (!clubExists) {
          console.error(`❌ Пропущено место ${berthData.number}: клуб с ID ${newClubId} не существует в БД`);
          skippedBerths++;
          continue;
        }

        // Проверяем, существует ли место с таким номером и клубом
        const existingBerth = await berthRepository.findOne({ 
          where: { number: berthData.number, clubId: newClubId } 
        });
        
        if (existingBerth) {
          // Место уже существует - используем его ID
          berthMap.set(berthData.id, existingBerth.id);
          skippedBerths++;
          continue;
        }

        try {
          // Создаем место только с нужными полями, исключая связанные объекты
          const berth = berthRepository.create({
            number: berthData.number,
            length: berthData.length,
            width: berthData.width,
            pricePerDay: berthData.pricePerDay,
            isAvailable: berthData.isAvailable !== undefined ? berthData.isAvailable : true,
            notes: berthData.notes,
            clubId: newClubId,
            // Исключаем id, createdAt, updatedAt, club, bookings, tariffBerths и другие связанные объекты
          });
          const saved = await berthRepository.save(berth);
          // save() возвращает объект, а не массив
          berthMap.set(berthData.id, (saved as any).id);
          importedBerths++;
        } catch (error: any) {
          console.error(`❌ Ошибка при создании места ${berthData.number}: ${error.message}`);
          if (error.message?.includes('foreign key constraint')) {
            console.error(`   💡 Проверьте, что клуб с ID ${newClubId} существует и активен`);
          }
          skippedBerths++;
        }
      }
      console.log(`✅ Импортировано мест: ${importedBerths} (пропущено: ${skippedBerths}, всего: ${data.berths.length})`);
    }

    // 5. Судна (зависят от пользователей)
    const vesselMap = new Map<number, number>();
    let importedVessels = 0;
    let skippedVessels = 0;
    
    if (data.vessels && data.vessels.length > 0) {
      console.log(`\n📊 Начинаю импорт ${data.vessels.length} судов...`);
      
      for (const vesselData of data.vessels) {
        const newOwnerId = userMap.get(vesselData.ownerId);
        if (!newOwnerId) {
          console.error(`❌ Пропущено судно "${vesselData.name}" (ID: ${vesselData.id}): владелец с ID ${vesselData.ownerId} не найден в маппинге`);
          skippedVessels++;
          continue;
        }

        // Проверяем, что пользователь существует в БД
        const ownerExists = await userRepository.findOne({ where: { id: newOwnerId } });
        if (!ownerExists) {
          console.error(`❌ Пропущено судно "${vesselData.name}": пользователь с ID ${newOwnerId} не существует в БД`);
          skippedVessels++;
          continue;
        }

        // Проверяем, существует ли судно с таким именем и владельцем
        // Или по регистрационному номеру, если он указан
        let existingVessel = null;
        if (vesselData.registrationNumber) {
          existingVessel = await vesselRepository.findOne({ 
            where: { registrationNumber: vesselData.registrationNumber, ownerId: newOwnerId } 
          });
        }
        if (!existingVessel) {
          existingVessel = await vesselRepository.findOne({ 
            where: { name: vesselData.name, ownerId: newOwnerId } 
          });
        }
        
        if (existingVessel) {
          // Судно уже существует - используем его ID
          vesselMap.set(vesselData.id, existingVessel.id);
          skippedVessels++;
          console.log(`   ⚠️  Судно "${vesselData.name}" уже существует, используем существующий ID: ${existingVessel.id}`);
          continue;
        }

        try {
          // Создаем судно только с нужными полями, исключая связанные объекты
          const vessel = vesselRepository.create({
            name: vesselData.name,
            type: vesselData.type,
            length: vesselData.length,
            width: vesselData.width,
            heightAboveWaterline: vesselData.heightAboveWaterline,
            registrationNumber: vesselData.registrationNumber,
            documentPath: vesselData.documentPath,
            technicalSpecs: vesselData.technicalSpecs,
            photo: vesselData.photo,
            ownerId: newOwnerId,
            // Исключаем id, createdAt, updatedAt, owner, bookings и другие связанные объекты
          });
          const saved = await vesselRepository.save(vessel);
          // save() возвращает объект, а не массив
          vesselMap.set(vesselData.id, (saved as any).id);
          importedVessels++;
          console.log(`   ✅ Создано судно "${vesselData.name}" (ID: ${(saved as any).id}, владелец: ${newOwnerId})`);
        } catch (error: any) {
          console.error(`❌ Ошибка при создании судна "${vesselData.name}": ${error.message}`);
          if (error.message?.includes('foreign key constraint')) {
            console.error(`   💡 Проверьте, что пользователь с ID ${newOwnerId} существует и активен`);
          }
          skippedVessels++;
        }
      }
      console.log(`✅ Импортировано судов: ${importedVessels} (пропущено: ${skippedVessels}, всего: ${data.vessels.length})`);
    }

    // 6. Тарифы (зависят от клубов)
    const tariffMap = new Map<number, number>();
    let importedTariffs = 0;
    let skippedTariffs = 0;
    
    if (data.tariffs && data.tariffs.length > 0) {
      console.log(`\n📊 Начинаю импорт ${data.tariffs.length} тарифов...`);
      
      for (const tariffData of data.tariffs) {
        const newClubId = clubMap.get(tariffData.clubId);
        if (!newClubId) {
          console.warn(`⚠️  Пропущен тариф "${tariffData.name}": клуб не найден`);
          skippedTariffs++;
          continue;
        }

        // Проверяем, что клуб существует в БД
        const clubExists = await clubRepository.findOne({ where: { id: newClubId } });
        if (!clubExists) {
          console.error(`❌ Пропущен тариф "${tariffData.name}": клуб с ID ${newClubId} не существует в БД`);
          skippedTariffs++;
          continue;
        }

        // Проверяем, существует ли тариф с таким именем и клубом
        const existingTariff = await tariffRepository.findOne({ 
          where: { name: tariffData.name, clubId: newClubId } 
        });
        
        if (existingTariff) {
          // Тариф уже существует - используем его ID
          tariffMap.set(tariffData.id, existingTariff.id);
          skippedTariffs++;
          continue;
        }

        try {
          // Создаем тариф только с нужными полями, исключая связанные объекты
          const tariff = tariffRepository.create({
            name: tariffData.name,
            type: tariffData.type,
            amount: tariffData.amount,
            season: tariffData.season,
            months: tariffData.months,
            clubId: newClubId,
            // Исключаем id, createdAt, updatedAt, club, tariffBerths и другие связанные объекты
          });
          const saved = await tariffRepository.save(tariff);
          // save() возвращает объект, а не массив
          tariffMap.set(tariffData.id, (saved as any).id);
          importedTariffs++;
        } catch (error: any) {
          console.error(`❌ Ошибка при создании тарифа "${tariffData.name}": ${error.message}`);
          if (error.message?.includes('foreign key constraint')) {
            console.error(`   💡 Проверьте, что клуб с ID ${newClubId} существует и активен`);
          }
          skippedTariffs++;
        }
      }
      console.log(`✅ Импортировано тарифов: ${importedTariffs} (пропущено: ${skippedTariffs}, всего: ${data.tariffs.length})`);
    }

    // 7. Связи тарифов и мест
    let importedTariffBerths = 0;
    let skippedTariffBerths = 0;
    
    if (data.tariffBerths && data.tariffBerths.length > 0) {
      console.log(`\n📊 Начинаю импорт ${data.tariffBerths.length} связей тарифов и мест...`);
      
      for (const tbData of data.tariffBerths) {
        const newTariffId = tariffMap.get(tbData.tariffId);
        const newBerthId = berthMap.get(tbData.berthId);
        if (!newTariffId || !newBerthId) {
          skippedTariffBerths++;
          continue;
        }

        // Проверяем, существует ли связь тарифа и места
        const existingTariffBerth = await tariffBerthRepository.findOne({
          where: { tariffId: newTariffId, berthId: newBerthId },
        });

        if (existingTariffBerth) {
          // Связь уже существует - пропускаем
          skippedTariffBerths++;
          continue;
        }

        try {
          await tariffBerthRepository.save(tariffBerthRepository.create({
            tariffId: newTariffId,
            berthId: newBerthId,
          }));
          importedTariffBerths++;
        } catch (error: any) {
          console.error(`❌ Ошибка при создании связи тарифа и места: ${error.message}`);
          skippedTariffBerths++;
        }
      }
      console.log(`✅ Импортировано связей тарифов и мест: ${importedTariffBerths} (пропущено: ${skippedTariffBerths}, всего: ${data.tariffBerths.length})`);
    }

    // 8. Правила бронирования
    let importedBookingRules = 0;
    let skippedBookingRules = 0;
    
    if (data.bookingRules && data.bookingRules.length > 0) {
      console.log(`\n📊 Начинаю импорт ${data.bookingRules.length} правил бронирования...`);
      
      for (const ruleData of data.bookingRules) {
        const newClubId = clubMap.get(ruleData.clubId);
        if (!newClubId) {
          console.warn(`⚠️  Пропущено правило бронирования: клуб не найден`);
          skippedBookingRules++;
          continue;
        }

        // Проверяем, что клуб существует в БД
        const clubExists = await clubRepository.findOne({ where: { id: newClubId } });
        if (!clubExists) {
          console.error(`❌ Пропущено правило бронирования: клуб с ID ${newClubId} не существует в БД`);
          skippedBookingRules++;
          continue;
        }

        const newTariffId = ruleData.tariffId ? tariffMap.get(ruleData.tariffId) : null;
        
        // Проверяем, что тариф существует в БД, если указан
        if (newTariffId) {
          const tariffExists = await tariffRepository.findOne({ where: { id: newTariffId } });
          if (!tariffExists) {
            console.warn(`⚠️  Тариф с ID ${newTariffId} не найден, продолжаем без тарифа`);
          }
        }

        try {
          // Создаем правило бронирования только с нужными полями, исключая связанные объекты
          const bookingRule = bookingRuleRepository.create({
            description: ruleData.description,
            ruleType: ruleData.ruleType,
            parameters: ruleData.parameters,
            clubId: newClubId,
            tariffId: newTariffId || null,
            // Исключаем id, createdAt, updatedAt, club, tariff и другие связанные объекты
          });
          await bookingRuleRepository.save(bookingRule);
          importedBookingRules++;
        } catch (error: any) {
          console.error(`❌ Ошибка при создании правила бронирования: ${error.message}`);
          if (error.message?.includes('foreign key constraint')) {
            console.error(`   💡 Проверьте, что клуб с ID ${newClubId} и тариф с ID ${newTariffId || 'null'} существуют`);
          }
          skippedBookingRules++;
        }
      }
      console.log(`✅ Импортировано правил бронирования: ${importedBookingRules} (пропущено: ${skippedBookingRules}, всего: ${data.bookingRules.length})`);
    }

    // 9. Бронирования (зависят от пользователей, клубов, мест, судов)
    let importedBookings = 0;
    let skippedBookings = 0;
    
    if (data.bookings && data.bookings.length > 0) {
      console.log(`\n📊 Начинаю импорт ${data.bookings.length} бронирований...`);
      
      for (const bookingData of data.bookings) {
        const newOwnerId = userMap.get(bookingData.vesselOwnerId);
        const newClubId = clubMap.get(bookingData.clubId);
        const newBerthId = bookingData.berthId ? berthMap.get(bookingData.berthId) : null;
        const newVesselId = bookingData.vesselId ? vesselMap.get(bookingData.vesselId) : null;

        if (!newOwnerId || !newClubId || !newBerthId || !newVesselId) {
          console.warn(`⚠️  Пропущено бронирование: зависимости не найдены`);
          skippedBookings++;
          continue;
        }

        // Проверяем, существует ли бронирование с такими же параметрами
        const existingBooking = await bookingRepository.findOne({
          where: {
            vesselId: newVesselId,
            clubId: newClubId,
            berthId: newBerthId,
            startDate: bookingData.startDate,
            endDate: bookingData.endDate,
          },
        });

        if (existingBooking) {
          // Бронирование уже существует - пропускаем
          skippedBookings++;
          continue;
        }

        try {
          // Создаем бронирование только с нужными полями, исключая связанные объекты
          const booking = bookingRepository.create({
            startDate: bookingData.startDate,
            endDate: bookingData.endDate,
            status: bookingData.status,
            totalPrice: bookingData.totalPrice,
            notes: bookingData.notes,
            contractPath: bookingData.contractPath,
            autoRenewal: bookingData.autoRenewal,
            vesselOwnerId: newOwnerId,
            clubId: newClubId,
            berthId: newBerthId,
            vesselId: newVesselId,
            tariffId: bookingData.tariffId ? tariffMap.get(bookingData.tariffId) || null : null,
            // Исключаем id, createdAt, updatedAt, club, berth, vessel, vesselOwner, tariff и другие связанные объекты
          });
          await bookingRepository.save(booking);
          importedBookings++;
        } catch (error: any) {
          console.error(`❌ Ошибка при создании бронирования: ${error.message}`);
          skippedBookings++;
        }
      }
      console.log(`✅ Импортировано бронирований: ${importedBookings} (пропущено: ${skippedBookings}, всего: ${data.bookings.length})`);
    }

    // 10. Платежи (зависят от бронирований)
    if (data.payments && data.payments.length > 0) {
      console.log(`⚠️  Платежи требуют связи с бронированиями, импорт может быть неполным`);
      // Платежи сложно импортировать без точных ID бронирований
    }

    // 11. Доходы и расходы (зависят от клубов)
    if (data.incomes && data.incomes.length > 0) {
      for (const incomeData of data.incomes) {
        const newClubId = clubMap.get(incomeData.clubId);
        if (!newClubId) continue;

        await incomeRepository.save(incomeRepository.create({
          ...incomeData,
          clubId: newClubId,
          id: undefined,
        }));
      }
      console.log(`✅ Импортировано доходов: ${data.incomes.length}`);
    }

    if (data.expenses && data.expenses.length > 0) {
      for (const expenseData of data.expenses) {
        const newClubId = clubMap.get(expenseData.clubId);
        if (!newClubId) continue;

        await expenseRepository.save(expenseRepository.create({
          ...expenseData,
          clubId: newClubId,
          id: undefined,
        }));
      }
      console.log(`✅ Импортировано расходов: ${data.expenses.length}`);
    }

    // 12. Бюджеты
    if (data.budgets && data.budgets.length > 0) {
      for (const budgetData of data.budgets) {
        const newClubId = clubMap.get(budgetData.clubId);
        if (!newClubId) continue;

        await budgetRepository.save(budgetRepository.create({
          ...budgetData,
          clubId: newClubId,
          id: undefined,
        }));
      }
      console.log(`✅ Импортировано бюджетов: ${data.budgets.length}`);
    }

    // 13. Связи пользователей и клубов
    let importedUserClubs = 0;
    let skippedUserClubs = 0;
    
    if (data.userClubs && data.userClubs.length > 0) {
      console.log(`\n📊 Начинаю импорт ${data.userClubs.length} связей пользователей и клубов...`);
      
      for (const ucData of data.userClubs) {
        const newUserId = userMap.get(ucData.userId);
        const newClubId = clubMap.get(ucData.clubId);
        if (!newUserId || !newClubId) {
          skippedUserClubs++;
          continue;
        }

        // Проверяем, существует ли связь пользователя и клуба
        const existingUserClub = await userClubRepository.findOne({
          where: { userId: newUserId, clubId: newClubId },
        });

        if (existingUserClub) {
          // Связь уже существует - пропускаем
          skippedUserClubs++;
          continue;
        }

        try {
          await userClubRepository.save(userClubRepository.create({
            userId: newUserId,
            clubId: newClubId,
          }));
          importedUserClubs++;
        } catch (error: any) {
          console.error(`❌ Ошибка при создании связи пользователя и клуба: ${error.message}`);
          skippedUserClubs++;
        }
      }
      console.log(`✅ Импортировано связей пользователей и клубов: ${importedUserClubs} (пропущено: ${skippedUserClubs}, всего: ${data.userClubs.length})`);
    }

    console.log('\n✅ Импорт данных завершен!');
    console.log('\n⚠️  ВАЖНО:');
    console.log('   - Пользователи с паролями [REDACTED] имеют временный пароль "temp123"');
    console.log('   - Необходимо изменить пароли для этих пользователей');
    console.log('   - Проверьте все связи и зависимости');

    await AppDataSource.destroy();
  } catch (error: any) {
    console.error('❌ Ошибка при импорте данных:', error.message || error);
    process.exit(1);
  }
};

// Получаем путь к файлу из аргументов командной строки
let importFile = process.argv[2];

if (!importFile) {
  console.error('❌ Укажите путь к файлу для импорта');
  console.error('Использование: npm run import-data <путь_к_файлу>');
  console.error('Пример: npm run import-data ./exports/data_export_2025-11-10T14-30-00.json');
  process.exit(1);
}

// Автоматически добавляем расширение .json, если его нет
if (!importFile.endsWith('.json')) {
  importFile = importFile + '.json';
  console.log(`📝 Добавлено расширение .json: ${importFile}`);
}

importData(importFile);

