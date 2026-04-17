import { NextFunction, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { Club } from '../../entities/Club';
import { ClubPartner } from '../../entities/ClubPartner';
import { ClubCashTransaction } from '../../entities/ClubCashTransaction';
import { CashPaymentMethod, CashTransactionType, Currency, UserRole } from '../../types';

export class ClubFinanceController {
  private async ensureClubAccess(req: AuthRequest, clubId: number): Promise<Club> {
    if (!req.userId) {
      throw new AppError('Требуется аутентификация', 401);
    }

    const clubRepository = AppDataSource.getRepository(Club);
    const club = await clubRepository.findOne({ where: { id: clubId } });
    if (!club) {
      throw new AppError('Яхт-клуб не найден', 404);
    }

    const isAdmin = req.userRole === UserRole.SUPER_ADMIN || req.userRole === UserRole.ADMIN;
    if (!isAdmin && club.ownerId !== req.userId) {
      throw new AppError('Доступ запрещен', 403);
    }

    return club;
  }

  async getPartners(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubAccess(req, clubId);

      const partnerRepository = AppDataSource.getRepository(ClubPartner);
      const partners = await partnerRepository.find({
        where: { clubId, isActive: true },
        order: { createdAt: 'ASC' },
      });

      res.json(partners);
    } catch (error) {
      next(error);
    }
  }

  async createPartner(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubAccess(req, clubId);
      const { name, sharePercent } = req.body;

      if (!name || !sharePercent) {
        throw new AppError('Укажите имя партнера и долю', 400);
      }

      const partnerRepository = AppDataSource.getRepository(ClubPartner);
      const currentPartners = await partnerRepository.find({ where: { clubId, isActive: true } });
      const currentSum = currentPartners.reduce((sum, p) => sum + Number(p.sharePercent), 0);
      const newShare = Number(sharePercent);

      if (currentSum + newShare > 100) {
        throw new AppError('Сумма долей партнеров не может превышать 100%', 400);
      }

      const partner = partnerRepository.create({
        clubId,
        name: String(name).trim(),
        sharePercent: newShare,
        isActive: true,
      });
      await partnerRepository.save(partner);

      res.status(201).json(partner);
    } catch (error) {
      next(error);
    }
  }

  async updatePartner(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      const partnerId = parseInt(req.params.partnerId);
      await this.ensureClubAccess(req, clubId);

      const { name, sharePercent, isActive } = req.body;
      const partnerRepository = AppDataSource.getRepository(ClubPartner);
      const partner = await partnerRepository.findOne({ where: { id: partnerId, clubId } });
      if (!partner) {
        throw new AppError('Партнер не найден', 404);
      }

      if (typeof sharePercent !== 'undefined') {
        const allPartners = await partnerRepository.find({ where: { clubId, isActive: true } });
        const sumWithoutCurrent = allPartners
          .filter((p) => p.id !== partner.id)
          .reduce((sum, p) => sum + Number(p.sharePercent), 0);
        if (sumWithoutCurrent + Number(sharePercent) > 100) {
          throw new AppError('Сумма долей партнеров не может превышать 100%', 400);
        }
        partner.sharePercent = Number(sharePercent);
      }

      if (typeof name !== 'undefined') {
        partner.name = String(name).trim();
      }
      if (typeof isActive !== 'undefined') {
        partner.isActive = Boolean(isActive);
      }

      await partnerRepository.save(partner);
      res.json(partner);
    } catch (error) {
      next(error);
    }
  }

  async deletePartner(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      const partnerId = parseInt(req.params.partnerId);
      await this.ensureClubAccess(req, clubId);

      const partnerRepository = AppDataSource.getRepository(ClubPartner);
      const partner = await partnerRepository.findOne({ where: { id: partnerId, clubId } });
      if (!partner) {
        throw new AppError('Партнер не найден', 404);
      }

      partner.isActive = false;
      await partnerRepository.save(partner);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async getCashTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubAccess(req, clubId);

      const txRepository = AppDataSource.getRepository(ClubCashTransaction);
      const transactions = await txRepository.find({
        where: { clubId },
        relations: ['acceptedByPartner', 'paidByPartner', 'createdBy'],
        order: { date: 'DESC', createdAt: 'DESC' },
      });

      res.json(transactions);
    } catch (error) {
      next(error);
    }
  }

  async createCashTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubAccess(req, clubId);
      const {
        transactionType,
        amount,
        currency,
        paymentMethod,
        date,
        description,
        bookingId,
        acceptedByPartnerId,
        paidByPartnerId,
      } = req.body;

      if (!transactionType || !amount || !paymentMethod || !date) {
        throw new AppError('Заполните обязательные поля', 400);
      }

      if (transactionType === CashTransactionType.INCOME && !acceptedByPartnerId) {
        throw new AppError('Для прихода укажите, кто принял деньги', 400);
      }

      if (transactionType === CashTransactionType.EXPENSE && !paidByPartnerId) {
        throw new AppError('Для расхода укажите, кто оплатил из своего кармана', 400);
      }

      const txRepository = AppDataSource.getRepository(ClubCashTransaction);
      const partnerRepository = AppDataSource.getRepository(ClubPartner);

      if (acceptedByPartnerId) {
        const partner = await partnerRepository.findOne({
          where: { id: parseInt(String(acceptedByPartnerId)), clubId, isActive: true },
        });
        if (!partner) throw new AppError('Партнер, принявший деньги, не найден', 404);
      }

      if (paidByPartnerId) {
        const partner = await partnerRepository.findOne({
          where: { id: parseInt(String(paidByPartnerId)), clubId, isActive: true },
        });
        if (!partner) throw new AppError('Партнер, оплативший расход, не найден', 404);
      }

      const tx = txRepository.create({
        clubId,
        transactionType: transactionType as CashTransactionType,
        amount: Number(amount),
        currency: (currency as Currency) || Currency.RUB,
        paymentMethod: paymentMethod as CashPaymentMethod,
        date: new Date(date),
        description: description ? String(description) : null,
        bookingId: bookingId ? Number(bookingId) : null,
        acceptedByPartnerId: acceptedByPartnerId ? Number(acceptedByPartnerId) : null,
        paidByPartnerId: paidByPartnerId ? Number(paidByPartnerId) : null,
        createdById: req.userId || null,
      });

      await txRepository.save(tx);

      const savedTx = await txRepository.findOne({
        where: { id: tx.id },
        relations: ['acceptedByPartner', 'paidByPartner', 'createdBy'],
      });

      res.status(201).json(savedTx);
    } catch (error) {
      next(error);
    }
  }

  async updateCashTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      const transactionId = parseInt(req.params.transactionId);
      await this.ensureClubAccess(req, clubId);

      const txRepository = AppDataSource.getRepository(ClubCashTransaction);
      const tx = await txRepository.findOne({ where: { id: transactionId, clubId } });
      if (!tx) {
        throw new AppError('Операция не найдена', 404);
      }

      const {
        transactionType,
        amount,
        currency,
        paymentMethod,
        date,
        description,
        bookingId,
        acceptedByPartnerId,
        paidByPartnerId,
      } = req.body;

      if (typeof transactionType !== 'undefined') tx.transactionType = transactionType;
      if (typeof amount !== 'undefined') tx.amount = Number(amount);
      if (typeof currency !== 'undefined') tx.currency = currency;
      if (typeof paymentMethod !== 'undefined') tx.paymentMethod = paymentMethod;
      if (typeof date !== 'undefined') tx.date = new Date(date);
      if (typeof description !== 'undefined') tx.description = description ? String(description) : null;
      if (typeof bookingId !== 'undefined') tx.bookingId = bookingId ? Number(bookingId) : null;
      if (typeof acceptedByPartnerId !== 'undefined') tx.acceptedByPartnerId = acceptedByPartnerId ? Number(acceptedByPartnerId) : null;
      if (typeof paidByPartnerId !== 'undefined') tx.paidByPartnerId = paidByPartnerId ? Number(paidByPartnerId) : null;

      if (tx.transactionType === CashTransactionType.INCOME && !tx.acceptedByPartnerId) {
        throw new AppError('Для прихода укажите, кто принял деньги', 400);
      }
      if (tx.transactionType === CashTransactionType.EXPENSE && !tx.paidByPartnerId) {
        throw new AppError('Для расхода укажите, кто оплатил из своего кармана', 400);
      }

      await txRepository.save(tx);
      const updated = await txRepository.findOne({
        where: { id: tx.id },
        relations: ['acceptedByPartner', 'paidByPartner', 'createdBy'],
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  async deleteCashTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      const transactionId = parseInt(req.params.transactionId);
      await this.ensureClubAccess(req, clubId);

      const txRepository = AppDataSource.getRepository(ClubCashTransaction);
      const tx = await txRepository.findOne({ where: { id: transactionId, clubId } });
      if (!tx) {
        throw new AppError('Операция не найдена', 404);
      }
      await txRepository.remove(tx);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async getSettlements(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubAccess(req, clubId);

      const partnerRepository = AppDataSource.getRepository(ClubPartner);
      const txRepository = AppDataSource.getRepository(ClubCashTransaction);

      const partners = await partnerRepository.find({ where: { clubId, isActive: true } });
      const transactions = await txRepository.find({ where: { clubId } });

      const totalIncome = transactions
        .filter((tx) => tx.transactionType === CashTransactionType.INCOME)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const totalExpense = transactions
        .filter((tx) => tx.transactionType === CashTransactionType.EXPENSE)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const netProfit = totalIncome - totalExpense;

      const settlements = partners.map((partner) => {
        const incomeAccepted = transactions
          .filter(
            (tx) =>
              tx.transactionType === CashTransactionType.INCOME &&
              tx.acceptedByPartnerId === partner.id
          )
          .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const expensesPaid = transactions
          .filter(
            (tx) =>
              tx.transactionType === CashTransactionType.EXPENSE &&
              tx.paidByPartnerId === partner.id
          )
          .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const entitled = (netProfit * Number(partner.sharePercent)) / 100;
        const actualPosition = incomeAccepted - expensesPaid;
        const settlementAmount = entitled - actualPosition;

        return {
          partnerId: partner.id,
          partnerName: partner.name,
          sharePercent: Number(partner.sharePercent),
          incomeAccepted,
          expensesPaid,
          entitled,
          actualPosition,
          settlementAmount,
        };
      });

      res.json({
        totals: {
          totalIncome,
          totalExpense,
          netProfit,
        },
        settlements,
      });
    } catch (error) {
      next(error);
    }
  }
}

