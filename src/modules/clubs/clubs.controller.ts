import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Club } from '../../entities/Club';
import { Berth } from '../../entities/Berth';
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
        relations: ['owner', 'berths', 'managers'],
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

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
        ownerId: req.userId,
      });

      await clubRepository.save(club);

      // Создаем причалы
      if (totalBerths > 0) {
        const berthRepository = AppDataSource.getRepository(Berth);
        const berths = [];

        for (let i = 1; i <= totalBerths; i++) {
          const berth = berthRepository.create({
            number: `${i}`,
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
        relations: ['owner', 'berths'],
      });

      res.status(201).json(savedClub);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['owner'],
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверка прав доступа
      if (
        club.ownerId !== req.userId &&
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN
      ) {
        throw new AppError('Недостаточно прав для редактирования', 403);
      }

      Object.assign(club, req.body);
      await clubRepository.save(club);

      const updatedClub = await clubRepository.findOne({
        where: { id: club.id },
        relations: ['owner', 'berths'],
      });

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

      club.isActive = false;
      await clubRepository.save(club);

      res.json({ message: 'Яхт-клуб деактивирован' });
    } catch (error) {
      next(error);
    }
  }
}


