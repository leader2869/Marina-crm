import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { VesselOwnerCash } from '../../entities/VesselOwnerCash';
import { Vessel } from '../../entities/Vessel';
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

      const { includeHidden, vesselId } = req.query;

      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const queryBuilder = cashRepository
        .createQueryBuilder('cash')
        .leftJoinAndSelect('cash.vesselOwner', 'vesselOwner')
        .leftJoinAndSelect('cash.vessel', 'vessel');

      // Если не суперадмин или админ, показываем только свои кассы
      if (req.userRole !== UserRole.SUPER_ADMIN && req.userRole !== UserRole.ADMIN) {
        queryBuilder.where('cash.vesselOwnerId = :vesselOwnerId', { vesselOwnerId: req.userId });
      }

      // Фильтрация по катеру
      if (vesselId) {
        queryBuilder.andWhere('cash.vesselId = :vesselId', { vesselId: parseInt(vesselId as string) });
      }

      // Показываем только активные кассы (isActive = true), если не запрошены скрытые
      if (!includeHidden || includeHidden !== 'true') {
        queryBuilder.andWhere('cash.isActive = :isActive', { isActive: true });
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

      const { name, description, vesselId } = req.body;

      if (!name) {
        throw new AppError('Название кассы обязательно', 400);
      }

      if (!vesselId) {
        throw new AppError('Необходимо указать катер', 400);
      }

      // Проверяем, что катер принадлежит судовладельцу
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

      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = cashRepository.create({
        name: name as string,
        description: description as string | undefined,
        vesselOwnerId: req.userId,
        vesselId: parseInt(vesselId as string),
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
      const { name, description, isActive, vesselId } = req.body;

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
      
      if (vesselId !== undefined) {
        const vesselIdNum = parseInt(vesselId as string);
        // Проверяем, что катер принадлежит судовладельцу
        const vesselRepository = AppDataSource.getRepository(Vessel);
        const vessel = await vesselRepository.findOne({
          where: { id: vesselIdNum },
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

        cash.vesselId = vesselIdNum;
      }

      await cashRepository.save(cash);

      const updatedCash = await cashRepository.findOne({
        where: { id: cash.id },
        relations: ['vesselOwner', 'vessel'],
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
      const transactionRepository = AppDataSource.getRepository(CashTransaction);
      
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

      // Проверяем наличие транзакций
      const transactionsCount = await transactionRepository.count({
        where: { cashId: cash.id },
      });

      if (transactionsCount > 0) {
        throw new AppError(
          `Невозможно удалить кассу: в ней есть ${transactionsCount} транзакций. Используйте функцию "Скрыть кассу" вместо удаления.`,
          400
        );
      }

      await cashRepository.remove(cash);

      res.json({ message: 'Касса удалена' });
    } catch (error: any) {
      // Обрабатываем ошибку внешнего ключа
      const errorMessage = error?.message || '';
      const errorCode = error?.code || '';
      
      const isForeignKeyError = 
        errorMessage.includes('foreign key constraint') ||
        errorMessage.includes('violates foreign key') ||
        errorMessage.includes('FK_') ||
        errorMessage.includes('cash_transactions') ||
        errorCode === '23503'; // PostgreSQL код ошибки для нарушения внешнего ключа
      
      if (isForeignKeyError) {
        // Если возникла ошибка внешнего ключа, значит есть транзакции
        try {
          const transactionRepository = AppDataSource.getRepository(CashTransaction);
          const transactionsCount = await transactionRepository.count({
            where: { cashId: parseInt(req.params.id) },
          });

          throw new AppError(
            `Невозможно удалить кассу: в ней есть ${transactionsCount > 0 ? transactionsCount : ''} транзакций. Используйте функцию "Скрыть кассу" вместо удаления.`,
            400
          );
        } catch (countError: any) {
          // Если не удалось посчитать транзакции, все равно показываем понятное сообщение
          throw new AppError(
            'Невозможно удалить кассу: в ней есть транзакции. Используйте функцию "Скрыть кассу" вместо удаления.',
            400
          );
        }
      }
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

      const { startDate, endDate } = req.query;
      
      const transactionRepository = AppDataSource.getRepository(CashTransaction);
      const queryBuilder = transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.cashId = :cashId', { cashId: cash.id });

      // Фильтрация по периоду
      if (startDate) {
        queryBuilder.andWhere('transaction.date >= :startDate', { 
          startDate: new Date(startDate as string) 
        });
      }
      if (endDate) {
        queryBuilder.andWhere('transaction.date <= :endDate', { 
          endDate: new Date(endDate as string) 
        });
      }

      const transactions = await queryBuilder.getMany();

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

  // Получить общую сумму доходов по всем кассам судовладельца
  async getTotalIncome(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { startDate, endDate } = req.query;

      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const queryBuilder = cashRepository
        .createQueryBuilder('cash')
        .where('cash.isActive = :isActive', { isActive: true });

      // Если не суперадмин или админ, показываем только свои кассы
      if (req.userRole !== UserRole.SUPER_ADMIN && req.userRole !== UserRole.ADMIN) {
        queryBuilder.andWhere('cash.vesselOwnerId = :vesselOwnerId', { vesselOwnerId: req.userId });
      }

      const cashes = await queryBuilder.getMany();

      const transactionRepository = AppDataSource.getRepository(CashTransaction);
      let totalIncome = 0;

      for (const cash of cashes) {
        const transactionQueryBuilder = transactionRepository
          .createQueryBuilder('transaction')
          .where('transaction.cashId = :cashId', { cashId: cash.id })
          .andWhere('transaction.transactionType = :transactionType', { 
            transactionType: CashTransactionType.INCOME 
          });

        // Фильтрация по периоду
        if (startDate) {
          transactionQueryBuilder.andWhere('transaction.date >= :startDate', {
            startDate: new Date(startDate as string),
          });
        }
        if (endDate) {
          transactionQueryBuilder.andWhere('transaction.date <= :endDate', {
            endDate: new Date(endDate as string),
          });
        }

        const transactions = await transactionQueryBuilder.getMany();

        transactions.forEach((transaction) => {
          const amount = parseFloat(transaction.amount.toString());
          totalIncome += amount;
        });
      }

      res.json({
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        cashesCount: cashes.length,
      });
    } catch (error) {
      next(error);
    }
  }

  // Получить общую сумму расходов по всем кассам судовладельца
  async getTotalExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { startDate, endDate } = req.query;

      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const queryBuilder = cashRepository
        .createQueryBuilder('cash')
        .where('cash.isActive = :isActive', { isActive: true });

      // Если не суперадмин или админ, показываем только свои кассы
      if (req.userRole !== UserRole.SUPER_ADMIN && req.userRole !== UserRole.ADMIN) {
        queryBuilder.andWhere('cash.vesselOwnerId = :vesselOwnerId', { vesselOwnerId: req.userId });
      }

      const cashes = await queryBuilder.getMany();

      const transactionRepository = AppDataSource.getRepository(CashTransaction);
      let totalExpense = 0;

      for (const cash of cashes) {
        const transactionQueryBuilder = transactionRepository
          .createQueryBuilder('transaction')
          .where('transaction.cashId = :cashId', { cashId: cash.id })
          .andWhere('transaction.transactionType = :transactionType', { 
            transactionType: CashTransactionType.EXPENSE 
          });

        // Фильтрация по периоду
        if (startDate) {
          transactionQueryBuilder.andWhere('transaction.date >= :startDate', {
            startDate: new Date(startDate as string),
          });
        }
        if (endDate) {
          transactionQueryBuilder.andWhere('transaction.date <= :endDate', {
            endDate: new Date(endDate as string),
          });
        }

        const transactions = await transactionQueryBuilder.getMany();

        transactions.forEach((transaction) => {
          const amount = parseFloat(transaction.amount.toString());
          totalExpense += amount;
        });
      }

      res.json({
        totalExpense: parseFloat(totalExpense.toFixed(2)),
        cashesCount: cashes.length,
      });
    } catch (error) {
      next(error);
    }
  }
}

