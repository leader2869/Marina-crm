import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Payment } from '../../entities/Payment';
import { Booking } from '../../entities/Booking';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { PaymentStatus, PaymentMethod, Currency, BookingStatus } from '../../types';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { isAfter } from 'date-fns';

export class PaymentsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );
      const { clubId, bookingId, status } = req.query;

      const paymentRepository = AppDataSource.getRepository(Payment);
      const queryBuilder = paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.booking', 'booking')
        .leftJoinAndSelect('payment.payer', 'payer')
        .leftJoinAndSelect('booking.club', 'club');

      if (clubId) {
        queryBuilder.where('club.id = :clubId', { clubId: parseInt(clubId as string) });
      }

      if (bookingId) {
        queryBuilder.where('payment.bookingId = :bookingId', { bookingId: parseInt(bookingId as string) });
      }

      if (status) {
        queryBuilder.andWhere('payment.status = :status', { status });
      }

      const [payments, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('payment.dueDate', 'DESC')
        .getManyAndCount();

      res.json(createPaginatedResponse(payments, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const paymentRepository = AppDataSource.getRepository(Payment);
      const payment = await paymentRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['booking', 'payer', 'booking.club'],
      });

      if (!payment) {
        throw new AppError('Платеж не найден', 404);
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
      const { status, transactionId, paidDate } = req.body;

      const paymentRepository = AppDataSource.getRepository(Payment);
      const payment = await paymentRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['booking', 'booking.club'],
      });

      if (!payment) {
        throw new AppError('Платеж не найден', 404);
      }

      // Проверка прав доступа
      if (
        payment.payerId !== req.userId &&
        payment.booking.club.ownerId !== req.userId &&
        req.userRole !== 'super_admin' &&
        req.userRole !== 'admin'
      ) {
        throw new AppError('Недостаточно прав для изменения статуса', 403);
      }

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

      // Если платеж оплачен, обновляем статус бронирования
      if (status === PaymentStatus.PAID) {
        const bookingRepository = AppDataSource.getRepository(Booking);
        const booking = await bookingRepository.findOne({
          where: { id: payment.bookingId },
        });

        if (booking && booking.status === BookingStatus.PENDING) {
          booking.status = BookingStatus.CONFIRMED;
          await bookingRepository.save(booking);
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
      const { clubId } = req.query;

      const paymentRepository = AppDataSource.getRepository(Payment);
      const queryBuilder = paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.booking', 'booking')
        .leftJoinAndSelect('payment.payer', 'payer')
        .leftJoinAndSelect('booking.club', 'club')
        .where('payment.status = :status', { status: PaymentStatus.PENDING })
        .andWhere('payment.dueDate < :today', { today: new Date() });

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



