import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { VesselOwnerExpenseCategory } from '../../entities/VesselOwnerExpenseCategory';
import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../middleware/auth';
import { UserRole } from '../../types';
import { createPaginatedResponse } from '../../utils/pagination';

export class ExpenseCategoriesController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { page, limit } = req.query;
      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 20;

      const categoryRepository = AppDataSource.getRepository(VesselOwnerExpenseCategory);
      const queryBuilder = categoryRepository
        .createQueryBuilder('category')
        .leftJoinAndSelect('category.vesselOwner', 'vesselOwner')
        .where('category.vesselOwnerId = :vesselOwnerId', { vesselOwnerId: req.userId });

      // Фильтр по активным категориям (если не запрошены все)
      if (req.query.includeInactive !== 'true') {
        queryBuilder.andWhere('category.isActive = :isActive', { isActive: true });
      }

      const [categories, total] = await queryBuilder
        .skip((pageNum - 1) * limitNum)
        .take(limitNum)
        .orderBy('category.name', 'ASC')
        .getManyAndCount();

      res.json(createPaginatedResponse(categories, total, pageNum, limitNum));
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
      const categoryRepository = AppDataSource.getRepository(VesselOwnerExpenseCategory);
      const category = await categoryRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['vesselOwner'],
      });

      if (!category) {
        throw new AppError('Категория не найдена', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        category.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Доступ запрещен', 403);
      }

      res.json(category);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { name, description } = req.body;

      if (!name) {
        throw new AppError('Название категории обязательно', 400);
      }

      const categoryRepository = AppDataSource.getRepository(VesselOwnerExpenseCategory);
      const category = categoryRepository.create({
        name: name as string,
        description: description ? (description as string) : undefined,
        vesselOwnerId: req.userId,
        isActive: true,
      });

      await categoryRepository.save(category);

      const savedCategory = await categoryRepository.findOne({
        where: { id: category.id },
        relations: ['vesselOwner'],
      });

      res.status(201).json(savedCategory);
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
      const { name, description, isActive } = req.body;

      const categoryRepository = AppDataSource.getRepository(VesselOwnerExpenseCategory);
      const category = await categoryRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!category) {
        throw new AppError('Категория не найдена', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        category.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Доступ запрещен', 403);
      }

      if (name !== undefined) category.name = name as string;
      if (description !== undefined) category.description = description ? (description as string) : (null as any);
      if (isActive !== undefined) category.isActive = isActive as boolean;

      await categoryRepository.save(category);

      const updatedCategory = await categoryRepository.findOne({
        where: { id: category.id },
        relations: ['vesselOwner'],
      });

      res.json(updatedCategory);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;
      const categoryRepository = AppDataSource.getRepository(VesselOwnerExpenseCategory);
      const category = await categoryRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!category) {
        throw new AppError('Категория не найдена', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        category.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Доступ запрещен', 403);
      }

      await categoryRepository.remove(category);

      res.json({ message: 'Категория успешно удалена' });
    } catch (error) {
      next(error);
    }
  }
}

