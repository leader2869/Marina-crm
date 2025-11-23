import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { VesselOwnerCash } from '../../entities/VesselOwnerCash';
import { CashTransaction } from '../../entities/CashTransaction';
import { IncomeCategory } from '../../entities/IncomeCategory';
import { VesselOwnerExpenseCategory } from '../../entities/VesselOwnerExpenseCategory';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { UserRole, CashTransactionType, CashPaymentMethod, Currency } from '../../types';
import { Between } from 'typeorm';

export class CashTransactionsController {
  // Получить транзакции кассы
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { cashId } = req.params;
      const { page, limit } = req.query;

      // Проверяем существование кассы и права доступа
      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(cashId) },
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

      const { page: pageNum, limit: limitNum } = getPaginationParams(
        parseInt(page as string),
        parseInt(limit as string)
      );

      const { startDate, endDate, transactionType, paymentMethod, categoryId, expenseCategoryId } = req.query;

      const transactionRepository = AppDataSource.getRepository(CashTransaction);
      const queryBuilder = transactionRepository
        .createQueryBuilder('transaction')
        .leftJoinAndSelect('transaction.cash', 'cash')
        .leftJoinAndSelect('transaction.incomeCategory', 'incomeCategory')
        .where('transaction.cashId = :cashId', { cashId: parseInt(cashId) });

      // Фильтрация по периоду
      if (startDate) {
        queryBuilder.andWhere('transaction.date >= :startDate', {
          startDate: new Date(startDate as string),
        });
      }
      if (endDate) {
        queryBuilder.andWhere('transaction.date <= :endDate', {
          endDate: new Date(endDate as string),
        });
      }

      if (transactionType) {
        queryBuilder.andWhere('transaction.transactionType = :transactionType', {
          transactionType,
        });
      }

      if (paymentMethod) {
        queryBuilder.andWhere('transaction.paymentMethod = :paymentMethod', {
          paymentMethod,
        });
      }

      if (categoryId) {
        queryBuilder.andWhere('transaction.categoryId = :categoryId', {
          categoryId: parseInt(categoryId as string),
        });
      }

      // Фильтрация по expenseCategoryId (только если поле существует в БД)
      // Пропускаем фильтрацию, если поле не существует - это обработается в try-catch ниже
      
      // Временно не используем expenseCategory, пока миграция не выполнена
      // Убираем фильтрацию по expenseCategoryId, если поле не существует
      // if (expenseCategoryId) {
      //   queryBuilder.andWhere('transaction.expenseCategoryId = :expenseCategoryId', {
      //     expenseCategoryId: parseInt(expenseCategoryId as string),
      //   });
      // }

      const [transactions, total] = await queryBuilder
        .skip((pageNum - 1) * limitNum)
        .take(limitNum)
        .orderBy('transaction.date', 'DESC')
        .addOrderBy('transaction.createdAt', 'DESC')
        .getManyAndCount();

      res.json(createPaginatedResponse(transactions, total, pageNum, limitNum));
    } catch (error) {
      next(error);
    }
  }

  // Получить транзакцию по ID
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { cashId, id } = req.params;

      // Проверяем существование кассы и права доступа
      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(cashId) },
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
      // Временно не используем expenseCategory, пока миграция не выполнена
      const transaction = await transactionRepository.findOne({
        where: { id: parseInt(id), cashId: parseInt(cashId) },
        relations: ['cash', 'incomeCategory'],
      });

      if (!transaction) {
        throw new AppError('Транзакция не найдена', 404);
      }

      res.json(transaction);
    } catch (error) {
      next(error);
    }
  }

  // Создать транзакцию
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { cashId } = req.params;
      const {
        transactionType,
        amount,
        currency,
        paymentMethod,
        date,
        description,
        counterparty,
        documentPath,
        categoryId,
      } = req.body;

      // Проверяем существование кассы и права доступа
      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(cashId) },
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

      if (!transactionType || !amount || !paymentMethod || !date) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      // Проверяем существование категории, если указана
      let categoryIdValue: number | null = null;
      // Временно не используем expenseCategoryId, пока миграция не выполнена
      // let expenseCategoryIdValue: number | null = null;
      
      // Для приходов используем IncomeCategory
      if (transactionType === CashTransactionType.INCOME && categoryId !== undefined && categoryId !== null) {
        const categoryIdNum = typeof categoryId === 'string' 
          ? (categoryId.trim() === '' ? null : parseInt(categoryId)) 
          : categoryId;
        
        if (categoryIdNum !== null && !isNaN(categoryIdNum) && categoryIdNum > 0) {
          const categoryRepository = AppDataSource.getRepository(IncomeCategory);
          const category = await categoryRepository.findOne({
            where: { id: categoryIdNum },
          });
          
          if (!category) {
            throw new AppError('Категория прихода не найдена', 404);
          }
          
          if (
            req.userRole !== UserRole.SUPER_ADMIN &&
            req.userRole !== UserRole.ADMIN &&
            category.vesselOwnerId !== req.userId
          ) {
            throw new AppError('Доступ к категории прихода запрещен', 403);
          }
          
          categoryIdValue = category.id;
        }
      }
      
      // Временно не используем expenseCategoryId, пока миграция не выполнена
      // Для расходов используем VesselOwnerExpenseCategory
      // if (transactionType === CashTransactionType.EXPENSE && expenseCategoryId !== undefined && expenseCategoryId !== null) {
      //   ...
      // }

      const transactionRepository = AppDataSource.getRepository(CashTransaction);
      const transactionData: any = {
        cashId: parseInt(cashId),
        transactionType: transactionType as CashTransactionType,
        amount: parseFloat(amount as string),
        currency: (currency as Currency) || Currency.RUB,
        paymentMethod: paymentMethod as CashPaymentMethod,
        date: new Date(date as string),
        description: description as string | undefined,
        counterparty: counterparty as string | undefined,
        documentPath: documentPath as string | undefined,
        categoryId: categoryIdValue,
      };
      
      // Временно не используем expenseCategoryId, пока миграция не выполнена
      // if (expenseCategoryIdValue !== null && expenseCategoryIdValue !== undefined) {
      //   transactionData.expenseCategoryId = expenseCategoryIdValue;
      // }
      
      const transaction = transactionRepository.create(transactionData);
      const saved = await transactionRepository.save(transaction);

      // Временно не используем expenseCategory, пока миграция не выполнена
      const savedTransaction = await transactionRepository.findOne({
        where: { id: saved.id },
        relations: ['cash', 'incomeCategory'],
      });

      res.status(201).json(savedTransaction);
    } catch (error) {
      next(error);
    }
  }

  // Обновить транзакцию
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { cashId, id } = req.params;
      const {
        transactionType,
        amount,
        currency,
        paymentMethod,
        date,
        description,
        counterparty,
        documentPath,
        categoryId,
        expenseCategoryId,
      } = req.body;

      // Проверяем существование кассы и права доступа
      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(cashId) },
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
      const transaction = await transactionRepository.findOne({
        where: { id: parseInt(id), cashId: parseInt(cashId) },
      });

      if (!transaction) {
        throw new AppError('Транзакция не найдена', 404);
      }

      if (transactionType !== undefined)
        transaction.transactionType = transactionType as CashTransactionType;
      if (amount !== undefined) transaction.amount = parseFloat(amount as string);
      if (currency !== undefined) transaction.currency = currency as Currency;
      if (paymentMethod !== undefined)
        transaction.paymentMethod = paymentMethod as CashPaymentMethod;
      if (date !== undefined) transaction.date = new Date(date as string);
      if (description !== undefined) transaction.description = description || undefined;
      if (counterparty !== undefined) transaction.counterparty = counterparty || undefined;
      if (documentPath !== undefined)
        transaction.documentPath = documentPath || undefined;
      // Обновляем категорию прихода, если тип транзакции - приход
      const finalTransactionType = transactionType !== undefined ? transactionType as CashTransactionType : transaction.transactionType;
      if (categoryId !== undefined && finalTransactionType === CashTransactionType.INCOME) {
        if (categoryId === null || categoryId === '') {
          transaction.categoryId = null;
          transaction.expenseCategoryId = null; // Очищаем категорию расхода
        } else {
          const categoryRepository = AppDataSource.getRepository(IncomeCategory);
          const category = await categoryRepository.findOne({
            where: { id: parseInt(categoryId as string) },
          });
          if (!category) {
            throw new AppError('Категория прихода не найдена', 404);
          }
          if (
            req.userRole !== UserRole.SUPER_ADMIN &&
            req.userRole !== UserRole.ADMIN &&
            category.vesselOwnerId !== req.userId
          ) {
            throw new AppError('Категория прихода не принадлежит вам', 403);
          }
          transaction.categoryId = parseInt(categoryId as string);
          transaction.expenseCategoryId = null; // Очищаем категорию расхода
        }
      }
      
      // Временно не используем expenseCategoryId, пока миграция не выполнена
      // Обновление категории расхода будет работать после выполнения миграции
      // if (expenseCategoryId !== undefined && finalTransactionType === CashTransactionType.EXPENSE) {
      //   ...
      // }

      await transactionRepository.save(transaction);

      // Временно не используем expenseCategory, пока миграция не выполнена
      const updatedTransaction = await transactionRepository.findOne({
        where: { id: transaction.id },
        relations: ['cash', 'incomeCategory'],
      });

      res.json(updatedTransaction);
    } catch (error) {
      next(error);
    }
  }

  // Удалить транзакцию
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { cashId, id } = req.params;

      // Проверяем существование кассы и права доступа
      const cashRepository = AppDataSource.getRepository(VesselOwnerCash);
      const cash = await cashRepository.findOne({
        where: { id: parseInt(cashId) },
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
      const transaction = await transactionRepository.findOne({
        where: { id: parseInt(id), cashId: parseInt(cashId) },
      });

      if (!transaction) {
        throw new AppError('Транзакция не найдена', 404);
      }

      await transactionRepository.remove(transaction);

      res.json({ message: 'Транзакция удалена' });
    } catch (error) {
      next(error);
    }
  }
}

