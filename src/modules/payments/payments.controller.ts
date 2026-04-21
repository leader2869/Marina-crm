import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Payment } from '../../entities/Payment';
import { Booking } from '../../entities/Booking';
import { Club } from '../../entities/Club';
import { ClubCashTransaction } from '../../entities/ClubCashTransaction';
import { ClubPartner } from '../../entities/ClubPartner';
import { ClubPartnerManager } from '../../entities/ClubPartnerManager';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import {
  PaymentStatus,
  PaymentMethod,
  Currency,
  BookingStatus,
  UserRole,
  CashPaymentMethod,
  CashTransactionType,
} from '../../types';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { isAfter } from 'date-fns';
import { PaymentService } from '../../services/payment.service';
import { getClubIdsForStaffUser, userHasAccessToClub } from '../../utils/clubStaffAccess';

export class PaymentsController {
  /** Просмотр/приём оплат по клубу: владелец, сотрудник клуба (привязка), админы */
  private async assertClubPaymentAccess(req: AuthRequest, clubId: number): Promise<void> {
    if (!req.userId) {
      throw new AppError('Требуется аутентификация', 401);
    }
    if (req.userRole === UserRole.SUPER_ADMIN || req.userRole === UserRole.ADMIN) {
      return;
    }
    if (req.userRole === UserRole.CLUB_OWNER) {
      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({ where: { id: clubId }, select: ['id', 'ownerId'] });
      if (club?.ownerId !== req.userId) {
        throw new AppError('Доступ запрещен', 403);
      }
      return;
    }
    if (req.userRole === UserRole.CLUB_STAFF) {
      const ok = await userHasAccessToClub(req.userId, clubId);
      if (!ok) {
        throw new AppError('Доступ запрещен', 403);
      }
      return;
    }
    throw new AppError('Доступ запрещен', 403);
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );
      const { clubId, bookingId, status } = req.query;

      const paymentRepository = AppDataSource.getRepository(Payment);
      const queryBuilder = paymentRepository
        .createQueryBuilder('payment')
        .innerJoinAndSelect('payment.booking', 'booking')
        .leftJoinAndSelect('payment.payer', 'payer')
        .innerJoinAndSelect('booking.club', 'club');

      // Фильтрация по ролям - применяется первой и всегда
      if (req.userRole === UserRole.VESSEL_OWNER) {
        // Судовладелец видит только платежи своих бронирований
        queryBuilder.where('booking.vesselOwnerId = :vesselOwnerId', { vesselOwnerId: req.userId });
      } else if (req.userRole === UserRole.CLUB_OWNER) {
        // Владелец клуба видит только платежи своих клубов
        const clubRepository = AppDataSource.getRepository(Club);
        const userClubs = await clubRepository.find({
          where: { ownerId: req.userId },
          select: ['id'],
        });
        
        if (userClubs.length === 0) {
          // Если у пользователя нет клубов, возвращаем пустой результат
          res.json(createPaginatedResponse([], 0, page, limit));
          return;
        }
        
        const clubIds = userClubs.map(club => club.id);
        queryBuilder.where('club.id IN (:...clubIds)', { clubIds });
      } else if (req.userRole === UserRole.CLUB_STAFF && req.userId) {
        const clubIds = await getClubIdsForStaffUser(req.userId);
        if (clubIds.length === 0) {
          res.json(createPaginatedResponse([], 0, page, limit));
          return;
        }
        queryBuilder.where('club.id IN (:...clubIds)', { clubIds });
      } else if (req.userRole !== UserRole.SUPER_ADMIN && req.userRole !== UserRole.ADMIN) {
        // Для других ролей (guest и т.д.) показываем только свои платежи
        queryBuilder.where('payment.payerId = :payerId', { payerId: req.userId });
      }
      // Для SUPER_ADMIN и ADMIN показываем все платежи без дополнительной фильтрации

      // Дополнительные фильтры применяются через andWhere
      if (clubId) {
        queryBuilder.andWhere('club.id = :clubId', { clubId: parseInt(clubId as string) });
      }

      if (bookingId) {
        queryBuilder.andWhere('payment.bookingId = :bookingId', { bookingId: parseInt(bookingId as string) });
      }

      if (status) {
        queryBuilder.andWhere('payment.status = :status', { status });
      }

