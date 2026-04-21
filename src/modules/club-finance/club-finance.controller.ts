import { NextFunction, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { In } from 'typeorm';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { Club } from '../../entities/Club';
import { ClubPartner } from '../../entities/ClubPartner';
import { ClubCashTransaction } from '../../entities/ClubCashTransaction';
import { ClubPartnerManager } from '../../entities/ClubPartnerManager';
import { User } from '../../entities/User';
import { UserClub } from '../../entities/UserClub';
import { Berth } from '../../entities/Berth';
import { Booking } from '../../entities/Booking';
import { Payment } from '../../entities/Payment';
import { BookingStatus, CashPaymentMethod, CashTransactionType, Currency, PaymentStatus, UserRole } from '../../types';
import { hashPassword } from '../../utils/password';
import { getClubIdsForStaffUser, userHasAccessToClub } from '../../utils/clubStaffAccess';

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
    if (isAdmin) {
      return club;
    }
    if (club.ownerId === req.userId) {
      return club;
    }
    if (req.userRole === UserRole.CLUB_STAFF && (await userHasAccessToClub(req.userId, clubId))) {
      return club;
    }

    throw new AppError('Доступ запрещен', 403);
  }

  /** Только владелец клуба или админ (настройка партнёров, кассовые операции вручную) */
  private async ensureClubOwnerOrAdmin(req: AuthRequest, clubId: number): Promise<Club> {
    if (!req.userId) {
      throw new AppError('Требуется аутентификация', 401);
    }

    const clubRepository = AppDataSource.getRepository(Club);
    const club = await clubRepository.findOne({ where: { id: clubId } });
    if (!club) {
      throw new AppError('Яхт-клуб не найден', 404);
    }

    const isAdmin = req.userRole === UserRole.SUPER_ADMIN || req.userRole === UserRole.ADMIN;
    if (isAdmin || club.ownerId === req.userId) {
      return club;
    }

    throw new AppError('Доступ запрещен', 403);
  }

  private async ensurePartnerInClub(clubId: number, partnerId: number): Promise<ClubPartner> {
    const partnerRepository = AppDataSource.getRepository(ClubPartner);
    const partner = await partnerRepository.findOne({ where: { id: partnerId, clubId, isActive: true } });
    if (!partner) {
      throw new AppError('Партнер не найден в выбранном клубе', 404);
    }
    return partner;
  }

  private async ensureManagerInClubPartner(
    clubId: number,
    partnerId: number,
    managerId: number
  ): Promise<ClubPartnerManager> {
    const managerRepository = AppDataSource.getRepository(ClubPartnerManager);
    const manager = await managerRepository.findOne({
      where: {
        id: managerId,
        clubId,
        partnerId,
        isActive: true,
      },
      relations: ['user'],
    });
    if (!manager) {
      throw new AppError('Менеджер не найден у выбранного партнера', 404);
    }
    return manager;
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
      await this.ensureClubOwnerOrAdmin(req, clubId);
      const { name, sharePercent, previousSeasonBalance } = req.body;

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
        previousSeasonBalance: Number(previousSeasonBalance || 0),
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
      await this.ensureClubOwnerOrAdmin(req, clubId);

      const { name, sharePercent, isActive, previousSeasonBalance } = req.body;
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
      if (typeof previousSeasonBalance !== 'undefined') {
        partner.previousSeasonBalance = Number(previousSeasonBalance || 0);
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

  async getClubUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubAccess(req, clubId);

      const userRepository = AppDataSource.getRepository(User);
      const userClubRepository = AppDataSource.getRepository(UserClub);

      const directUsers = await userRepository.find({
        where: { managedClubId: clubId, isActive: true },
        select: ['id', 'firstName', 'lastName', 'email', 'phone', 'role'],
      });

      const linkedUsers = await userClubRepository.find({
        where: { clubId },
        relations: ['user'],
      });

      const allUsersMap = new Map<number, any>();
      directUsers.forEach((u) => allUsersMap.set(u.id, u));
      linkedUsers.forEach((uc) => {
        if (uc.user?.isActive) {
          allUsersMap.set(uc.user.id, uc.user);
        }
      });

      const users = Array.from(allUsersMap.values()).sort((a, b) =>
        `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(`${b.lastName || ''} ${b.firstName || ''}`)
      );

      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  async getPartnerManagers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubAccess(req, clubId);

      const partnerId = req.query.partnerId ? parseInt(String(req.query.partnerId)) : undefined;
      if (partnerId) {
        await this.ensurePartnerInClub(clubId, partnerId);
      }

      const managerRepository = AppDataSource.getRepository(ClubPartnerManager);
      const managers = await managerRepository.find({
        where: {
          clubId,
          ...(partnerId ? { partnerId } : {}),
          isActive: true,
        },
        relations: ['partner', 'user'],
        order: { createdAt: 'ASC' },
      });

      res.json(managers);
    } catch (error) {
      next(error);
    }
  }

  async createPartnerManager(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubOwnerOrAdmin(req, clubId);

      const { partnerId, userId, userData } = req.body;
      if (!partnerId) {
        throw new AppError('Укажите партнера', 400);
      }
      const normalizedPartnerId = Number(partnerId);
      if (!Number.isInteger(normalizedPartnerId) || normalizedPartnerId <= 0) {
        throw new AppError('Некорректный партнер', 400);
      }
      await this.ensurePartnerInClub(clubId, normalizedPartnerId);

      const userRepository = AppDataSource.getRepository(User);
      const userClubRepository = AppDataSource.getRepository(UserClub);
      const managerRepository = AppDataSource.getRepository(ClubPartnerManager);
      let resolvedUserId: number;

      if (userId) {
        const normalizedUserId = Number(userId);
        const existingUser = await userRepository.findOne({ where: { id: normalizedUserId, isActive: true } });
        if (!existingUser) {
          throw new AppError('Пользователь не найден', 404);
        }
        resolvedUserId = existingUser.id;
      } else if (userData) {
        const {
          email,
          password,
          firstName,
          lastName,
          phone,
        } = userData;
        if (!email || !password || !firstName || !lastName) {
          throw new AppError('Для нового менеджера заполните email, пароль, имя и фамилию', 400);
        }
        const existingByEmail = await userRepository.findOne({ where: { email: String(email).trim() } });
        if (existingByEmail) {
          throw new AppError('Пользователь с таким email уже существует', 400);
        }
        const hashedPassword = await hashPassword(String(password));
        const createdUser = userRepository.create({
          email: String(email).trim().toLowerCase(),
          password: hashedPassword,
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          phone: phone ? String(phone).trim() : undefined,
          role: UserRole.CLUB_STAFF,
          isActive: true,
          isValidated: true,
          emailVerified: true,
          managedClubId: clubId,
        });
        const savedUser = await userRepository.save(createdUser);
        resolvedUserId = savedUser.id;
      } else {
        throw new AppError('Укажите существующего пользователя или данные нового менеджера', 400);
      }

      const existingUserClub = await userClubRepository.findOne({
        where: { userId: resolvedUserId, clubId },
      });
      if (!existingUserClub) {
        const uc = userClubRepository.create({ userId: resolvedUserId, clubId });
        await userClubRepository.save(uc);
      }

      let manager = await managerRepository.findOne({
        where: {
          clubId,
          partnerId: normalizedPartnerId,
          userId: resolvedUserId,
        },
      });

      if (manager) {
        manager.isActive = true;
      } else {
        manager = managerRepository.create({
          clubId,
          partnerId: normalizedPartnerId,
          userId: resolvedUserId,
          isActive: true,
        });
      }

      await managerRepository.save(manager);
      const saved = await managerRepository.findOne({
        where: { id: manager.id },
        relations: ['partner', 'user'],
      });
      res.status(201).json(saved);
    } catch (error) {
      next(error);
    }
  }

  async deletePartnerManager(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      const managerId = parseInt(req.params.managerId);
      await this.ensureClubOwnerOrAdmin(req, clubId);

      const managerRepository = AppDataSource.getRepository(ClubPartnerManager);
      const manager = await managerRepository.findOne({ where: { id: managerId, clubId } });
      if (!manager) {
        throw new AppError('Менеджер партнера не найден', 404);
      }
      manager.isActive = false;
      await managerRepository.save(manager);
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
        relations: ['acceptedByPartner', 'acceptedByManager', 'acceptedByManager.user', 'paidByPartner', 'paidByManager', 'paidByManager.user', 'createdBy'],
        order: { date: 'DESC', createdAt: 'DESC' },
      });

      res.json(transactions);
    } catch (error) {
      next(error);
    }
  }

  async getExpectedIncomes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubAccess(req, clubId);

      const paymentRepository = AppDataSource.getRepository(Payment);
      const payments = await paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.booking', 'booking')
        .leftJoinAndSelect('booking.berth', 'berth')
        .leftJoinAndSelect('booking.vessel', 'vessel')
        .leftJoinAndSelect('booking.vesselOwner', 'vesselOwner')
        .where('booking.clubId = :clubId', { clubId })
        .andWhere('booking.status != :cancelledStatus', { cancelledStatus: BookingStatus.CANCELLED })
        .andWhere('payment.status IN (:...paymentStatuses)', {
          paymentStatuses: [PaymentStatus.PENDING, PaymentStatus.OVERDUE],
        })
        .orderBy('payment.dueDate', 'ASC')
        .addOrderBy('payment.createdAt', 'ASC')
        .getMany();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const items = payments.map((payment) => {
        const dueDate = new Date(payment.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = daysUntilDue < 0;

        return {
          paymentId: payment.id,
          bookingId: payment.bookingId,
          amount: Number(payment.amount),
          status: payment.status,
          dueDate: payment.dueDate,
          paymentType: payment.paymentType,
          vesselName: payment.booking?.vessel?.name || null,
          berthNumber: payment.booking?.berth?.number || null,
          vesselOwnerName:
            payment.booking?.vesselOwner
              ? `${payment.booking.vesselOwner.lastName || ''} ${payment.booking.vesselOwner.firstName || ''}`.trim() ||
                payment.booking.vesselOwner.email ||
                null
              : null,
          isOverdue,
          daysUntilDue,
        };
      });

      const totalExpectedAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);
      const overdueAmount = items
        .filter((item) => item.isOverdue || item.status === PaymentStatus.OVERDUE)
        .reduce((sum, item) => sum + Number(item.amount), 0);

      res.json({
        clubId,
        totalExpectedAmount,
        overdueAmount,
        items,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTenantReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubAccess(req, clubId);

      const berthRepository = AppDataSource.getRepository(Berth);
      const bookingRepository = AppDataSource.getRepository(Booking);
      const paymentRepository = AppDataSource.getRepository(Payment);

      const allBerths = await berthRepository.find({
        where: { clubId, isAvailable: true },
        order: { number: 'ASC' },
      });

      const occupiedBookings = await bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.berth', 'berth')
        .leftJoinAndSelect('booking.vessel', 'vessel')
        .leftJoinAndSelect('booking.vesselOwner', 'vesselOwner')
        .where('booking.clubId = :clubId', { clubId })
        .andWhere(
          `(
            booking.status IN (:...statuses)
            OR EXISTS (
              SELECT 1
              FROM payments p
              WHERE p."bookingId" = booking.id
                AND p.status IN (:...blockingPaymentStatuses)
            )
          )`,
          {
            statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
            blockingPaymentStatuses: [PaymentStatus.PENDING, PaymentStatus.OVERDUE],
          }
        )
        .orderBy('berth.number', 'ASC')
        .addOrderBy('booking.createdAt', 'DESC')
        .getMany();

      const occupiedByBerth = new Map<number, Booking>();
      for (const booking of occupiedBookings) {
        if (!occupiedByBerth.has(booking.berthId)) {
          occupiedByBerth.set(booking.berthId, booking);
        }
      }

      const occupiedBerthIds = Array.from(occupiedByBerth.keys());
      const payments = occupiedBerthIds.length
        ? await paymentRepository.find({
            where: {
              bookingId: In(Array.from(occupiedByBerth.values()).map((booking) => booking.id)),
            },
          })
        : [];

      const paymentsByBookingId = new Map<number, Payment[]>();
      payments.forEach((payment) => {
        const current = paymentsByBookingId.get(payment.bookingId) || [];
        current.push(payment);
        paymentsByBookingId.set(payment.bookingId, current);
      });

      const occupiedItems = Array.from(occupiedByBerth.values()).map((booking) => {
        const bookingPayments = paymentsByBookingId.get(booking.id) || [];
        const acceptedAmount = bookingPayments
          .filter((payment) => payment.status === PaymentStatus.PAID)
          .reduce((sum, payment) => sum + Number(payment.amount), 0);
        const expectedAmount = bookingPayments
          .filter(
            (payment) =>
              payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.OVERDUE
          )
          .reduce((sum, payment) => sum + Number(payment.amount), 0);

        let renterFullName = booking.vesselOwner
          ? `${booking.vesselOwner.lastName || ''} ${booking.vesselOwner.firstName || ''}`.trim()
          : '';
        let renterPhone = booking.vesselOwner?.phone || null;

        // Для ручной брони владельцем клуба показываем ФИО/телефон клиента из технических данных судна.
        if (booking.vessel?.type === 'manual_booking' && booking.vessel.technicalSpecs) {
          try {
            const technicalSpecs = JSON.parse(booking.vessel.technicalSpecs) as {
              source?: string;
              customerFullName?: string;
              customerPhone?: string;
            };

            if (technicalSpecs.source === 'club_owner_manual_booking') {
              renterFullName = technicalSpecs.customerFullName?.trim() || renterFullName;
              renterPhone = technicalSpecs.customerPhone?.trim() || renterPhone;
            }
          } catch {
            // Игнорируем ошибки разбора JSON, используем fallback на владельца судна.
          }
        }

        return {
          berthId: booking.berthId,
          berthNumber: booking.berth?.number || '—',
          bookingId: booking.id,
          renterFullName: renterFullName || '—',
          renterPhone: renterPhone || '—',
          acceptedAmount,
          expectedAmount,
        };
      });

      const freeBerthsCount = Math.max(0, allBerths.length - occupiedBerthIds.length);

      res.json({
        clubId,
        totalBerths: allBerths.length,
        freeBerthsCount,
        occupiedBerthsCount: occupiedBerthIds.length,
        occupiedItems,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDashboardSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId || !req.userRole) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const clubRepository = AppDataSource.getRepository(Club);
      let clubIds: number[] = [];

      if (req.userRole === UserRole.SUPER_ADMIN || req.userRole === UserRole.ADMIN) {
        const clubs = await clubRepository.find({ select: ['id'] });
        clubIds = clubs.map((club) => club.id);
      } else if (req.userRole === UserRole.CLUB_OWNER) {
        const clubs = await clubRepository.find({ where: { ownerId: req.userId }, select: ['id'] });
        clubIds = clubs.map((club) => club.id);
      } else if (req.userRole === UserRole.CLUB_STAFF) {
        clubIds = await getClubIdsForStaffUser(req.userId);
      } else {
        throw new AppError('Доступ запрещен', 403);
      }

      if (clubIds.length === 0) {
        res.json({
          totalIncome: 0,
          partnerIncomes: [],
          receivablesAmount: 0,
          expectedIncomeAmount: 0,
          freeBerthsCount: 0,
          clubsCount: 0,
        });
        return;
      }

      const txRepository = AppDataSource.getRepository(ClubCashTransaction);
      const partnerRepository = AppDataSource.getRepository(ClubPartner);
      const paymentRepository = AppDataSource.getRepository(Payment);
      const berthRepository = AppDataSource.getRepository(Berth);
      const bookingRepository = AppDataSource.getRepository(Booking);

      const transactions = await txRepository.find({
        where: { clubId: In(clubIds) },
      });
      const partners = await partnerRepository.find({
        where: { clubId: In(clubIds), isActive: true },
      });

      const totalIncome = transactions
        .filter((tx) => tx.transactionType === CashTransactionType.INCOME)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      const totalExpense = transactions
        .filter((tx) => tx.transactionType === CashTransactionType.EXPENSE)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      const partnerIncomes = partners
        .map((partner) => {
          const incomeAmount = transactions
            .filter(
              (tx) =>
                tx.transactionType === CashTransactionType.INCOME &&
                tx.acceptedByPartnerId === partner.id
            )
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

          return {
            partnerId: partner.id,
            partnerName: partner.name,
            clubId: partner.clubId,
            incomeAmount,
          };
        })
        .sort((a, b) => b.incomeAmount - a.incomeAmount);

      const expectedPayments = await paymentRepository
        .createQueryBuilder('payment')
        .leftJoin('payment.booking', 'booking')
        .where('booking.clubId IN (:...clubIds)', { clubIds })
        .andWhere('booking.status != :cancelledStatus', { cancelledStatus: BookingStatus.CANCELLED })
        .andWhere('payment.status IN (:...paymentStatuses)', {
          paymentStatuses: [PaymentStatus.PENDING, PaymentStatus.OVERDUE],
        })
        .getMany();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expectedIncomeAmount = expectedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const receivablesAmount = expectedPayments
        .filter((payment) => {
          const dueDate = new Date(payment.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return payment.status === PaymentStatus.OVERDUE || dueDate < today;
        })
        .reduce((sum, payment) => sum + Number(payment.amount), 0);

      const availableBerths = await berthRepository.count({
        where: {
          clubId: In(clubIds),
          isAvailable: true,
        },
      });

      const occupiedBerthRows = await bookingRepository
        .createQueryBuilder('booking')
        .select('booking.berthId', 'berthId')
        .where('booking.clubId IN (:...clubIds)', { clubIds })
        .andWhere(
          `(
            booking.status IN (:...statuses)
            OR EXISTS (
              SELECT 1
              FROM payments p
              WHERE p."bookingId" = booking.id
                AND p.status IN (:...blockingPaymentStatuses)
            )
          )`,
          {
            statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
            blockingPaymentStatuses: [PaymentStatus.PENDING, PaymentStatus.OVERDUE],
          }
        )
        .groupBy('booking.berthId')
        .getRawMany();

      const occupiedBerthsCount = occupiedBerthRows.length;
      const freeBerthsCount = Math.max(0, availableBerths - occupiedBerthsCount);

      res.json({
        totalIncome,
        totalExpense,
        partnerIncomes,
        receivablesAmount,
        expectedIncomeAmount,
        freeBerthsCount,
        clubsCount: clubIds.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async createCashTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const clubId = parseInt(req.params.clubId);
      await this.ensureClubOwnerOrAdmin(req, clubId);
      const {
        transactionType,
        amount,
        currency,
        paymentMethod,
        date,
        description,
        bookingId,
        acceptedByPartnerId,
        acceptedByManagerId,
        paidByPartnerId,
        paidByManagerId,
      } = req.body;

      if (!transactionType || !amount || !paymentMethod || !date) {
        throw new AppError('Заполните обязательные поля', 400);
      }

      if (transactionType === CashTransactionType.INCOME && !acceptedByPartnerId) {
        throw new AppError('Для прихода укажите, кто принял деньги', 400);
      }

      if (transactionType === CashTransactionType.INCOME && !acceptedByManagerId) {
        throw new AppError('Для прихода укажите менеджера, который принял деньги', 400);
      }

      if (transactionType === CashTransactionType.EXPENSE && !paidByPartnerId) {
        throw new AppError('Для расхода укажите, кто оплатил из своего кармана', 400);
      }
      if (transactionType === CashTransactionType.TRANSFER) {
        if (!acceptedByPartnerId || !paidByPartnerId) {
          throw new AppError('Для перевода укажите партнера-отправителя и партнера-получателя', 400);
        }
        if (!acceptedByManagerId) {
          throw new AppError('Для перевода укажите менеджера, который принимает перевод', 400);
        }
        if (!paidByManagerId) {
          throw new AppError('Для перевода укажите менеджера, с которого списываем перевод', 400);
        }
        if (Number(acceptedByPartnerId) === Number(paidByPartnerId)) {
          throw new AppError('Для перевода партнер-отправитель и партнер-получатель должны отличаться', 400);
        }
      }

      const txRepository = AppDataSource.getRepository(ClubCashTransaction);
      const partnerRepository = AppDataSource.getRepository(ClubPartner);

      if (acceptedByPartnerId) {
        const partner = await partnerRepository.findOne({
          where: { id: parseInt(String(acceptedByPartnerId)), clubId, isActive: true },
        });
        if (!partner) throw new AppError('Партнер, принявший деньги, не найден', 404);
      }

      if (
        acceptedByManagerId &&
        (transactionType === CashTransactionType.INCOME || transactionType === CashTransactionType.TRANSFER)
      ) {
        await this.ensureManagerInClubPartner(
          clubId,
          Number(acceptedByPartnerId),
          Number(acceptedByManagerId)
        );
      }

      if (paidByPartnerId) {
        const partner = await partnerRepository.findOne({
          where: { id: parseInt(String(paidByPartnerId)), clubId, isActive: true },
        });
        if (!partner) throw new AppError('Партнер, оплативший расход, не найден', 404);
      }
      if (
        paidByManagerId &&
        (transactionType === CashTransactionType.TRANSFER)
      ) {
        await this.ensureManagerInClubPartner(
          clubId,
          Number(paidByPartnerId),
          Number(paidByManagerId)
        );
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
        acceptedByManagerId: acceptedByManagerId ? Number(acceptedByManagerId) : null,
        paidByPartnerId: paidByPartnerId ? Number(paidByPartnerId) : null,
        paidByManagerId: paidByManagerId ? Number(paidByManagerId) : null,
        createdById: req.userId || null,
      });

      await txRepository.save(tx);

      const savedTx = await txRepository.findOne({
        where: { id: tx.id },
        relations: ['acceptedByPartner', 'acceptedByManager', 'acceptedByManager.user', 'paidByPartner', 'paidByManager', 'paidByManager.user', 'createdBy'],
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
      await this.ensureClubOwnerOrAdmin(req, clubId);

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
        acceptedByManagerId,
        paidByPartnerId,
        paidByManagerId,
      } = req.body;

      if (typeof transactionType !== 'undefined') tx.transactionType = transactionType;
      if (typeof amount !== 'undefined') tx.amount = Number(amount);
      if (typeof currency !== 'undefined') tx.currency = currency;
      if (typeof paymentMethod !== 'undefined') tx.paymentMethod = paymentMethod;
      if (typeof date !== 'undefined') tx.date = new Date(date);
      if (typeof description !== 'undefined') tx.description = description ? String(description) : null;
      if (typeof bookingId !== 'undefined') tx.bookingId = bookingId ? Number(bookingId) : null;
      if (typeof acceptedByPartnerId !== 'undefined') tx.acceptedByPartnerId = acceptedByPartnerId ? Number(acceptedByPartnerId) : null;
      if (typeof acceptedByManagerId !== 'undefined') tx.acceptedByManagerId = acceptedByManagerId ? Number(acceptedByManagerId) : null;
      if (typeof paidByPartnerId !== 'undefined') tx.paidByPartnerId = paidByPartnerId ? Number(paidByPartnerId) : null;
      if (typeof paidByManagerId !== 'undefined') tx.paidByManagerId = paidByManagerId ? Number(paidByManagerId) : null;

      if (tx.transactionType === CashTransactionType.INCOME && !tx.acceptedByPartnerId) {
        throw new AppError('Для прихода укажите, кто принял деньги', 400);
      }
      if (tx.transactionType === CashTransactionType.INCOME && !tx.acceptedByManagerId) {
        throw new AppError('Для прихода укажите менеджера, который принял деньги', 400);
      }
      if (tx.transactionType === CashTransactionType.EXPENSE && !tx.paidByPartnerId) {
        throw new AppError('Для расхода укажите, кто оплатил из своего кармана', 400);
      }
      if (tx.transactionType === CashTransactionType.TRANSFER) {
        if (!tx.acceptedByPartnerId || !tx.paidByPartnerId) {
          throw new AppError('Для перевода укажите партнера-отправителя и партнера-получателя', 400);
        }
        if (!tx.acceptedByManagerId) {
          throw new AppError('Для перевода укажите менеджера, который принимает перевод', 400);
        }
        if (!tx.paidByManagerId) {
          throw new AppError('Для перевода укажите менеджера, с которого списываем перевод', 400);
        }
        if (tx.acceptedByPartnerId === tx.paidByPartnerId) {
          throw new AppError('Для перевода партнер-отправитель и партнер-получатель должны отличаться', 400);
        }
      }

      if (
        (tx.transactionType === CashTransactionType.INCOME || tx.transactionType === CashTransactionType.TRANSFER) &&
        tx.acceptedByPartnerId &&
        tx.acceptedByManagerId
      ) {
        await this.ensureManagerInClubPartner(clubId, tx.acceptedByPartnerId, tx.acceptedByManagerId);
      }
      if (
        tx.transactionType === CashTransactionType.TRANSFER &&
        tx.paidByPartnerId &&
        tx.paidByManagerId
      ) {
        await this.ensureManagerInClubPartner(clubId, tx.paidByPartnerId, tx.paidByManagerId);
      }

      await txRepository.save(tx);
      const updated = await txRepository.findOne({
        where: { id: tx.id },
        relations: ['acceptedByPartner', 'acceptedByManager', 'acceptedByManager.user', 'paidByPartner', 'paidByManager', 'paidByManager.user', 'createdBy'],
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
      await this.ensureClubOwnerOrAdmin(req, clubId);

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

        const transferredIn = transactions
          .filter(
            (tx) =>
              tx.transactionType === CashTransactionType.TRANSFER &&
              tx.acceptedByPartnerId === partner.id
          )
          .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const transferredOut = transactions
          .filter(
            (tx) =>
              tx.transactionType === CashTransactionType.TRANSFER &&
              tx.paidByPartnerId === partner.id
          )
          .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const entitled = (netProfit * Number(partner.sharePercent)) / 100;
        const actualPosition = incomeAccepted + transferredIn - expensesPaid - transferredOut;
        const settlementAmount = entitled - actualPosition;
        const previousSeasonBalance = Number(partner.previousSeasonBalance || 0);
        const settlementWithPreviousSeason = settlementAmount + previousSeasonBalance;

        return {
          partnerId: partner.id,
          partnerName: partner.name,
          sharePercent: Number(partner.sharePercent),
          incomeAccepted,
          expensesPaid,
          transferredIn,
          transferredOut,
          entitled,
          actualPosition,
          previousSeasonBalance,
          settlementAmount,
          settlementWithPreviousSeason,
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

