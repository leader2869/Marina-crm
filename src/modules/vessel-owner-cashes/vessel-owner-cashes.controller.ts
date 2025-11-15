import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { VesselOwnerCash } from '../../entities/VesselOwnerCash';
import { CashTransaction } from '../../entities/CashTransaction';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { UserRole, CashTransactionType } from '../../types';
import { Between } from 'typeorm';

export class VesselOwnerCashesController {
  // Получить все кассы судовладельца
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );

      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const queryBuilder = cashRepository
        .createQueryBuilder('cash')
        .leftJoinAndSelect('cash.vesselOwner', 'vesselOwner');

      // Если не суперадмин или админ, показываем только свои кассы
      if (req.userRole !== UserRole.SUPER_ADMIN && req.userRole !== UserRole.ADMIN) {
        queryBuilder.where('cash.vesselOwnerId = :vesselOwnerId', { vesselOwnerId: req.userId });
      }

      const [cashes, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('cash.createdAt', 'DESC')
        .getManyAndCount();

      res.json(createPaginatedResponse(cashes, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  // Получить кассу по ID
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;
      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['vesselOwner'],
      });

      if (!cash) {
        throw new AppError('Касса не найдена', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        cash.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Доступ запрещен', 403);
      }

      res.json(cash);
    } catch (error) {
      next(error);
    }
  }

  // Создать кассу
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { name, description } = req.body;

      if (!name) {
        throw new AppError('Название кассы обязательно', 400);
      }

      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = cashRepository.create({
        name: name as string,
        description: description as string | undefined,
        vesselOwnerId: req.userId,
        isActive: true,
      });

      await cashRepository.save(cash);

      const savedCash = await cashRepository.findOne({
        where: { id: cash.id },
        relations: ['vesselOwner'],
      });

      res.status(201).json(savedCash);
    } catch (error) {
      next(error);
    }
  }

  // Обновить кассу
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!cash) {
        throw new AppError('Касса не найдена', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        cash.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Доступ запрещен', 403);
      }

      if (name !== undefined) cash.name = name as string;
      if (description !== undefined) cash.description = description || undefined;
      if (isActive !== undefined) cash.isActive = isActive as boolean;

      await cashRepository.save(cash);

      const updatedCash = await cashRepository.findOne({
        where: { id: cash.id },
        relations: ['vesselOwner'],
      });

      res.json(updatedCash);
    } catch (error) {
      next(error);
    }
  }

  // Удалить кассу
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;
      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!cash) {
        throw new AppError('Касса не найдена', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        cash.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Доступ запрещен', 403);
      }

      await cashRepository.remove(cash);

      res.json({ message: 'Касса удалена' });
    } catch (error) {
      next(error);
    }
  }

  // Получить баланс кассы
  async getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;
      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!cash) {
        throw new AppError('Касса не найдена', 404);
      }

      // Проверка прав доступа
      if (
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN &&
        cash.vesselOwnerId !== req.userId
      ) {
        throw new AppError('Доступ запрещен', 403);
      }

      const transactionRepository = AppDataSource.getRepository(CashTransaction);
      const transactions = await transactionRepository.find({
        where: { cashId: cash.id },
      });

      let totalIncome = 0;
      let totalExpense = 0;
      let incomeCash = 0;
      let incomeNonCash = 0;
      let expenseCash = 0;
      let expenseNonCash = 0;

      transactions.forEach((transaction) => {
        const amount = parseFloat(transaction.amount.toString());
        if (transaction.transactionType === CashTransactionType.INCOME) {
          totalIncome += amount;
          if (transaction.paymentMethod === 'cash') {
            incomeCash += amount;
          } else {
            incomeNonCash += amount;
          }
        } else {
          totalExpense += amount;
          if (transaction.paymentMethod === 'cash') {
            expenseCash += amount;
          } else {
            expenseNonCash += amount;
          }
        }
      });

      const balance = totalIncome - totalExpense;
      const balanceCash = incomeCash - expenseCash;
      const balanceNonCash = incomeNonCash - expenseNonCash;

      res.json({
        cashId: cash.id,
        cashName: cash.name,
        totalIncome,
        totalExpense,
        balance,
        balanceByPaymentMethod: {
          cash: balanceCash,
          non_cash: balanceNonCash,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