      const [payments, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('payment.dueDate', 'ASC') // Сначала ближайший платеж, в конце последний
        .getManyAndCount();

      res.json(createPaginatedResponse(payments, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;

      const paymentRepository = AppDataSource.getRepository(Payment);
      const payment = await paymentRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['booking', 'payer', 'booking.club'],
      });

      if (!payment) {
        throw new AppError('Платеж не найден', 404);
      }

      // Проверка прав доступа
      if (req.userRole === UserRole.VESSEL_OWNER) {
        if (payment.booking.vesselOwnerId !== req.userId) {
          throw new AppError('Доступ запрещен', 403);
        }
      } else if (req.userRole === UserRole.CLUB_OWNER) {
        if (payment.booking.club.ownerId !== req.userId) {
          throw new AppError('Доступ запрещен', 403);
        }
      } else if (req.userRole === UserRole.CLUB_STAFF && req.userId) {
        const ok = await userHasAccessToClub(req.userId, payment.booking.clubId);
        if (!ok) {
          throw new AppError('Доступ запрещен', 403);
        }
      } else if (req.userRole !== UserRole.SUPER_ADMIN && req.userRole !== UserRole.ADMIN) {
        if (payment.payerId !== req.userId) {
          throw new AppError('Доступ запрещен', 403);
        }
      }

      res.json(payment);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { bookingId, amount, currency, method, dueDate, notes } = req.body;

      if (!bookingId || !amount || !method || !dueDate) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      // Проверка бронирования
      const bookingRepository = AppDataSource.getRepository(Booking);
      const booking = await bookingRepository.findOne({
        where: { id: parseInt(bookingId) },
        relations: ['club'],
      });

      if (!booking) {
        throw new AppError('Бронирование не найдено', 404);
      }

      const paymentRepository = AppDataSource.getRepository(Payment);
      const payment = paymentRepository.create({
        bookingId: parseInt(bookingId),
        payerId: req.userId,
        amount: parseFloat(amount),
        currency: (currency as Currency) || Currency.RUB,
        method: method as PaymentMethod,
        dueDate: new Date(dueDate),
        status: PaymentStatus.PENDING,
        notes,
      });

      await paymentRepository.save(payment);

      const savedPayment = await paymentRepository.findOne({
        where: { id: payment.id },
        relations: ['booking', 'payer'],
      });

      res.status(201).json(savedPayment);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, transactionId, paidDate, cashPaymentMethod, acceptedByPartnerId, acceptedByManagerId } = req.body;

