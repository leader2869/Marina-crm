import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Berth } from '../../entities/Berth';
import { Club } from '../../entities/Club';
import { Booking } from '../../entities/Booking';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { UserRole, BookingStatus } from '../../types';

export class BerthsController {
  // Получить все места клуба
  async getByClub(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { clubId } = req.params;

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(clubId) },
        relations: ['owner'],
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверка прав доступа - владелец клуба может видеть места своего клуба
      if (
        club.ownerId !== req.userId &&
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN
      ) {
        throw new AppError('Недостаточно прав для просмотра мест', 403);
      }

      // Загружаем места с сортировкой по номеру места
      // Сначала места, начинающиеся с текста (алфавитно), потом с числа (от большего к меньшему)
      const berthRepository = AppDataSource.getRepository(Berth);
      const berths = await berthRepository
        .createQueryBuilder('berth')
        .where('berth.clubId = :clubId', { clubId: club.id })
        .orderBy(
          `CASE 
            WHEN berth.number ~ '[0-9]' THEN 
              CAST(
                COALESCE(
                  NULLIF(SUBSTRING(berth.number FROM '[^0-9]*([0-9]+)'), ''),
                  '0'
                ) AS INTEGER
              )
            ELSE 0 
          END`,
          'DESC' // От большего к меньшему по числовому значению
        )
        .addOrderBy('berth.number', 'DESC') // От большего к меньшему по строке
        .getMany();

