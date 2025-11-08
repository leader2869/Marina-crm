import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Income } from '../../entities/Income';
import { Expense } from '../../entities/Expense';
import { ExpenseCategory } from '../../entities/ExpenseCategory';
import { Budget } from '../../entities/Budget';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { IncomeType, Currency } from '../../types';
import { Between } from 'typeorm';

export class FinancesController {
  // ========== ДОХОДЫ ==========
  async getIncomes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );
      const { clubId, startDate, endDate, type } = req.query;

      const incomeRepository = AppDataSource.getRepository(Income);
      const queryBuilder = incomeRepository
        .createQueryBuilder('income')
        .leftJoinAndSelect('income.club', 'club')
        .leftJoinAndSelect('income.booking', 'booking');

      if (clubId) {
        queryBuilder.where('income.clubId = :clubId', { clubId: parseInt(clubId as string) });
      }

      if (startDate && endDate) {
        queryBuilder.andWhere('income.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      if (type) {
        queryBuilder.andWhere('income.type = :type', { type });
      }

      const [incomes, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('income.date', 'DESC')
        .getManyAndCount();

      res.json(createPaginatedResponse(incomes, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async createIncome(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        clubId,
        type,
        amount,
        currency,
        date,
        description,
        invoiceNumber,
        documentPath,
        bookingId,
      } = req.body;

      if (!clubId || !type || !amount || !date) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      const incomeRepository = AppDataSource.getRepository(Income);
      const income = incomeRepository.create({
        clubId: parseInt(clubId as string),
        type: type as IncomeType,
        amount: parseFloat(amount as string),
        currency: (currency as Currency) || Currency.RUB,
        date: new Date(date as string),
        description: description as string | undefined,
        invoiceNumber: invoiceNumber as string | undefined,
        documentPath: documentPath as string | undefined,
        bookingId: bookingId ? parseInt(bookingId as string) : undefined,
      });

      await incomeRepository.save(income);

      const savedIncome = await incomeRepository.findOne({
        where: { id: income.id },
        relations: ['club', 'booking'],
      });

      res.status(201).json(savedIncome);
    } catch (error) {
      next(error);
    }
  }

  // ========== РАСХОДЫ ==========
  async getExpenses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );
      const { clubId, startDate, endDate, categoryId, tags } = req.query;

      const expenseRepository = AppDataSource.getRepository(Expense);
      const queryBuilder = expenseRepository
        .createQueryBuilder('expense')
        .leftJoinAndSelect('expense.club', 'club')
        .leftJoinAndSelect('expense.category', 'category')
        .leftJoinAndSelect('expense.createdBy', 'createdBy');

      if (clubId) {
        queryBuilder.where('expense.clubId = :clubId', { clubId: parseInt(clubId as string) });
      }

      if (startDate && endDate) {
        queryBuilder.andWhere('expense.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      if (categoryId) {
        queryBuilder.andWhere('expense.categoryId = :categoryId', {
          categoryId: parseInt(categoryId as string),
        });
      }

      if (tags) {
        const tagArray = (tags as string).split(',');
        tagArray.forEach((tag) => {
          queryBuilder.andWhere('expense.tags LIKE :tag', { tag: `%${tag}%` });
        });
      }

      const [expenses, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('expense.date', 'DESC')
        .getManyAndCount();

      res.json(createPaginatedResponse(expenses, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async createExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const {
        clubId,
        categoryId,
        amount,
        currency,
        date,
        description,
        paymentMethod,
        counterparty,
        receiptPhoto,
        attachedFiles,
        tags,
        project,
        isRecurring,
        recurringPattern,
      } = req.body;

      if (!clubId || !categoryId || !amount || !date || !paymentMethod) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const expenseRepository = AppDataSource.getRepository(Expense);
      const expense = expenseRepository.create({
        clubId: parseInt(clubId as string),
        categoryId: parseInt(categoryId as string),
        amount: parseFloat(amount as string),
        currency: (currency as Currency) || Currency.RUB,
        date: new Date(date as string),
        description: description as string | undefined,
        paymentMethod: paymentMethod as any,
        counterparty: counterparty as string | undefined,
        receiptPhoto: receiptPhoto as string | undefined,
        attachedFiles: attachedFiles ? JSON.stringify(attachedFiles) : undefined,
        tags: tags ? JSON.stringify(tags) : undefined,
        project: project as string | undefined,
        isRecurring: isRecurring || false,
        recurringPattern: recurringPattern ? JSON.stringify(recurringPattern) : undefined,
        createdById: req.userId,
        isApproved: false,
      });

      await expenseRepository.save(expense);

      const savedExpense = await expenseRepository.findOne({
        where: { id: expense.id },
        relations: ['club', 'category', 'createdBy'],
      });

      res.status(201).json(savedExpense);
    } catch (error) {
      next(error);
    }
  }

  async approveExpense(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;

      const expenseRepository = AppDataSource.getRepository(Expense);
      const expense = await expenseRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club'],
      });

      if (!expense) {
        throw new AppError('Расход не найден', 404);
      }

      // Проверка прав доступа
      if (
        expense.club.ownerId !== req.userId &&
        req.userRole !== 'super_admin' &&
        req.userRole !== 'admin'
      ) {
        throw new AppError('Недостаточно прав для утверждения', 403);
      }

      expense.isApproved = true;
      expense.approvedBy = req.userId;
      expense.approvedAt = new Date();

      await expenseRepository.save(expense);

      res.json({ message: 'Расход утвержден', expense });
    } catch (error) {
      next(error);
    }
  }

  // ========== КАТЕГОРИИ РАСХОДОВ ==========
  async getExpenseCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clubId } = req.query;

      const categoryRepository = AppDataSource.getRepository(ExpenseCategory);
      const queryBuilder = categoryRepository
        .createQueryBuilder('category')
        .leftJoinAndSelect('category.parent', 'parent')
        .leftJoinAndSelect('category.children', 'children')
        .where('category.isActive = :isActive', { isActive: true });

      if (clubId) {
        queryBuilder.andWhere('(category.clubId = :clubId OR category.clubId IS NULL)', {
          clubId: parseInt(clubId as string),
        });
      } else {
        queryBuilder.andWhere('category.clubId IS NULL'); // только общие категории
      }

      const categories = await queryBuilder.getMany();

      res.json(categories);
    } catch (error) {
      next(error);
    }
  }

  async createExpenseCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, type, icon, color, parentId, clubId } = req.body;

      if (!name) {
        throw new AppError('Название категории обязательно', 400);
      }

      const categoryRepository = AppDataSource.getRepository(ExpenseCategory);
      const category = categoryRepository.create({
        name: name as string,
        description: description as string | undefined,
        type: type as any,
        icon: icon as string | undefined,
        color: color as string | undefined,
        parentId: parentId ? parseInt(parentId as string) : undefined,
        clubId: clubId ? parseInt(clubId as string) : undefined,
      });

      await categoryRepository.save(category);

      const savedCategory = await categoryRepository.findOne({
        where: { id: category.id },
        relations: ['parent', 'children'],
      });

      res.status(201).json(savedCategory);
    } catch (error) {
      next(error);
    }
  }

  // ========== АНАЛИТИКА ==========
  async getFinancialAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clubId, startDate, endDate } = req.query;

      if (!clubId || !startDate || !endDate) {
        throw new AppError('clubId, startDate и endDate обязательны', 400);
      }

      const incomeRepository = AppDataSource.getRepository(Income);
      const expenseRepository = AppDataSource.getRepository(Expense);

      // Доходы
      const incomes = await incomeRepository.find({
        where: {
          clubId: parseInt(clubId as string),
          date: Between(new Date(startDate as string), new Date(endDate as string)),
        },
      });

      // Расходы
      const expenses = await expenseRepository.find({
        where: {
          clubId: parseInt(clubId as string),
          date: Between(new Date(startDate as string), new Date(endDate as string)),
          isApproved: true,
        },
        relations: ['category'],
      });

      const totalIncome = incomes.reduce((sum, income) => sum + parseFloat(income.amount.toString()), 0);
      const totalExpense = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount.toString()), 0);
      const netProfit = totalIncome - totalExpense;
      const profitability = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
      const marinaRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

      // Структура расходов по категориям
      const expensesByCategory: Record<string, number> = {};
      expenses.forEach((expense) => {
        const categoryName = expense.category.name;
        expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + parseFloat(expense.amount.toString());
      });

      res.json({
        period: {
          startDate,
          endDate,
        },
        income: {
          total: totalIncome,
          count: incomes.length,
          byType: incomes.reduce((acc, income) => {
            acc[income.type] = (acc[income.type] || 0) + parseFloat(income.amount.toString());
            return acc;
          }, {} as Record<string, number>),
        },
        expense: {
          total: totalExpense,
          count: expenses.length,
          byCategory: expensesByCategory,
        },
        metrics: {
          netProfit,
          profitability: parseFloat(profitability.toFixed(2)),
          marinaRatio: parseFloat(marinaRatio.toFixed(2)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ========== БЮДЖЕТ ==========
  async getBudgets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clubId } = req.query;

      const budgetRepository = AppDataSource.getRepository(Budget);
      const queryBuilder = budgetRepository
        .createQueryBuilder('budget')
        .leftJoinAndSelect('budget.club', 'club')
        .leftJoinAndSelect('budget.category', 'category');

      if (clubId) {
        queryBuilder.where('budget.clubId = :clubId', { clubId: parseInt(clubId as string) });
      }

      const budgets = await queryBuilder.orderBy('budget.startDate', 'DESC').getMany();

      res.json(budgets);
    } catch (error) {
      next(error);
    }
  }

  async createBudget(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clubId, name, startDate, endDate, plannedIncome, plannedExpense, currency, notes, categoryId } = req.body;

      if (!clubId || !name || !startDate || !endDate || !plannedIncome || !plannedExpense) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      const budgetRepository = AppDataSource.getRepository(Budget);
      const budget = budgetRepository.create({
        clubId: parseInt(clubId as string),
        name: name as string,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
        plannedIncome: parseFloat(plannedIncome as string),
        plannedExpense: parseFloat(plannedExpense as string),
        currency: (currency as Currency) || Currency.RUB,
        notes: notes as string | undefined,
        categoryId: categoryId ? parseInt(categoryId as string) : undefined,
      });

      await budgetRepository.save(budget);

      const savedBudget = await budgetRepository.findOne({
        where: { id: budget.id },
        relations: ['club', 'category'],
      });

      res.status(201).json(savedBudget);
    } catch (error) {
      next(error);
    }
  }
}


