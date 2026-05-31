import { In } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { Club } from '../../entities/Club';
import { Booking } from '../../entities/Booking';
import { Vessel } from '../../entities/Vessel';
import { CashTransaction } from '../../entities/CashTransaction';
import {
  BookingStatus,
  CashTransactionType,
  UserRole,
} from '../../types';
import { getAllStaffClubAccesses } from '../../utils/clubStaffPermissions';

export interface DashboardStats {
  clubs: number;
  vessels: number;
  bookings: number;
  totalIncome: number;
  totalExpense: number;
}

export interface DashboardClubListItem {
  id: number;
  name: string;
}

export interface DashboardVesselItem {
  id: number;
  name: string;
  type: string;
}

export interface DashboardStatsResult {
  stats: DashboardStats;
  clubList: DashboardClubListItem[];
  defaultClubId: number | null;
  clubDashboard: Record<string, unknown> | null;
  vessels: DashboardVesselItem[];
  vesselBalances: Record<number, number>;
  settlements: Record<string, unknown>[];
}

export class DashboardService {
  private isClubRole(role: UserRole): boolean {
    return (
      role === UserRole.CLUB_OWNER ||
      role === UserRole.CLUB_STAFF ||
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.ADMIN
    );
  }

  private async getClubList(req: AuthRequest): Promise<DashboardClubListItem[]> {
    if (!req.userId || !req.userRole || !this.isClubRole(req.userRole)) {
      return [];
    }

    const clubRepository = AppDataSource.getRepository(Club);

    if (req.userRole === UserRole.SUPER_ADMIN || req.userRole === UserRole.ADMIN) {
      const clubs = await clubRepository.find({
        select: ['id', 'name'],
        order: { name: 'ASC' },
      });
      return clubs.map((club) => ({ id: club.id, name: club.name }));
    }

    if (req.userRole === UserRole.CLUB_OWNER) {
      const clubs = await clubRepository.find({
        where: { ownerId: req.userId },
        select: ['id', 'name'],
        order: { name: 'ASC' },
      });
      return clubs.map((club) => ({ id: club.id, name: club.name }));
    }

    if (req.userRole === UserRole.CLUB_STAFF) {
      const accesses = await getAllStaffClubAccesses(req.userId);
      const allowedIds = accesses
        .filter((a) => a.accessEnabled && a.permissions.includes('dashboard'))
        .map((a) => a.clubId);
      if (allowedIds.length === 0) {
        return [];
      }
      const clubs = await clubRepository.find({
        where: { id: In(allowedIds) },
        select: ['id', 'name'],
        order: { name: 'ASC' },
      });
      return clubs.map((club) => ({ id: club.id, name: club.name }));
    }

    return [];
  }

  private async countPublishedClubs(): Promise<number> {
    const clubRepository = AppDataSource.getRepository(Club);
    return clubRepository.count({
      where: {
        isActive: true,
        isValidated: true,
        isSubmittedForValidation: true,
      },
    });
  }

  private async countBookings(req: AuthRequest): Promise<number> {
    if (!req.userId || !req.userRole) {
      return 0;
    }

    const bookingRepository = AppDataSource.getRepository(Booking);
    const queryBuilder = bookingRepository.createQueryBuilder('booking');

    if (req.userRole === UserRole.VESSEL_OWNER) {
      return queryBuilder
        .where('booking.vesselOwnerId = :userId', { userId: req.userId })
        .andWhere('booking.status != :cancelled', { cancelled: BookingStatus.CANCELLED })
        .getCount();
    }

    if (req.userRole === UserRole.CLUB_STAFF) {
      const accesses = await getAllStaffClubAccesses(req.userId);
      const allowedClubIds = accesses
        .filter((a) => a.accessEnabled && a.permissions.includes('bookings'))
        .map((a) => a.clubId);
      if (allowedClubIds.length === 0) {
        return 0;
      }
      return queryBuilder
        .where('booking.clubId IN (:...clubIds)', { clubIds: allowedClubIds })
        .getCount();
    }

    if (req.userRole === UserRole.CLUB_OWNER) {
      const clubRepository = AppDataSource.getRepository(Club);
      const userClubs = await clubRepository.find({
        where: { ownerId: req.userId },
        select: ['id'],
      });
      if (userClubs.length === 0) {
        return 0;
      }
      const clubIds = userClubs.map((club) => club.id);
      return queryBuilder
        .where('booking.clubId IN (:...clubIds)', { clubIds })
        .getCount();
    }

    if (req.userRole === UserRole.SUPER_ADMIN || req.userRole === UserRole.ADMIN) {
      return bookingRepository.count();
    }

    if (req.userRole === UserRole.GUEST) {
      return queryBuilder
        .where('booking.vesselOwnerId = :userId', { userId: req.userId })
        .getCount();
    }

    return 0;
  }