      res.json(berths);
    } catch (error) {
      next(error);
    }
  }

  // Создать новое место
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { clubId, number, length, width, pricePerDay, notes } = req.body;

      if (!clubId || !number || !length || !width) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(clubId) },
        relations: ['owner'],
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверка прав доступа - владелец клуба может создавать места в своем клубе
      if (
        club.ownerId !== req.userId &&
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN
      ) {
        throw new AppError('Недостаточно прав для создания места', 403);
      }

      // Проверка уникальности номера места в клубе
      const berthRepository = AppDataSource.getRepository(Berth);
      const existingBerth = await berthRepository.findOne({
        where: { clubId: club.id, number: number.toString() },
      });

      if (existingBerth) {
        throw new AppError('Место с таким номером уже существует', 400);
      }

      const berth = berthRepository.create({
        number: number.toString(),
        length: parseFloat(length),
        width: parseFloat(width),
        pricePerDay: pricePerDay ? parseFloat(pricePerDay) : (club.basePrice || null),
        notes: notes || null,
        clubId: club.id,
        isAvailable: true,
      });

      await berthRepository.save(berth);

      // Обновляем количество мест в клубе
      const berthsCount = await berthRepository.count({
        where: { clubId: club.id },
      });
      club.totalBerths = berthsCount;
      await clubRepository.save(club);

      const savedBerth = await berthRepository.findOne({
        where: { id: berth.id },
        relations: ['club'],
      });

      res.status(201).json(savedBerth);
    } catch (error) {
      next(error);
    }
  }

  // Обновить место
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;
      const { number, length, width, pricePerDay, isAvailable, notes } = req.body;

      const berthRepository = AppDataSource.getRepository(Berth);
      const berth = await berthRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club', 'club.owner'],
      });

      if (!berth) {
        throw new AppError('Место не найдено', 404);
      }

      // Проверка прав доступа - владелец клуба может редактировать места своего клуба
      if (
        berth.club.ownerId !== req.userId &&
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN
      ) {
        throw new AppError('Недостаточно прав для редактирования места', 403);
      }

      // Проверка уникальности номера места (если номер изменился)
      if (number !== undefined && number !== berth.number) {
        const existingBerth = await berthRepository.findOne({
          where: { clubId: berth.clubId, number: number.toString() },
        });

        if (existingBerth) {
          throw new AppError('Место с таким номером уже существует', 400);
        }
        berth.number = number.toString();
      }

      // Обновляем поля места
      if (length !== undefined) berth.length = parseFloat(length);
      if (width !== undefined) berth.width = parseFloat(width);
      if (pricePerDay !== undefined) {
        berth.pricePerDay = pricePerDay ? parseFloat(pricePerDay) : null;
      }
      if (isAvailable !== undefined) berth.isAvailable = isAvailable;
      if (notes !== undefined) berth.notes = notes || null;

      await berthRepository.save(berth);

      const updatedBerth = await berthRepository.findOne({
        where: { id: berth.id },
        relations: ['club'],
      });

      res.json(updatedBerth);
    } catch (error) {
      next(error);
    }
  }

  // Удалить место
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;

      const berthRepository = AppDataSource.getRepository(Berth);
      const berth = await berthRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club', 'club.owner'],
      });

      if (!berth) {
        throw new AppError('Место не найдено', 404);
      }

      // Проверка прав доступа - владелец клуба может удалять места своего клуба
      if (
        berth.club.ownerId !== req.userId &&
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN
      ) {
        throw new AppError('Недостаточно прав для удаления места', 403);
      }

      // Проверяем, есть ли активные бронирования на это место
      const bookingRepository = AppDataSource.getRepository(Booking);
      const activeBookings = await bookingRepository.find({
        where: { berthId: berth.id },
      });

      if (activeBookings.length > 0) {
        throw new AppError('Нельзя удалить место с активными бронированиями', 400);
      }

      const clubId = berth.clubId;
      await berthRepository.remove(berth);

      // Обновляем количество мест в клубе
      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: clubId },
      });

      if (club) {
        const berthsCount = await berthRepository.count({
          where: { clubId: club.id },
        });
        club.totalBerths = berthsCount;
        await clubRepository.save(club);
      }

      res.json({ message: 'Место успешно удалено' });
    } catch (error) {
      next(error);
    }
  }

  // Получить доступные места клуба для бронирования (для судовладельца и гостя)
  async getAvailableByClub(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Гость может видеть доступные места без аутентификации
      // Но для бронирования потребуется регистрация
      // Если пользователь не аутентифицирован, считаем его гостем

      const { clubId } = req.params;
      const { startDate, endDate } = req.query;

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(clubId) },
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      if (!club.isActive) {
        throw new AppError('Яхт-клуб неактивен', 400);
      }

      // Получаем все места клуба с тарифами
      const berthRepository = AppDataSource.getRepository(Berth);
      const allBerths = await berthRepository.find({
        where: { clubId: club.id, isAvailable: true },
        relations: ['tariffBerths', 'tariffBerths.tariff'],
        order: {
          number: 'ASC',
        },
      });

      // Фильтруем тарифы по сезону клуба, если сезон указан
      if (club.season) {
        allBerths.forEach(berth => {
          if (berth.tariffBerths) {
            berth.tariffBerths = berth.tariffBerths.filter(tb => 
              tb.tariff && (tb.tariff.season === club.season || !tb.tariff.season)
            )
          }
        })
      }

      // Если указаны даты, проверяем конфликты с бронированиями
      if (startDate && endDate) {
        const bookingRepository = AppDataSource.getRepository(Booking);
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);

        // Получаем все конфликтующие бронирования
        // Включаем PENDING, CONFIRMED и ACTIVE - эти статусы блокируют место
        const conflictingBookings = await bookingRepository
          .createQueryBuilder('booking')
          .where('booking.clubId = :clubId', { clubId: club.id })
          .andWhere('booking.status IN (:...statuses)', {
            statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
          })
          .andWhere(
            '(booking.startDate <= :endDate AND booking.endDate >= :startDate)',
            { startDate: start, endDate: end }
          )
          .getMany();

        // Получаем ID занятых мест
        const occupiedBerthIds = new Set(
          conflictingBookings.map((booking) => booking.berthId)
        );

        // Фильтруем доступные места
        const availableBerths = allBerths.filter(
          (berth) => !occupiedBerthIds.has(berth.id)
        );

        res.json(availableBerths);
      } else {
        // Если даты не указаны, все равно фильтруем места с учетом всех активных бронирований
        const bookingRepository = AppDataSource.getRepository(Booking);
        const activeBookings = await bookingRepository
          .createQueryBuilder('booking')
          .where('booking.clubId = :clubId', { clubId: club.id })
          .andWhere('booking.status IN (:...statuses)', {
            statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
          })
          .getMany();

        const occupiedBerthIds = new Set(activeBookings.map((booking) => booking.berthId));
        const availableBerths = allBerths.filter((berth) => !occupiedBerthIds.has(berth.id));
        res.json(availableBerths);
      }
    } catch (error) {
      next(error);
    }
  }
}