      const paymentRepository = AppDataSource.getRepository(Payment);
      const payment = await paymentRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['booking', 'booking.club'],
      });

      if (!payment) {
        throw new AppError('Платеж не найден', 404);
      }

      // Проверка прав доступа
      if (req.userRole === UserRole.VESSEL_OWNER) {
        // Судовладелец может изменять статус только своих платежей
        if (payment.booking.vesselOwnerId !== req.userId) {
          throw new AppError('Недостаточно прав для изменения статуса', 403);
        }
      } else if (req.userRole === UserRole.CLUB_OWNER) {
        // Владелец клуба может изменять статус платежей своих клубов
        if (payment.booking.club.ownerId !== req.userId) {
          throw new AppError('Недостаточно прав для изменения статуса', 403);
        }
      } else if (req.userRole === UserRole.CLUB_STAFF && req.userId) {
        const ok = await userHasAccessToClub(req.userId, payment.booking.clubId);
        if (!ok) {
          throw new AppError('Недостаточно прав для изменения статуса', 403);
        }
      } else if (req.userRole !== UserRole.SUPER_ADMIN && req.userRole !== UserRole.ADMIN) {
        // Для других ролей - только свои платежи
        if (payment.payerId !== req.userId) {
          throw new AppError('Недостаточно прав для изменения статуса', 403);
        }
      }

      const previousStatus = payment.status;
      payment.status = status as PaymentStatus;
      if (transactionId) {
        payment.transactionId = transactionId;
      }
      if (paidDate) {
        payment.paidDate = new Date(paidDate);
      }

      // Начисление пени за просрочку
      if (status === PaymentStatus.OVERDUE && isAfter(new Date(), payment.dueDate)) {
        const daysOverdue = Math.floor(
          (new Date().getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        // Пример: 0.5% за каждый день просрочки
        payment.penalty = payment.amount * 0.005 * daysOverdue;
      }

      await paymentRepository.save(payment);

      // При приеме оплаты владельцем клуба автоматически фиксируем приход в кассе клуба
      if (
        status === PaymentStatus.PAID &&
        previousStatus !== PaymentStatus.PAID &&
        (req.userRole === UserRole.CLUB_OWNER || req.userRole === UserRole.CLUB_STAFF)
      ) {
        if (req.userRole === UserRole.CLUB_STAFF && req.userId) {
          await this.assertClubPaymentAccess(req, payment.booking.clubId);
        }
        const normalizedAcceptedByPartnerId = Number(acceptedByPartnerId);
        if (!Number.isInteger(normalizedAcceptedByPartnerId) || normalizedAcceptedByPartnerId <= 0) {
          throw new AppError('Укажите партнера, который принял оплату', 400);
        }

        if (
          cashPaymentMethod !== CashPaymentMethod.CASH &&
          cashPaymentMethod !== CashPaymentMethod.NON_CASH
        ) {
          throw new AppError('Укажите способ оплаты: наличные или безналичные', 400);
        }

        const partnerRepository = AppDataSource.getRepository(ClubPartner);
        const acceptedPartner = await partnerRepository.findOne({
          where: {
            id: normalizedAcceptedByPartnerId,
            clubId: payment.booking.clubId,
            isActive: true,
          },
        });
        if (!acceptedPartner) {
          throw new AppError('Партнер, принявший оплату, не найден', 404);
        }

        const normalizedAcceptedByManagerId = Number(acceptedByManagerId);
        if (!Number.isInteger(normalizedAcceptedByManagerId) || normalizedAcceptedByManagerId <= 0) {
          throw new AppError('Укажите менеджера, который принял оплату', 400);
        }

        const managerRepository = AppDataSource.getRepository(ClubPartnerManager);
        const acceptedManager = await managerRepository.findOne({
          where: {
            id: normalizedAcceptedByManagerId,
            clubId: payment.booking.clubId,
            partnerId: normalizedAcceptedByPartnerId,
            isActive: true,
          },
        });
        if (!acceptedManager) {
          throw new AppError('Менеджер не найден у выбранного партнера', 404);
        }

        const cashTxRepository = AppDataSource.getRepository(ClubCashTransaction);
        const cashTx = cashTxRepository.create({
          clubId: payment.booking.clubId,
          bookingId: payment.bookingId,
          transactionType: CashTransactionType.INCOME,
          amount: Number(payment.amount),
          currency: payment.currency || Currency.RUB,
          paymentMethod: cashPaymentMethod as CashPaymentMethod,
          date: payment.paidDate || new Date(),
          description: `Поступление по бронированию #${payment.bookingId}, платеж #${payment.id}`,
          acceptedByPartnerId: normalizedAcceptedByPartnerId,
          acceptedByManagerId: normalizedAcceptedByManagerId,
          paidByPartnerId: null,
          createdById: req.userId || null,
        });
        await cashTxRepository.save(cashTx);
      }

      // Если платеж оплачен, проверяем, нужно ли подтверждать бронирование
      if (status === PaymentStatus.PAID) {
        const bookingRepository = AppDataSource.getRepository(Booking);
        const booking = await bookingRepository.findOne({
          where: { id: payment.bookingId },
        });

        if (booking && booking.status === BookingStatus.PENDING) {
          // Проверяем, все ли обязательные платежи оплачены
          const areRequiredPaid = await PaymentService.areRequiredPaymentsPaid(booking.id);
          
          if (areRequiredPaid) {
            booking.status = BookingStatus.CONFIRMED;
            await bookingRepository.save(booking);
          }
        }
      }

      const updatedPayment = await paymentRepository.findOne({
        where: { id: payment.id },
        relations: ['booking', 'payer'],
      });

      res.json(updatedPayment);
    } catch (error) {
      next(error);
    }
  }

  async getOverduePayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { clubId } = req.query;

      const paymentRepository = AppDataSource.getRepository(Payment);
      const queryBuilder = paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.booking', 'booking')
        .leftJoinAndSelect('payment.payer', 'payer')
        .leftJoinAndSelect('booking.club', 'club')
        .where('payment.status = :status', { status: PaymentStatus.PENDING })
        .andWhere('payment.dueDate < :today', { today: new Date() });

      // Фильтрация по ролям
      if (req.userRole === UserRole.VESSEL_OWNER) {
        // Судовладелец видит только просроченные платежи своих бронирований
        queryBuilder.andWhere('booking.vesselOwnerId = :userId', { userId: req.userId });
      } else if (req.userRole === UserRole.CLUB_OWNER) {
        // Владелец клуба видит только просроченные платежи своих клубов
        const clubRepository = AppDataSource.getRepository(Club);
        const userClubs = await clubRepository.find({
          where: { ownerId: req.userId },
          select: ['id'],
        });
        
        if (userClubs.length === 0) {
          res.json([]);
          return;
        }
        
        const clubIds = userClubs.map(club => club.id);
        queryBuilder.andWhere('club.id IN (:...clubIds)', { clubIds });
      } else if (req.userRole === UserRole.CLUB_STAFF && req.userId) {
        const clubIds = await getClubIdsForStaffUser(req.userId);
        if (clubIds.length === 0) {
          res.json([]);
          return;
        }
        queryBuilder.andWhere('club.id IN (:...clubIds)', { clubIds });
      } else if (req.userRole !== UserRole.SUPER_ADMIN && req.userRole !== UserRole.ADMIN) {
        // Для других ролей показываем только свои просроченные платежи
        queryBuilder.andWhere('payment.payerId = :userId', { userId: req.userId });
      }

      if (clubId) {
        queryBuilder.andWhere('club.id = :clubId', { clubId: parseInt(clubId as string) });
      }

      const overduePayments = await queryBuilder.getMany();

      // Обновляем статус просроченных платежей
      for (const payment of overduePayments) {
        if (payment.status !== PaymentStatus.OVERDUE) {
          payment.status = PaymentStatus.OVERDUE;
          const daysOverdue = Math.floor(
            (new Date().getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          payment.penalty = payment.amount * 0.005 * daysOverdue;
          await paymentRepository.save(payment);
        }
      }

      res.json(overduePayments);
    } catch (error) {
      next(error);
    }
  }
}



