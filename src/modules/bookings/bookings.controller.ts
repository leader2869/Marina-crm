import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Booking } from '../../entities/Booking';
import { Berth } from '../../entities/Berth';
import { Club } from '../../entities/Club';
import { UserClub } from '../../entities/UserClub';
import { Tariff } from '../../entities/Tariff';
import { BookingRule, BookingRuleType } from '../../entities/BookingRule';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { BookingStatus } from '../../types';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { differenceInDays } from 'date-fns';

export class BookingsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );

      const bookingRepository = AppDataSource.getRepository(Booking);
      const queryBuilder = bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.club', 'club')
        .leftJoinAndSelect('booking.berth', 'berth')
        .leftJoinAndSelect('booking.vessel', 'vessel')
        .leftJoinAndSelect('booking.vesselOwner', 'vesselOwner');

      // Фильтрация по ролям
      console.log(`[Bookings] Getting bookings for user ID ${req.userId} with role ${req.userRole}`);
      
      if (req.userRole === 'vessel_owner') {
        queryBuilder.where('booking.vesselOwnerId = :userId', { userId: req.userId });
      } else if (req.userRole === 'club_owner') {
        // Владелец клуба видит только бронирования своих клубов
        // Получаем ID всех клубов, принадлежащих пользователю
        const clubRepository = AppDataSource.getRepository(Club);
        const userClubs = await clubRepository.find({
          where: { ownerId: req.userId },
          select: ['id'],
        });
        
        console.log(`[Bookings] User ID ${req.userId} (club_owner) has ${userClubs.length} clubs:`, userClubs.map(c => c.id));
        
        if (userClubs.length === 0) {
          // Если у пользователя нет клубов, возвращаем пустой результат
          console.log(`[Bookings] User ID ${req.userId} (club_owner) has no clubs, returning empty result`);
          res.json(createPaginatedResponse([], 0, page, limit));
          return;
        }
        
        const clubIds = userClubs.map(club => club.id);
        console.log(`[Bookings] Filtering bookings for club_owner ${req.userId} by clubIds:`, clubIds);
        queryBuilder.where('booking.clubId IN (:...clubIds)', { clubIds });
      } else if (req.userRole === 'guest') {
        // Гость видит только свои бронирования
        queryBuilder.where('booking.vesselOwnerId = :userId', { userId: req.userId });
      } else if (req.userRole === 'super_admin' || req.userRole === 'admin') {
        // Суперадминистратор и администратор видят все бронирования
        // Не применяем фильтрацию
      } else {
        // Для других ролей или неизвестных ролей - возвращаем пустой результат
        res.json(createPaginatedResponse([], 0, page, limit));
        return;
      }

      const [bookings, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('booking.createdAt', 'DESC')
        .getManyAndCount();

      res.json(createPaginatedResponse(bookings, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  // Получить бронирования клуба (для гостя и других ролей)
  async getByClub(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clubId } = req.params;

      if (!clubId) {
        throw new AppError('ID клуба обязателен', 400);
      }

      const bookingRepository = AppDataSource.getRepository(Booking);
      const bookings = await bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.club', 'club')
        .leftJoinAndSelect('booking.berth', 'berth')
        .leftJoinAndSelect('booking.vessel', 'vessel')
        .leftJoinAndSelect('booking.vesselOwner', 'vesselOwner')
        .where('booking.clubId = :clubId', { clubId: parseInt(clubId) })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
        })
        .orderBy('booking.createdAt', 'DESC')
        .getMany();

      res.json(bookings);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const bookingRepository = AppDataSource.getRepository(Booking);
      const booking = await bookingRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club', 'berth', 'vessel', 'vesselOwner', 'payments'],
      });

      if (!booking) {
        throw new AppError('Бронирование не найдено', 404);
      }

      // Проверка прав доступа
      if (
        booking.vesselOwnerId !== req.userId &&
        req.userRole !== 'super_admin' &&
        req.userRole !== 'admin' &&
        !(req.userRole === 'club_owner' && booking.club?.ownerId === req.userId)
      ) {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      res.json(booking);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { clubId, berthId, vesselId, autoRenewal, tariffId } = req.body;

      if (!clubId || !berthId || !vesselId) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      // Проверка доступности места
      const berthRepository = AppDataSource.getRepository(Berth);
      const berth = await berthRepository.findOne({
        where: { id: berthId },
        relations: ['club'],
      });

      if (!berth) {
        throw new AppError('Место не найдено', 404);
      }

      if (!berth.isAvailable) {
        throw new AppError('Место недоступно', 400);
      }

      // Загружаем клуб с месяцами навигации
      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(clubId) },
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Расчет стоимости и определение дат
      let totalPrice: number;
      let selectedTariff: Tariff | null = null;
      let startDate: Date;
      let endDate: Date;

      if (tariffId) {
        // Если выбран тариф, используем его стоимость
        const tariffRepository = AppDataSource.getRepository(Tariff);
        selectedTariff = await tariffRepository.findOne({
          where: { id: parseInt(tariffId) },
        });

        if (!selectedTariff) {
          throw new AppError('Тариф не найден', 404);
        }

        // Проверяем, что тариф привязан к выбранному месту
        const berthWithTariffs = await berthRepository.findOne({
          where: { id: berthId },
          relations: ['tariffBerths', 'tariffBerths.tariff'],
        });

        const isTariffLinkedToBerth = berthWithTariffs?.tariffBerths?.some(
          (tb) => tb.tariffId === selectedTariff!.id
        );

        if (!isTariffLinkedToBerth) {
          throw new AppError('Выбранный тариф не привязан к этому месту', 400);
        }

        // Для тарифа используем его amount
        if (selectedTariff.type === 'season_payment') {
          // Оплата за весь сезон - используем полную сумму тарифа
          totalPrice = selectedTariff.amount;
          
          // Проверяем правила для сезонной оплаты
          const bookingRuleRepository = AppDataSource.getRepository(BookingRule);
          const rules = await bookingRuleRepository
            .createQueryBuilder('rule')
            .where('rule.clubId = :clubId', { clubId: parseInt(clubId) })
            .andWhere('(rule.tariffId = :tariffId OR rule.tariffId IS NULL)', { tariffId: parseInt(tariffId) })
            .orderBy('rule.createdAt', 'DESC')
            .getMany();

          // Ищем правило REQUIRE_DEPOSIT
          const depositRule = rules.find(
            rule => rule.ruleType === BookingRuleType.REQUIRE_DEPOSIT && 
            (rule.tariffId === parseInt(tariffId) || rule.tariffId === null)
          );

          // Если есть правило REQUIRE_DEPOSIT, добавляем залог к общей сумме
          if (depositRule && depositRule.parameters && depositRule.parameters.depositAmount) {
            const depositAmount = parseFloat(String(depositRule.parameters.depositAmount));
            totalPrice = totalPrice + depositAmount;
          }
          
          // Для сезонной оплаты используем весь период навигации
          const rentalMonths = club.rentalMonths || [];
          if (rentalMonths.length === 0) {
            throw new AppError('Период навигации не установлен для яхт-клуба', 400);
          }
          
          const sortedMonths = [...rentalMonths].sort((a, b) => a - b);
          const seasonYear = club.season || new Date().getFullYear();
          
          // Первый день первого месяца
          startDate = new Date(seasonYear, sortedMonths[0] - 1, 1);
          // Последний день последнего месяца
          const lastMonth = sortedMonths[sortedMonths.length - 1];
          endDate = new Date(seasonYear, lastMonth, 0); // 0 день следующего месяца = последний день текущего месяца
        } else {
          // Помесячная оплата - проверяем правила для тарифа
          const bookingRuleRepository = AppDataSource.getRepository(BookingRule);
          
          // Ищем правила для этого тарифа или общие правила для клуба
          const rules = await bookingRuleRepository
            .createQueryBuilder('rule')
            .where('rule.clubId = :clubId', { clubId: parseInt(clubId) })
            .andWhere('(rule.tariffId = :tariffId OR rule.tariffId IS NULL)', { tariffId: parseInt(tariffId) })
            .orderBy('rule.createdAt', 'DESC')
            .getMany();

          // Ищем правило типа REQUIRE_PAYMENT_MONTHS для этого тарифа
          const paymentRule = rules.find(
            rule => rule.ruleType === BookingRuleType.REQUIRE_PAYMENT_MONTHS && 
            (rule.tariffId === parseInt(tariffId) || rule.tariffId === null)
          );

          // Ищем правило REQUIRE_DEPOSIT
          const depositRule = rules.find(
            rule => rule.ruleType === BookingRuleType.REQUIRE_DEPOSIT && 
            (rule.tariffId === parseInt(tariffId) || rule.tariffId === null)
          );

          const clubRentalMonths = club.rentalMonths || [];
          const tariffMonths = selectedTariff.months || [];
          
          if (clubRentalMonths.length === 0) {
            throw new AppError('Период навигации не установлен для яхт-клуба', 400);
          }
          
          if (tariffMonths.length === 0) {
            throw new AppError('Месяцы не установлены для тарифа', 400);
          }
          
          // Находим пересечение месяцев навигации клуба и месяцев тарифа
          let intersectionMonths = clubRentalMonths.filter(month => tariffMonths.includes(month));
          
          if (intersectionMonths.length === 0) {
            throw new AppError('Нет пересечения между месяцами навигации клуба и месяцами тарифа', 400);
          }
          
          // Если есть правило REQUIRE_PAYMENT_MONTHS, используем месяцы из правила
          if (paymentRule && paymentRule.parameters && paymentRule.parameters.months) {
            const ruleMonths = paymentRule.parameters.months as number[];
            // Берем только те месяцы из правила, которые есть в пересечении
            intersectionMonths = intersectionMonths.filter(month => ruleMonths.includes(month));
            
            if (intersectionMonths.length === 0) {
              throw new AppError('Месяцы из правила не совпадают с доступными месяцами', 400);
            }
          }
          
          // Сортируем месяцы
          const sortedMonths = [...intersectionMonths].sort((a, b) => a - b);
          const seasonYear = club.season || new Date().getFullYear();
          
          // Рассчитываем стоимость: количество месяцев * стоимость за месяц
          totalPrice = selectedTariff.amount * sortedMonths.length;
          
          // Если есть правило REQUIRE_DEPOSIT, добавляем залог к общей сумме
          if (depositRule && depositRule.parameters && depositRule.parameters.depositAmount) {
            const depositAmount = parseFloat(String(depositRule.parameters.depositAmount));
            totalPrice = totalPrice + depositAmount;
          }
          
          // Первый день первого месяца
          startDate = new Date(seasonYear, sortedMonths[0] - 1, 1);
          // Последний день последнего месяца
          const lastMonth = sortedMonths[sortedMonths.length - 1];
          endDate = new Date(seasonYear, lastMonth, 0); // 0 день следующего месяца = последний день текущего месяца
        }
      } else {
        // Если тариф не выбран, используем стандартный расчет по дням
        // Используем весь период навигации
        const rentalMonths = club.rentalMonths || [];
        if (rentalMonths.length === 0) {
          throw new AppError('Период навигации не установлен для яхт-клуба', 400);
        }
        
        const sortedMonths = [...rentalMonths].sort((a, b) => a - b);
        const seasonYear = club.season || new Date().getFullYear();
        
        // Первый день первого месяца
        startDate = new Date(seasonYear, sortedMonths[0] - 1, 1);
        // Последний день последнего месяца
        const lastMonth = sortedMonths[sortedMonths.length - 1];
        endDate = new Date(seasonYear, lastMonth, 0);
        
        const days = differenceInDays(endDate, startDate) + 1;
        const pricePerDay = berth.pricePerDay || berth.club.basePrice;
        totalPrice = days * pricePerDay;
      }

      // Проверка пересечений с другими бронированиями
      const bookingRepository = AppDataSource.getRepository(Booking);
      
      // Проверка конфликтов по месту
      // Включаем PENDING, CONFIRMED и ACTIVE - эти статусы блокируют место
      const conflictingBookingsByBerth = await bookingRepository
        .createQueryBuilder('booking')
        .where('booking.berthId = :berthId', { berthId })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
        })
        .andWhere(
          '(booking.startDate <= :endDate AND booking.endDate >= :startDate)',
          { startDate, endDate }
        )
        .getMany();

      if (conflictingBookingsByBerth.length > 0) {
        throw new AppError('Место уже забронировано на этот период', 400);
      }

      // Проверка: одно судно может быть забронировано только на один период
      // Ищем активные бронирования этого судна на пересекающийся период
      const conflictingBookingsByVessel = await bookingRepository
        .createQueryBuilder('booking')
        .where('booking.vesselId = :vesselId', { vesselId: parseInt(vesselId) })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
        })
        .andWhere(
          '(booking.startDate <= :endDate AND booking.endDate >= :startDate)',
          { startDate, endDate }
        )
        .getMany();

      if (conflictingBookingsByVessel.length > 0) {
        throw new AppError('Это судно уже забронировано на указанный период. Одно судно может иметь только одно активное бронирование на период', 400);
      }

      const booking = bookingRepository.create({
        clubId: parseInt(clubId),
        berthId: parseInt(berthId),
        vesselId: parseInt(vesselId),
        vesselOwnerId: req.userId,
        startDate,
        endDate,
        totalPrice,
        autoRenewal: autoRenewal || false,
        status: BookingStatus.PENDING,
        tariffId: selectedTariff ? selectedTariff.id : null,
      });

      await bookingRepository.save(booking);

      // Автоматически привязываем пользователя к клубу через UserClub
      const userClubRepository = AppDataSource.getRepository(UserClub);
      const existingUserClub = await userClubRepository.findOne({
        where: {
          userId: req.userId,
          clubId: parseInt(clubId),
        },
      });

      if (!existingUserClub) {
        const userClub = userClubRepository.create({
          userId: req.userId,
          clubId: parseInt(clubId),
        });
        await userClubRepository.save(userClub);
      }

      const savedBooking = await bookingRepository.findOne({
        where: { id: booking.id },
        relations: ['club', 'berth', 'vessel', 'vesselOwner'],
      });

      res.status(201).json(savedBooking);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const bookingRepository = AppDataSource.getRepository(Booking);
      const booking = await bookingRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club'],
      });

      if (!booking) {
        throw new AppError('Бронирование не найдено', 404);
      }

      // Проверка прав доступа
      if (
        booking.vesselOwnerId !== req.userId &&
        booking.club.ownerId !== req.userId &&
        req.userRole !== 'super_admin' &&
        req.userRole !== 'admin'
      ) {
        throw new AppError('Недостаточно прав для редактирования', 403);
      }

      Object.assign(booking, req.body);
      await bookingRepository.save(booking);

      const updatedBooking = await bookingRepository.findOne({
        where: { id: booking.id },
        relations: ['club', 'berth', 'vessel', 'vesselOwner'],
      });

      res.json(updatedBooking);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const bookingRepository = AppDataSource.getRepository(Booking);
      const booking = await bookingRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club'],
      });

      if (!booking) {
        throw new AppError('Бронирование не найдено', 404);
      }

      // Проверка прав доступа
      // Владелец клуба может отменять бронирования своего клуба
      const isClubOwner = req.userRole === 'club_owner' && booking.club.ownerId === req.userId;
      const canCancel =
        booking.vesselOwnerId === req.userId ||
        isClubOwner ||
        req.userRole === 'super_admin' ||
        req.userRole === 'admin';

      if (!canCancel) {
        throw new AppError('Недостаточно прав для отмены', 403);
      }

      booking.status = BookingStatus.CANCELLED;
      await bookingRepository.save(booking);

      res.json({ message: 'Бронирование отменено', booking });
    } catch (error) {
      next(error);
    }
  }
}



