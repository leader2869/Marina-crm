import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { IncomeCategory } from '../../entities/IncomeCategory';
import { Income } from '../../entities/Income';
import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../middleware/auth';
import { UserRole } from '../../types';
import { createPaginatedResponse } from '../../utils/pagination';

export class IncomeCategoriesController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { page, limit } = req.query;
      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 20;

      const categoryRepository = AppDataSource.getRepository(IncomeCategory);
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
      const categoryRepository = AppDataSource.getRepository(IncomeCategory);
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
        throw new AppError('Недостаточно прав для доступа к этой категории', 403);
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

      const categoryRepository = AppDataSource.getRepository(IncomeCategory);
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
      const categoryRepository = AppDataSource.getRepository(IncomeCategory);
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
        throw new AppError('Недостаточно прав для редактирования этой категории', 403);
      }

      const { name, description, isActive } = req.body;

      if (name !== undefined) {
        category.name = name as string;
      }
      if (description !== undefined) {
        (category as any).description = description ? (description as string) : null;
      }
      if (isActive !== undefined) {
        category.isActive = isActive as boolean;
      }

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
      const categoryRepository = AppDataSource.getRepository(IncomeCategory);
      const incomeRepository = AppDataSource.getRepository(Income);

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
        throw new AppError('Недостаточно прав для удаления этой категории', 403);
      }

      // Проверяем, есть ли приходы с этой категорией
      const incomesCount = await incomeRepository.count({
        where: { categoryId: category.id },
      });

      if (incomesCount > 0) {
        throw new AppError(
          `Невозможно удалить категорию т.к. имеются приходы (${incomesCount})`,
          400
        );
      }

      await categoryRepository.delete(category.id);
      res.json({ message: 'Категория удалена', category });
    } catch (error) {
      next(error);
    }
  }
}

