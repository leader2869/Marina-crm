import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Club } from '../../entities/Club';
import { Berth } from '../../entities/Berth';
import { Booking } from '../../entities/Booking';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { UserRole } from '../../types';

export class ClubsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );
      const { location, minPrice, maxPrice, available } = req.query;

      const clubRepository = AppDataSource.getRepository(Club);
      const queryBuilder = clubRepository
        .createQueryBuilder('club')
        .leftJoinAndSelect('club.owner', 'owner')
        .where('club.isActive = :isActive', { isActive: true });

      // Фильтры
      if (location) {
        queryBuilder.andWhere(
          '(club.address ILIKE :location OR club.name ILIKE :location)',
          { location: `%${location}%` }
        );
      }

      if (minPrice) {
        queryBuilder.andWhere('club.basePrice >= :minPrice', {
          minPrice: parseFloat(minPrice as string),
        });
      }

      if (maxPrice) {
        queryBuilder.andWhere('club.basePrice <= :maxPrice', {
          maxPrice: parseFloat(maxPrice as string),
        });
      }

      if (available === 'true') {
        queryBuilder.andWhere('club.totalBerths > 0');
      }

      const [clubs, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      res.json(createPaginatedResponse(clubs, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['owner', 'managers'],
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Загружаем места с сортировкой по номеру места
      // Сначала места, начинающиеся с текста (алфавитно), потом с числа (по возрастанию)
      const berthRepository = AppDataSource.getRepository(Berth);
      const berths = await berthRepository
        .createQueryBuilder('berth')
        .where('berth.clubId = :clubId', { clubId: club.id })
        .orderBy(
          `CASE WHEN berth.number ~ '^[^0-9]' THEN 0 ELSE 1 END`,
          'ASC'
        )
        .addOrderBy(
          `CASE WHEN berth.number ~ '^[0-9]' THEN CAST(SUBSTRING(berth.number FROM '^([0-9]+)') AS INTEGER) ELSE 0 END`,
          'ASC'
        )
        .addOrderBy('berth.number', 'ASC')
        .getMany();

      // Добавляем отсортированные места к клубу
      club.berths = berths;

      res.json(club);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const {
        name,
        description,
        address,
        latitude,
        longitude,
        phone,
        email,
        website,
        totalBerths,
        minRentalPeriod,
        maxRentalPeriod,
        basePrice,
        minPricePerMonth,
      } = req.body;

      if (!name || !address || !latitude || !longitude) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      const clubRepository = AppDataSource.getRepository(Club);
      const club = clubRepository.create({
        name,
        description,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        phone,
        email,
        website,
        totalBerths: totalBerths || 0,
        minRentalPeriod: minRentalPeriod || 1,
        maxRentalPeriod: maxRentalPeriod || 365,
        basePrice: basePrice || 0,
        minPricePerMonth: minPricePerMonth ? parseFloat(minPricePerMonth) : null,
        ownerId: req.userId,
      });

      await clubRepository.save(club);

      // Создаем места
      if (totalBerths > 0) {
        const berthRepository = AppDataSource.getRepository(Berth);
        const berths = [];

        for (let i = 1; i <= totalBerths; i++) {
          const berth = berthRepository.create({
            number: `Место ${i}`,
            length: 20, // значение по умолчанию
            width: 5,
            pricePerDay: basePrice,
            clubId: club.id,
          });
          berths.push(berth);
        }

        await berthRepository.save(berths);
      }

      const savedClub = await clubRepository.findOne({
        where: { id: club.id },
        relations: ['owner'],
      });

      if (!savedClub) {
        throw new AppError('Ошибка при создании клуба', 500);
      }

      // Загружаем места с сортировкой по номеру места
      // Сначала места, начинающиеся с текста (алфавитно), потом с числа (по возрастанию)
      const berthRepository = AppDataSource.getRepository(Berth);
      const berths = await berthRepository
        .createQueryBuilder('berth')
        .where('berth.clubId = :clubId', { clubId: club.id })
        .orderBy(
          `CASE WHEN berth.number ~ '^[^0-9]' THEN 0 ELSE 1 END`,
          'ASC'
        )
        .addOrderBy(
          `CASE WHEN berth.number ~ '^[0-9]' THEN CAST(SUBSTRING(berth.number FROM '^([0-9]+)') AS INTEGER) ELSE 0 END`,
          'ASC'
        )
        .addOrderBy('berth.number', 'ASC')
        .getMany();

      // Добавляем отсортированные места к клубу
      savedClub.berths = berths;

      res.status(201).json(savedClub);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;
      const {
        name,
        description,
        address,
        latitude,
        longitude,
        phone,
        email,
        website,
        totalBerths,
        minRentalPeriod,
        maxRentalPeriod,
        basePrice,
        minPricePerMonth,
      } = req.body;

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['owner', 'berths'],
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверка прав доступа - владелец клуба может редактировать свой клуб
      if (
        club.ownerId !== req.userId &&
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN
      ) {
        throw new AppError('Недостаточно прав для редактирования', 403);
      }

      // Обновляем поля клуба
      if (name !== undefined) club.name = name;
      if (description !== undefined) club.description = description;
      if (address !== undefined) club.address = address;
      if (latitude !== undefined) club.latitude = parseFloat(latitude as string);
      if (longitude !== undefined) club.longitude = parseFloat(longitude as string);
      if (phone !== undefined) club.phone = phone;
      if (email !== undefined) club.email = email;
      if (website !== undefined) club.website = website;
      if (minRentalPeriod !== undefined) club.minRentalPeriod = parseInt(minRentalPeriod as string);
      if (maxRentalPeriod !== undefined) club.maxRentalPeriod = parseInt(maxRentalPeriod as string);
      if (basePrice !== undefined) club.basePrice = parseFloat(basePrice as string);
      if (minPricePerMonth !== undefined) club.minPricePerMonth = minPricePerMonth ? parseFloat(minPricePerMonth as string) : null;

      // totalBerths теперь автоматически подсчитывается на основе добавленных мест
      // Не обрабатываем изменение totalBerths при редактировании клуба

      await clubRepository.save(club);

      // Получаем обновленный клуб с связями
      const updatedClub = await clubRepository.findOne({
        where: { id: club.id },
        relations: ['owner'],
      });

      if (!updatedClub) {
        throw new AppError('Ошибка при обновлении клуба', 500);
      }

      // Загружаем места с сортировкой по номеру места
      // Сначала места, начинающиеся с текста (алфавитно), потом с числа (по возрастанию)
      const berthRepository = AppDataSource.getRepository(Berth);
      const berths = await berthRepository
        .createQueryBuilder('berth')
        .where('berth.clubId = :clubId', { clubId: club.id })
        .orderBy(
          `CASE WHEN berth.number ~ '^[^0-9]' THEN 0 ELSE 1 END`,
          'ASC'
        )
        .addOrderBy(
          `CASE WHEN berth.number ~ '^[0-9]' THEN CAST(SUBSTRING(berth.number FROM '^([0-9]+)') AS INTEGER) ELSE 0 END`,
          'ASC'
        )
        .addOrderBy('berth.number', 'ASC')
        .getMany();

      // Добавляем отсортированные места к клубу
      updatedClub.berths = berths;

      res.json(updatedClub);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверка прав доступа
      if (
        club.ownerId !== req.userId &&
        req.userRole !== UserRole.SUPER_ADMIN
      ) {
        throw new AppError('Недостаточно прав для удаления', 403);
      }

      // Супер-администратор может полностью удалить клуб
      if (req.userRole === UserRole.SUPER_ADMIN) {
        await clubRepository.remove(club);
        res.json({ message: 'Яхт-клуб успешно удален' });
      } else {
        // Владелец клуба может только деактивировать
        club.isActive = false;
        await clubRepository.save(club);
        res.json({ message: 'Яхт-клуб деактивирован' });
      }
    } catch (error) {
      next(error);
    }
  }
}


