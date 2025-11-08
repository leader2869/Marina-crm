import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Booking } from '../../entities/Booking';
import { Berth } from '../../entities/Berth';
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
      if (req.userRole === 'vessel_owner') {
        queryBuilder.where('booking.vesselOwnerId = :userId', { userId: req.userId });
      } else if (req.userRole === 'club_owner') {
        queryBuilder.where('club.ownerId = :userId', { userId: req.userId });
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
        req.userRole !== 'admin'
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

      const { clubId, berthId, vesselId, startDate, endDate, autoRenewal } = req.body;

      if (!clubId || !berthId || !vesselId || !startDate || !endDate) {
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

      // Проверка пересечений с другими бронированиями
      const bookingRepository = AppDataSource.getRepository(Booking);
      const conflictingBookings = await bookingRepository
        .createQueryBuilder('booking')
        .where('booking.berthId = :berthId', { berthId })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
        })
        .andWhere(
          '(booking.startDate <= :endDate AND booking.endDate >= :startDate)',
          { startDate, endDate }
        )
        .getMany();

      if (conflictingBookings.length > 0) {
        throw new AppError('Место уже забронировано на этот период', 400);
      }

      // Расчет стоимости
      const days = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
      const pricePerDay = berth.pricePerDay || berth.club.basePrice;
      const totalPrice = days * pricePerDay;

      const booking = bookingRepository.create({
        clubId: parseInt(clubId),
        berthId: parseInt(berthId),
        vesselId: parseInt(vesselId),
        vesselOwnerId: req.userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalPrice,
        autoRenewal: autoRenewal || false,
        status: BookingStatus.PENDING,
      });

      await bookingRepository.save(booking);

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
      });

      if (!booking) {
        throw new AppError('Бронирование не найдено', 404);
      }

      // Проверка прав доступа
      if (
        booking.vesselOwnerId !== req.userId &&
        req.userRole !== 'super_admin' &&
        req.userRole !== 'admin'
      ) {
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