  private async getVesselOwnerData(userId: number): Promise<{
    vessels: DashboardVesselItem[];
    vesselBalances: Record<number, number>;
    totalIncome: number;
    totalExpense: number;
    clubsCount: number;
  }> {
    const vesselRepository = AppDataSource.getRepository(Vessel);
    const bookingRepository = AppDataSource.getRepository(Booking);
    const transactionRepository = AppDataSource.getRepository(CashTransaction);

    const [vessels, bookingStats, balanceRows, totals] = await Promise.all([
      vesselRepository.find({
        where: { ownerId: userId, isActive: true },
        select: ['id', 'name', 'type'],
        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
      bookingRepository
        .createQueryBuilder('booking')
        .select('COUNT(DISTINCT booking.clubId)', 'clubsCount')
        .where('booking.vesselOwnerId = :userId', { userId })
        .andWhere('booking.status != :cancelled', { cancelled: BookingStatus.CANCELLED })
        .getRawOne<{ clubsCount: string }>(),
      transactionRepository
        .createQueryBuilder('transaction')
        .innerJoin('transaction.cash', 'cash')
        .select('cash.vesselId', 'vesselId')
        .addSelect(
          `SUM(CASE
            WHEN transaction.transactionType = :incomeType THEN transaction.amount
            WHEN transaction.transactionType = :expenseType THEN -transaction.amount
            ELSE 0
          END)`,
          'balance'
        )
        .where('cash.vesselOwnerId = :userId', { userId })
        .andWhere('cash.isActive = :isActive', { isActive: true })
        .andWhere('cash.vesselId IS NOT NULL')
        .groupBy('cash.vesselId')
        .setParameters({
          incomeType: CashTransactionType.INCOME,
          expenseType: CashTransactionType.EXPENSE,
          userId,
          isActive: true,
        })
        .getRawMany<{ vesselId: string; balance: string }>(),
      transactionRepository
        .createQueryBuilder('transaction')
        .innerJoin('transaction.cash', 'cash')
        .select(
          `SUM(CASE WHEN transaction.transactionType = :incomeType THEN transaction.amount ELSE 0 END)`,
          'totalIncome'
        )
        .addSelect(
          `SUM(CASE WHEN transaction.transactionType = :expenseType THEN transaction.amount ELSE 0 END)`,
          'totalExpense'
        )
        .where('cash.vesselOwnerId = :userId', { userId })
        .andWhere('cash.isActive = :isActive', { isActive: true })
        .setParameters({
          incomeType: CashTransactionType.INCOME,
          expenseType: CashTransactionType.EXPENSE,
          userId,
          isActive: true,
        })
        .getRawOne<{ totalIncome: string | null; totalExpense: string | null }>(),
    ]);

    const vesselBalances: Record<number, number> = {};
    for (const row of balanceRows) {
      vesselBalances[Number(row.vesselId)] = parseFloat(row.balance || '0');
    }

    return {
      vessels: vessels.map((vessel) => ({
        id: vessel.id,
        name: vessel.name,
        type: vessel.type,
      })),
      vesselBalances,
      totalIncome: parseFloat(totals?.totalIncome || '0'),
      totalExpense: parseFloat(totals?.totalExpense || '0'),
      clubsCount: parseInt(bookingStats?.clubsCount || '0', 10),
    };
  }

  async getStats(req: AuthRequest): Promise<DashboardStatsResult> {
    if (!req.userId || !req.userRole) {
      throw new Error('Требуется аутентификация');
    }

    const stats: DashboardStats = {
      clubs: 0,
      vessels: 0,
      bookings: 0,
      totalIncome: 0,
      totalExpense: 0,
    };

    let vessels: DashboardVesselItem[] = [];
    let vesselBalances: Record<number, number> = {};

    const [clubList, bookingsCount] = await Promise.all([
      this.getClubList(req),
      this.countBookings(req),
    ]);

    stats.bookings = bookingsCount;

    if (req.userRole === UserRole.VESSEL_OWNER) {
      const vesselOwnerData = await this.getVesselOwnerData(req.userId);
      stats.clubs = vesselOwnerData.clubsCount;
      stats.vessels = vesselOwnerData.vessels.length;
      stats.totalIncome = vesselOwnerData.totalIncome;
      stats.totalExpense = vesselOwnerData.totalExpense;
      vessels = vesselOwnerData.vessels;
      vesselBalances = vesselOwnerData.vesselBalances;
    } else if (req.userRole === UserRole.SUPER_ADMIN || req.userRole === UserRole.ADMIN) {
      const vesselRepository = AppDataSource.getRepository(Vessel);
      const [clubsCount, vesselsCount] = await Promise.all([
        this.countPublishedClubs(),
        vesselRepository.count(),
      ]);
      stats.clubs = clubsCount;
      stats.vessels = vesselsCount;
    } else if (req.userRole === UserRole.CLUB_OWNER || req.userRole === UserRole.CLUB_STAFF) {
      stats.clubs = clubList.length;
    }

    const defaultClubId = clubList.length > 0 ? clubList[0].id : null;

    return {
      stats,
      clubList,
      defaultClubId,
      clubDashboard: null,
      vessels,
      vesselBalances,
      settlements: [],
    };
  }
}
