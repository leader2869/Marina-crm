import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Vessel } from '../../entities/Vessel';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';

export class VesselsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const queryBuilder = vesselRepository
        .createQueryBuilder('vessel')
        .leftJoinAndSelect('vessel.owner', 'owner');

      // Если не суперадмин или админ, показываем только свои суда
      if (req.userId && req.userRole !== 'super_admin' && req.userRole !== 'admin') {
        queryBuilder.where('vessel.ownerId = :ownerId', { ownerId: req.userId });
      }

      const [vessels, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      res.json(createPaginatedResponse(vessels, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = await vesselRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['owner', 'bookings'],
      });

      if (!vessel) {
        throw new AppError('Судно не найдено', 404);
      }

      // Проверка прав доступа
      if (
        vessel.ownerId !== req.userId &&
        req.userRole !== 'super_admin' &&
        req.userRole !== 'admin'
      ) {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      res.json(vessel);
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
        type,
        length,
        width,
        heightAboveWaterline,
        registrationNumber,
        documentPath,
        technicalSpecs,
        photo,
      } = req.body;

      if (!name || !type || !length) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = vesselRepository.create({
        name: name as string,
        type: type as string,
        length: parseFloat(length as string),
        width: width ? parseFloat(width as string) : undefined,
        heightAboveWaterline: heightAboveWaterline ? parseFloat(heightAboveWaterline as string) : undefined,
        registrationNumber: registrationNumber as string | undefined,
        documentPath: documentPath as string | undefined,
        technicalSpecs: technicalSpecs ? JSON.stringify(technicalSpecs) : undefined,
        photo: photo as string | undefined,
        ownerId: req.userId,
      });

      await vesselRepository.save(vessel);

      const savedVessel = await vesselRepository.findOne({
        where: { id: vessel.id },
        relations: ['owner'],
      });

      res.status(201).json(savedVessel);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = await vesselRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!vessel) {
        throw new AppError('Судно не найдено', 404);
      }

      // Проверка прав доступа
      if (
        vessel.ownerId !== req.userId &&
        req.userRole !== 'super_admin' &&
        req.userRole !== 'admin'
      ) {
        throw new AppError('Недостаточно прав для редактирования', 403);
      }

      Object.assign(vessel, req.body);
      if (req.body.technicalSpecs) {
        vessel.technicalSpecs = JSON.stringify(req.body.technicalSpecs);
      }
      await vesselRepository.save(vessel);

      const updatedVessel = await vesselRepository.findOne({
        where: { id: vessel.id },
        relations: ['owner'],
      });

      res.json(updatedVessel);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = await vesselRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!vessel) {
        throw new AppError('Судно не найдено', 404);
      }

      // Проверка прав доступа - только владелец или супер-администратор
      if (
        vessel.ownerId !== req.userId &&
        req.userRole !== 'super_admin'
      ) {
        throw new AppError('Недостаточно прав для удаления', 403);
      }

      await vesselRepository.remove(vessel);

      res.json({ message: 'Судно удалено' });
    } catch (error) {
      next(error);
    }
  }
}


