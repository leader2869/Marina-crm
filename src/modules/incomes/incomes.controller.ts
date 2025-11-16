import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Income } from '../../entities/Income';
import { IncomeCategory } from '../../entities/IncomeCategory';
import { Vessel } from '../../entities/Vessel';
import { VesselOwnerCash } from '../../entities/VesselOwnerCash';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { UserRole, Currency, CashPaymentMethod } from '../../types';

export class IncomesController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );

      const { startDate, endDate, categoryId, vesselId, cashId } = req.query;

      const incomeRepository = AppDataSource.getRepository(Income);
      const queryBuilder = incomeRepository
        .createQueryBuilder('income')
        .leftJoinAndSelect('income.category', 'category')
        .leftJoinAndSelect('income.vessel', 'vessel')
        .leftJoinAndSelect('income.cash', 'cash')
        .leftJoinAndSelect('cash.vesselOwner', 'vesselOwner');

      // Если не суперадмин или админ, показываем только свои приходы
      if (req.userRole !== UserRole.SUPER_ADMIN && req.userRole !== UserRole.ADMIN) {
        queryBuilder.where('vesselOwner.id = :vesselOwnerId', { vesselOwnerId: req.userId });
      }

      // Фильтрация по категории
      if (categoryId) {
        queryBuilder.andWhere('income.categoryId = :categoryId', {
          categoryId: parseInt(categoryId as string),
        });
      }

      // Фильтрация по катеру
      if (vesselId) {
        queryBuilder.andWhere('income.vesselId = :vesselId', {
          vesselId: parseInt(vesselId as string),
        });
      }

      // Фильтрация по кассе
      if (cashId) {
        queryBuilder.andWhere('income.cashId = :cashId', {
          cashId: parseInt(cashId as string),
        });
      }

      // Фильтрация по периоду
      if (startDate) {
        queryBuilder.andWhere('income.date >= :startDate', {
          startDate: new Date(startDate as string),
        });
      }
      if (endDate) {
        queryBuilder.andWhere('income.date <= :endDate', {
          endDate: new Date(endDate as string),
        });
      }

      const [incomes, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('income.date', 'DESC')
        .addOrderBy('income.createdAt', 'DESC')
        .getManyAndCount();

      res.json(createPaginatedResponse(incomes, total, page, limit));
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
      const incomeRepository = AppDataSource.getRepository(Income);
      const income = await incomeRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['category', 'vessel', 'cash', 'cash.vesselOwner'],
      });

      if (!income) {
        throw new AppError('Приход не найден', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        income.cash.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Недостаточно прав для доступа к этому приходу', 403);
      }

      res.json(income);
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
        categoryId,
        vesselId,
        cashId,
        amount,
        currency,
        paymentMethod,
        date,
        description,
        counterparty,
      } = req.body;

      if (!categoryId) {
        throw new AppError('Категория прихода обязательна', 400);
      }
      if (!vesselId) {
        throw new AppError('Катер обязателен', 400);
      }
      if (!cashId) {
        throw new AppError('Касса обязательна', 400);
      }
      if (!amount || amount <= 0) {
        throw new AppError('Сумма должна быть больше нуля', 400);
      }
      if (!date) {
        throw new AppError('Дата обязательна', 400);
      }

      // Проверяем существование категории
      const categoryRepository = AppDataSource.getRepository(IncomeCategory);
      const category = await categoryRepository.findOne({
        where: { id: parseInt(categoryId as string) },
      });

      if (!category) {
        throw new AppError('Категория не найдена', 404);
      }

      // Проверка прав доступа к категории
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        category.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Категория не принадлежит вам', 403);
      }

      // Проверяем существование катера
      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = await vesselRepository.findOne({
        where: { id: parseInt(vesselId as string) },
      });

      if (!vessel) {
        throw new AppError('Катер не найден', 404);
      }

      // Проверка прав доступа к катеру
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        vessel.ownerId !== req.userId
      ) {
        throw new AppError('Катер не принадлежит вам', 403);
      }

      // Проверяем существование кассы
      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(cashId as string) },
        relations: ['vesselOwner'],
      });

      if (!cash) {
        throw new AppError('Касса не найдена', 404);
      }

      // Проверка прав доступа к кассе
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        cash.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Касса не принадлежит вам', 403);
      }

      // Проверка, что касса привязана к выбранному катеру
      if (cash.vesselId !== vessel.id) {
        throw new AppError('Касса не привязана к выбранному катеру', 400);
      }

      const incomeRepository = AppDataSource.getRepository(Income);
      const income = incomeRepository.create({
        categoryId: parseInt(categoryId as string),
        vesselId: parseInt(vesselId as string),
        cashId: parseInt(cashId as string),
        amount: parseFloat(amount as string),
        currency: (currency ? (currency as Currency) : Currency.RUB),
        paymentMethod: paymentMethod as CashPaymentMethod,
        date: new Date(date as string),
        description: description ? (description as string) : undefined,
        counterparty: counterparty ? (counterparty as string) : undefined,
      });

      await incomeRepository.save(income);

      const savedIncome = await incomeRepository.findOne({
        where: { id: income.id },
        relations: ['category', 'vessel', 'cash', 'cash.vesselOwner'],
      });

      res.status(201).json(savedIncome);
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
      const incomeRepository = AppDataSource.getRepository(Income);
      const income = await incomeRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['category', 'vessel', 'cash', 'cash.vesselOwner'],
      });

      if (!income) {
        throw new AppError('Приход не найден', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        income.cash.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Недостаточно прав для редактирования этого прихода', 403);
      }

      const {
        categoryId,
        vesselId,
        cashId,
        amount,
        currency,
        paymentMethod,
        date,
        description,
        counterparty,
      } = req.body;

      if (categoryId !== undefined) {
        const categoryRepository = AppDataSource.getRepository(IncomeCategory);
        const category = await categoryRepository.findOne({
          where: { id: parseInt(categoryId as string) },
        });

        if (!category) {
          throw new AppError('Категория не найдена', 404);
        }

        if (
          req.userRole !== UserRole.SUPER_ADMIN &&
          req.userRole !== UserRole.ADMIN &&
          category.vesselOwnerId !== req.userId
        ) {
          throw new AppError('Категория не принадлежит вам', 403);
        }

        income.categoryId = parseInt(categoryId as string);
      }

      if (vesselId !== undefined) {
        const vesselRepository = AppDataSource.getRepository(Vessel);
        const vessel = await vesselRepository.findOne({
          where: { id: parseInt(vesselId as string) },
        });

        if (!vessel) {
          throw new AppError('Катер не найден', 404);
        }

        if (
          req.userRole !== UserRole.SUPER_ADMIN &&
          req.userRole !== UserRole.ADMIN &&
          vessel.ownerId !== req.userId
        ) {
          throw new AppError('Катер не принадлежит вам', 403);
        }

        income.vesselId = parseInt(vesselId as string);
      }

      if (cashId !== undefined) {
        const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
        const cash = await cashRepository.findOne({
          where: { id: parseInt(cashId as string) },
          relations: ['vesselOwner'],
        });

        if (!cash) {
          throw new AppError('Касса не найдена', 404);
        }

        if (
          req.userRole !== UserRole.SUPER_ADMIN &&
          req.userRole !== UserRole.ADMIN &&
          cash.vesselOwnerId !== req.userId
        ) {
          throw new AppError('Касса не принадлежит вам', 403);
        }

        income.cashId = parseInt(cashId as string);
      }

      if (amount !== undefined) {
        if (amount <= 0) {
          throw new AppError('Сумма должна быть больше нуля', 400);
        }
        income.amount = parseFloat(amount as string);
      }

      if (currency !== undefined) {
        income.currency = currency as Currency;
      }

      if (paymentMethod !== undefined) {
        income.paymentMethod = paymentMethod as CashPaymentMethod;
      }

      if (date !== undefined) {
        income.date = new Date(date as string);
      }

      if (description !== undefined) {
        (income as any).description = description ? (description as string) : null;
      }

      if (counterparty !== undefined) {
        (income as any).counterparty = counterparty ? (counterparty as string) : null;
      }

      await incomeRepository.save(income);

      const updatedIncome = await incomeRepository.findOne({
        where: { id: income.id },
        relations: ['category', 'vessel', 'cash', 'cash.vesselOwner'],
      });

      res.json(updatedIncome);
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
      const incomeRepository = AppDataSource.getRepository(Income);
      const income = await incomeRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['cash', 'cash.vesselOwner'],
      });

      if (!income) {
        throw new AppError('Приход не найден', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        income.cash.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Недостаточно прав для удаления этого прихода', 403);
      }

      await incomeRepository.delete(income.id);
      res.json({ message: 'Приход удален', income });
    } catch (error) {
      next(error);
    }
  }
}

